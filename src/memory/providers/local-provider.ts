/**
 * Local Memory Provider
 * Local storage implementation using JSON, SQLite, or LevelDB
 */

import { BaseMemoryProvider } from '../memory-interface.js';
import { 
  MemoryItem, 
  MemoryQuery, 
  LocalStorageConfig,
  MemoryTier
} from '../memory-config.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

/**
 * Local provider implementation
 */
export class LocalProvider extends BaseMemoryProvider {
  readonly name = 'local';
  private config: LocalStorageConfig;
  private memoryStore: Map<string, MemoryItem> = new Map();
  private indexByTier: Map<MemoryTier, Set<string>> = new Map();
  private indexByProject: Map<string, Set<string>> = new Map();
  private indexByUser: Map<string, Set<string>> = new Map();
  private storagePath: string;
  private autosaveInterval: NodeJS.Timeout | null = null;
  
  constructor(config: LocalStorageConfig) {
    super();
    this.config = {
      ...config,
      storageType: config.storageType || 'json',
      path: config.path || './.focus-memory',
      maxSizeMB: config.maxSizeMB || 100,
      enableCompression: config.enableCompression !== false
    };
    this.storagePath = path.resolve(this.config.path);
    
    // Initialize indexes
    const tiers: MemoryTier[] = ['session', 'working', 'project', 'team', 'global'];
    tiers.forEach(tier => this.indexByTier.set(tier, new Set()));
  }
  
  protected async doInitialize(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
      
      // Load existing data
      await this.loadFromDisk();
      
      // Set up autosave
      this.autosaveInterval = setInterval(() => {
        this.saveToDisk().catch(console.error);
      }, 30000); // Save every 30 seconds
      
      console.error(`Local provider initialized at ${this.storagePath}`);
    } catch (error) {
      console.error('Failed to initialize local provider:', error);
      throw error;
    }
  }
  
  async store(item: MemoryItem): Promise<string> {
    // Generate ID if not provided
    if (!item.id) {
      item.id = this.generateId();
    }
    
    // Check storage limits
    if (await this.isStorageFull()) {
      // Remove oldest session memories to make space
      await this.cleanupOldestMemories();
    }
    
    // Store in memory
    this.memoryStore.set(item.id, item);
    
    // Update indexes
    this.indexByTier.get(item.tier)?.add(item.id);
    if (item.projectId) {
      if (!this.indexByProject.has(item.projectId)) {
        this.indexByProject.set(item.projectId, new Set());
      }
      this.indexByProject.get(item.projectId)?.add(item.id);
    }
    if (item.userId) {
      if (!this.indexByUser.has(item.userId)) {
        this.indexByUser.set(item.userId, new Set());
      }
      this.indexByUser.get(item.userId)?.add(item.id);
    }
    
    // Update metrics
    this.metrics.totalItems++;
    this.metrics.itemsByTier[item.tier]++;
    
    // Save to disk (async, don't wait)
    this.saveToDisk().catch(console.error);
    
    return item.id;
  }
  
  async retrieve(query: MemoryQuery): Promise<MemoryItem[]> {
    const startTime = Date.now();
    let candidates: Set<string> = new Set();
    
    // Start with all items if no specific filters
    if (!query.userId && !query.projectId && !query.tiers) {
      candidates = new Set(this.memoryStore.keys());
    }
    
    // Filter by tier
    if (query.tiers && query.tiers.length > 0) {
      for (const tier of query.tiers) {
        const tierItems = this.indexByTier.get(tier as MemoryTier);
        if (tierItems) {
          tierItems.forEach(id => candidates.add(id));
        }
      }
    }
    
    // Filter by project
    if (query.projectId) {
      const projectItems = this.indexByProject.get(query.projectId) || new Set();
      if (candidates.size > 0) {
        // Intersection
        candidates = new Set([...candidates].filter(id => projectItems.has(id)));
      } else {
        candidates = projectItems;
      }
    }
    
    // Filter by user
    if (query.userId) {
      const userItems = this.indexByUser.get(query.userId) || new Set();
      if (candidates.size > 0) {
        // Intersection
        candidates = new Set([...candidates].filter(id => userItems.has(id)));
      } else {
        candidates = userItems;
      }
    }
    
    // Convert to items
    let items: MemoryItem[] = [];
    candidates.forEach(id => {
      const item = this.memoryStore.get(id);
      if (item) {
        items.push(item);
      }
    });
    
    // Filter by date range
    if (query.startDate || query.endDate) {
      items = items.filter(item => {
        const itemDate = item.timestamp.getTime();
        if (query.startDate && itemDate < query.startDate.getTime()) return false;
        if (query.endDate && itemDate > query.endDate.getTime()) return false;
        return true;
      });
    }
    
    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      items = items.filter(item => {
        if (!item.tags) return false;
        return query.tags!.some(tag => item.tags!.includes(tag));
      });
    }
    
    // Text search (simple substring match)
    if (query.text) {
      const searchText = query.text.toLowerCase();
      items = items.filter(item => 
        item.content.toLowerCase().includes(searchText)
      );
    }
    
    // Sort by recency
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply limit and offset
    if (query.offset) {
      items = items.slice(query.offset);
    }
    if (query.limit) {
      items = items.slice(0, query.limit);
    }
    
    // Update metrics
    const retrievalTime = Date.now() - startTime;
    this.metrics.avgRetrievalTime = 
      (this.metrics.avgRetrievalTime + retrievalTime) / 2;
    
    // Update access counts
    items.forEach(item => {
      item.accessCount = (item.accessCount || 0) + 1;
      item.lastAccessed = new Date();
    });
    
    return items;
  }
  
  async update(id: string, updates: Partial<MemoryItem>): Promise<boolean> {
    const item = this.memoryStore.get(id);
    if (!item) return false;
    
    // Update the item
    Object.assign(item, updates);
    
    // Update indexes if tier changed
    if (updates.tier && updates.tier !== item.tier) {
      this.indexByTier.get(item.tier)?.delete(id);
      this.indexByTier.get(updates.tier)?.add(id);
    }
    
    // Save to disk
    await this.saveToDisk();
    
    return true;
  }
  
  async delete(id: string): Promise<boolean> {
    const item = this.memoryStore.get(id);
    if (!item) return false;
    
    // Remove from store
    this.memoryStore.delete(id);
    
    // Remove from indexes
    this.indexByTier.get(item.tier)?.delete(id);
    if (item.projectId) {
      this.indexByProject.get(item.projectId)?.delete(id);
    }
    if (item.userId) {
      this.indexByUser.get(item.userId)?.delete(id);
    }
    
    // Update metrics
    this.metrics.totalItems--;
    this.metrics.itemsByTier[item.tier]--;
    
    // Save to disk
    await this.saveToDisk();
    
    return true;
  }
  
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean up expired items based on TTL
    const itemsToDelete: string[] = [];
    
    this.memoryStore.forEach((item, id) => {
      if (item.ttl && item.ttl > 0) {
        const expiryTime = item.timestamp.getTime() + (item.ttl * 60 * 1000);
        if (now > expiryTime) {
          itemsToDelete.push(id);
        }
      }
    });
    
    // Delete expired items
    for (const id of itemsToDelete) {
      if (await this.delete(id)) {
        cleaned++;
      }
    }
    
    // Save to disk after cleanup
    await this.saveToDisk();
    
    return cleaned;
  }
  
  async export(): Promise<MemoryItem[]> {
    return Array.from(this.memoryStore.values());
  }
  
  async import(items: MemoryItem[]): Promise<number> {
    let imported = 0;
    
    for (const item of items) {
      try {
        await this.store(item);
        imported++;
      } catch (error) {
        console.error(`Failed to import item ${item.id}:`, error);
      }
    }
    
    return imported;
  }
  
  async close(): Promise<void> {
    // Save final state
    await this.saveToDisk();
    
    // Clear autosave interval
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
    
    // Clear memory
    this.memoryStore.clear();
    this.indexByTier.clear();
    this.indexByProject.clear();
    this.indexByUser.clear();
    
    await super.close();
  }
  
  /**
   * Persistence methods
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const dataFile = this.getDataFilePath();
      
      // Check if file exists
      try {
        await fs.access(dataFile);
      } catch {
        // File doesn't exist, start fresh
        return;
      }
      
      // Read and parse data
      const data = await fs.readFile(dataFile, 'utf-8');
      let parsedData: any;
      
      if (this.config.enableCompression) {
        // Decompress if needed (simplified - real implementation would use zlib)
        parsedData = JSON.parse(data);
      } else {
        parsedData = JSON.parse(data);
      }
      
      // Restore memory store
      if (parsedData.items) {
        for (const item of parsedData.items) {
          // Convert dates
          item.timestamp = new Date(item.timestamp);
          if (item.lastAccessed) {
            item.lastAccessed = new Date(item.lastAccessed);
          }
          
          // Store without triggering save
          this.memoryStore.set(item.id, item);
          
          // Rebuild indexes
          this.indexByTier.get(item.tier)?.add(item.id);
          if (item.projectId) {
            if (!this.indexByProject.has(item.projectId)) {
              this.indexByProject.set(item.projectId, new Set());
            }
            this.indexByProject.get(item.projectId)?.add(item.id);
          }
          if (item.userId) {
            if (!this.indexByUser.has(item.userId)) {
              this.indexByUser.set(item.userId, new Set());
            }
            this.indexByUser.get(item.userId)?.add(item.id);
          }
        }
      }
      
      // Restore metrics
      if (parsedData.metrics) {
        this.metrics = parsedData.metrics;
      }
      
      console.error(`Loaded ${this.memoryStore.size} memories from disk`);
    } catch (error) {
      console.error('Failed to load from disk:', error);
    }
  }
  
  private async saveToDisk(): Promise<void> {
    try {
      const dataFile = this.getDataFilePath();
      
      // Prepare data
      const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        items: Array.from(this.memoryStore.values()),
        metrics: this.metrics
      };
      
      // Serialize
      let serialized = JSON.stringify(data, null, 2);
      
      if (this.config.enableCompression) {
        // Compress if needed (simplified - real implementation would use zlib)
        // For now, just use regular JSON
      }
      
      // Write to temp file first
      const tempFile = `${dataFile}.tmp`;
      await fs.writeFile(tempFile, serialized, 'utf-8');
      
      // Atomic rename
      await fs.rename(tempFile, dataFile);
      
    } catch (error) {
      console.error('Failed to save to disk:', error);
    }
  }
  
  private getDataFilePath(): string {
    if (this.config.storageType === 'json') {
      return `${this.storagePath}.json`;
    }
    // For SQLite or LevelDB, would return appropriate file
    return `${this.storagePath}.db`;
  }
  
  private async isStorageFull(): Promise<boolean> {
    if (!this.config.maxSizeMB) return false;
    
    try {
      const dataFile = this.getDataFilePath();
      const stats = await fs.stat(dataFile);
      const sizeMB = stats.size / (1024 * 1024);
      return sizeMB >= this.config.maxSizeMB;
    } catch {
      return false;
    }
  }
  
  private async cleanupOldestMemories(): Promise<void> {
    // Remove oldest session memories first
    const sessionMemories = Array.from(this.indexByTier.get('session') || [])
      .map(id => this.memoryStore.get(id)!)
      .filter(item => item)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Remove oldest 10% of session memories
    const toRemove = Math.ceil(sessionMemories.length * 0.1);
    for (let i = 0; i < toRemove && i < sessionMemories.length; i++) {
      await this.delete(sessionMemories[i].id);
    }
  }
}

/**
 * Factory function to create local provider
 */
export async function createLocalProvider(config: LocalStorageConfig): Promise<LocalProvider> {
  const provider = new LocalProvider(config);
  await provider.initialize();
  return provider;
}