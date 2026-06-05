/**
 * Dokoro Memory Provider
 * Integration with Dokoro for development logging and memory persistence
 */

import { BaseMemoryProvider } from '../memory-interface.js';
import { 
  MemoryItem, 
  MemoryQuery, 
  DokoroConfig,
  ContextQuery,
  ContextualMemory,
  MemoryTier
} from '../memory-config.js';

// Dokoro interface types
interface DokoroClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  log(entry: DokoroEntry): Promise<string>;
  query(params: DokoroQueryParams): Promise<DokoroEntry[]>;
  update(id: string, updates: Partial<DokoroEntry>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  getStats(): Promise<DokoroStats>;
}

interface DokoroEntry {
  id?: string;
  type: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  workspace?: string;
  project?: string;
  user?: string;
  tags?: string[];
}

interface DokoroQueryParams {
  workspace?: string;
  project?: string;
  type?: string;
  tags?: string[];
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface DokoroStats {
  totalEntries: number;
  entriesByType: Record<string, number>;
  storageUsedMB: number;
}

/**
 * Dokoro provider implementation
 */
export class DokoroProvider extends BaseMemoryProvider {
  readonly name = 'dokoro';
  private config: DokoroConfig;
  private client: DokoroClient | null = null;
  private isConnected: boolean = false;
  
  constructor(config: DokoroConfig) {
    super();
    this.config = {
      connectionString: config.connectionString || process.env.DOKORO_CONNECTION,
      workspace: config.workspace || process.env.DOKORO_WORKSPACE || 'default',
      projectId: config.projectId || process.env.DOKORO_PROJECT,
      enableSync: config.enableSync !== false,
      ...config
    };
  }
  
  protected async doInitialize(): Promise<void> {
    try {
      // Try to load Dokoro client dynamically
      const dokoroModule = await this.loadDokoroModule();
      
      if (!dokoroModule) {
        // Create a mock/local implementation if Dokoro is not available
        this.client = this.createLocalDokoro();
      } else {
        // Use actual Dokoro client
        this.client = new dokoroModule.DokoroClient({
          connectionString: this.config.connectionString,
          workspace: this.config.workspace
        });
      }
      
      // Connect to Dokoro
      if (this.client) {
        await this.client.connect();
        this.isConnected = true;
      }
      
      console.error(`Dokoro provider initialized for workspace: ${this.config.workspace}`);
    } catch (error) {
      console.error('Failed to initialize Dokoro provider:', error);
      // Fall back to local implementation
      this.client = this.createLocalDokoro();
      await this.client.connect();
      this.isConnected = true;
    }
  }
  
  async store(item: MemoryItem): Promise<string> {
    if (!this.isConnected || !this.client) {
      throw new Error('Dokoro provider not initialized');
    }
    
    try {
      // Convert MemoryItem to Dokoro entry
      const entry: DokoroEntry = {
        type: `memory_${item.tier}`,
        content: item.content,
        metadata: {
          ...item.metadata,
          memoryId: item.id,
          tier: item.tier,
          teamId: item.teamId,
          ttl: item.ttl,
          accessCount: item.accessCount
        },
        workspace: this.config.workspace,
        project: item.projectId || this.config.projectId,
        user: item.userId,
        tags: item.tags,
        timestamp: item.timestamp
      };
      
      // Store in Dokoro
      const id = await this.client.log(entry);
      
      // Update metrics
      this.metrics.totalItems++;
      this.metrics.itemsByTier[item.tier]++;
      
      return id || item.id;
    } catch (error) {
      console.error('Failed to store in Dokoro:', error);
      throw error;
    }
  }
  
  async retrieve(query: MemoryQuery): Promise<MemoryItem[]> {
    if (!this.isConnected || !this.client) {
      throw new Error('Dokoro provider not initialized');
    }
    
    try {
      const startTime = Date.now();
      
      // Build Dokoro query
      const dokoroQuery: DokoroQueryParams = {
        workspace: this.config.workspace,
        project: query.projectId || this.config.projectId,
        search: query.text,
        tags: query.tags,
        startDate: query.startDate,
        endDate: query.endDate,
        limit: query.limit,
        offset: query.offset
      };
      
      // Add tier filtering
      if (query.tiers && query.tiers.length > 0) {
        dokoroQuery.type = query.tiers.map(tier => `memory_${tier}`).join(',');
      }
      
      // Query Dokoro
      const entries = await this.client.query(dokoroQuery);
      
      // Convert to MemoryItems
      const items = this.convertDokoroEntries(entries);
      
      // Filter by userId if specified
      let filteredItems = items;
      if (query.userId) {
        filteredItems = items.filter(item => item.userId === query.userId);
      }
      
      // Update metrics
      const retrievalTime = Date.now() - startTime;
      this.metrics.avgRetrievalTime = 
        (this.metrics.avgRetrievalTime + retrievalTime) / 2;
      
      // Update access counts
      filteredItems.forEach(item => {
        item.accessCount = (item.accessCount || 0) + 1;
        item.lastAccessed = new Date();
      });
      
      return filteredItems;
    } catch (error) {
      console.error('Failed to retrieve from Dokoro:', error);
      throw error;
    }
  }
  
  async update(id: string, updates: Partial<MemoryItem>): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      throw new Error('Dokoro provider not initialized');
    }
    
    try {
      // Convert updates to Dokoro format
      const dokoroUpdates: Partial<DokoroEntry> = {
        content: updates.content,
        metadata: updates.metadata,
        tags: updates.tags
      };
      
      // Update tier in metadata if changed
      if (updates.tier) {
        dokoroUpdates.type = `memory_${updates.tier}`;
        dokoroUpdates.metadata = {
          ...dokoroUpdates.metadata,
          tier: updates.tier
        };
      }
      
      return await this.client.update(id, dokoroUpdates);
    } catch (error) {
      console.error('Failed to update in Dokoro:', error);
      return false;
    }
  }
  
  async delete(id: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      throw new Error('Dokoro provider not initialized');
    }
    
    try {
      const result = await this.client.delete(id);
      if (result) {
        this.metrics.totalItems--;
      }
      return result;
    } catch (error) {
      console.error('Failed to delete from Dokoro:', error);
      return false;
    }
  }
  
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    // Query for expired items
    const items = await this.retrieve({
      endDate: new Date(now - 24 * 60 * 60 * 1000) // Items older than 24 hours
    });
    
    for (const item of items) {
      if (item.ttl && item.ttl > 0) {
        const expiryTime = item.timestamp.getTime() + (item.ttl * 60 * 1000);
        if (now > expiryTime) {
          if (await this.delete(item.id)) {
            cleaned++;
          }
        }
      }
    }
    
    return cleaned;
  }
  
  async export(): Promise<MemoryItem[]> {
    if (!this.isConnected || !this.client) {
      throw new Error('Dokoro provider not initialized');
    }
    
    try {
      const entries = await this.client.query({
        workspace: this.config.workspace,
        project: this.config.projectId,
        type: 'memory_', // Prefix match for all memory types
        limit: 100000 // Large limit to get all
      });
      
      return this.convertDokoroEntries(entries);
    } catch (error) {
      console.error('Failed to export from Dokoro:', error);
      throw error;
    }
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
  
  async isAvailable(): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    
    try {
      // Check connection by getting stats
      await this.client.getStats();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async close(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
    this.isConnected = false;
    await super.close();
  }
  
  /**
   * Helper methods
   */
  private async loadDokoroModule(): Promise<any> {
    try {
      // Try to dynamically import dokoro package
      // @ts-ignore - Optional dependency
      const dokoro = await import('dokoro');
      return dokoro;
    } catch (error) {
      // Dokoro package not installed
      console.warn('Dokoro package not installed. Using local implementation.');
      return null;
    }
  }
  
  private createLocalDokoro(): DokoroClient {
    // Local implementation that mimics Dokoro API
    const localStore = new Map<string, DokoroEntry>();
    let nextId = 1;
    
    return {
      async connect() {
        console.error('Using local Dokoro implementation');
      },
      
      async disconnect() {
        localStore.clear();
      },
      
      async log(entry: DokoroEntry): Promise<string> {
        const id = entry.id || `dokoro_${nextId++}`;
        entry.id = id;
        entry.timestamp = entry.timestamp || new Date();
        localStore.set(id, entry);
        return id;
      },
      
      async query(params: DokoroQueryParams): Promise<DokoroEntry[]> {
        let results = Array.from(localStore.values());
        
        // Filter by type
        if (params.type) {
          const types = params.type.split(',');
          results = results.filter(e => types.some(t => e.type.startsWith(t)));
        }
        
        // Filter by workspace
        if (params.workspace) {
          results = results.filter(e => e.workspace === params.workspace);
        }
        
        // Filter by project
        if (params.project) {
          results = results.filter(e => e.project === params.project);
        }
        
        // Text search
        if (params.search) {
          const searchLower = params.search.toLowerCase();
          results = results.filter(e => 
            e.content.toLowerCase().includes(searchLower)
          );
        }
        
        // Filter by tags
        if (params.tags && params.tags.length > 0) {
          results = results.filter(e => 
            e.tags && params.tags!.some(tag => e.tags!.includes(tag))
          );
        }
        
        // Date filtering
        if (params.startDate) {
          results = results.filter(e => 
            e.timestamp && e.timestamp >= params.startDate!
          );
        }
        if (params.endDate) {
          results = results.filter(e => 
            e.timestamp && e.timestamp <= params.endDate!
          );
        }
        
        // Sort by timestamp (newest first)
        results.sort((a, b) => {
          const timeA = a.timestamp?.getTime() || 0;
          const timeB = b.timestamp?.getTime() || 0;
          return timeB - timeA;
        });
        
        // Apply offset and limit
        if (params.offset) {
          results = results.slice(params.offset);
        }
        if (params.limit) {
          results = results.slice(0, params.limit);
        }
        
        return results;
      },
      
      async update(id: string, updates: Partial<DokoroEntry>): Promise<boolean> {
        const entry = localStore.get(id);
        if (!entry) return false;
        
        Object.assign(entry, updates);
        localStore.set(id, entry);
        return true;
      },
      
      async delete(id: string): Promise<boolean> {
        return localStore.delete(id);
      },
      
      async getStats(): Promise<DokoroStats> {
        const entriesByType: Record<string, number> = {};
        
        localStore.forEach(entry => {
          entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;
        });
        
        return {
          totalEntries: localStore.size,
          entriesByType,
          storageUsedMB: localStore.size * 0.001 // Rough estimate
        };
      }
    };
  }
  
  private convertDokoroEntries(entries: DokoroEntry[]): MemoryItem[] {
    return entries.map(entry => {
      // Extract tier from type (e.g., "memory_session" -> "session")
      const tier = (entry.type.replace('memory_', '') || 'session') as MemoryTier;
      
      return {
        id: entry.id || this.generateId(),
        content: entry.content,
        tier,
        userId: entry.user,
        projectId: entry.project || this.config.projectId,
        teamId: entry.metadata?.teamId,
        timestamp: entry.timestamp || new Date(),
        metadata: entry.metadata || {},
        tags: entry.tags,
        ttl: entry.metadata?.ttl,
        accessCount: entry.metadata?.accessCount || 0,
        lastAccessed: entry.metadata?.lastAccessed ? 
          new Date(entry.metadata.lastAccessed) : new Date()
      };
    });
  }
}

/**
 * Factory function to create Dokoro provider
 */
export async function createDokoroProvider(config: DokoroConfig): Promise<DokoroProvider | null> {
  try {
    const provider = new DokoroProvider(config);
    await provider.initialize();
    return provider;
  } catch (error) {
    console.error('Failed to create Dokoro provider:', error);
    return null;
  }
}