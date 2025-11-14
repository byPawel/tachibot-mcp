/**
 * Hybrid Memory Provider
 * Combines multiple memory providers with fallback and sync capabilities
 */

import { BaseMemoryProvider, IMemoryProvider } from '../memory-interface.js';
import { 
  MemoryItem, 
  MemoryQuery, 
  HybridConfig,
  ContextQuery,
  ContextualMemory,
  MemoryTier,
  MemoryProvider
} from '../memory-config.js';
import { createMem0Provider } from './mem0-provider.js';
import { createDevLogProvider } from './devlog-provider.js';
import { createLocalProvider } from './local-provider.js';

/**
 * Hybrid provider implementation
 */
export class HybridProvider extends BaseMemoryProvider {
  readonly name = 'hybrid';
  private config: HybridConfig;
  private primaryProvider: IMemoryProvider | null = null;
  private fallbackProvider: IMemoryProvider | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private syncQueue: Map<string, MemoryItem> = new Map();
  private isSyncing: boolean = false;
  
  constructor(config: HybridConfig) {
    super();
    this.config = {
      syncInterval: config.syncInterval || 60000, // Default 1 minute
      preferPrimaryFor: config.preferPrimaryFor || ['team', 'global'],
      ...config
    };
  }
  
  protected async doInitialize(): Promise<void> {
    try {
      // Initialize primary provider
      this.primaryProvider = await this.createProvider(this.config.primary);
      if (!this.primaryProvider) {
        throw new Error(`Failed to create primary provider: ${this.config.primary}`);
      }
      
      // Initialize fallback provider
      this.fallbackProvider = await this.createProvider(this.config.fallback);
      if (!this.fallbackProvider) {
        throw new Error(`Failed to create fallback provider: ${this.config.fallback}`);
      }
      
      // Set up sync interval if enabled
      if (this.config.syncInterval && this.config.syncInterval > 0) {
        this.startSync();
      }
      
      console.error(`Hybrid provider initialized with primary=${this.config.primary}, fallback=${this.config.fallback}`);
    } catch (error) {
      console.error('Failed to initialize hybrid provider:', error);
      throw error;
    }
  }
  
  async store(item: MemoryItem): Promise<string> {
    const preferPrimary = this.shouldUsePrimary(item.tier);
    let primaryId: string | null = null;
    let fallbackId: string | null = null;
    
    // Try primary first if preferred
    if (preferPrimary && this.primaryProvider) {
      try {
        if (await this.primaryProvider.isAvailable()) {
          primaryId = await this.primaryProvider.store(item);
        }
      } catch (error) {
        console.warn(`Primary provider store failed: ${error}`);
      }
    }
    
    // Always store in fallback for redundancy
    if (this.fallbackProvider) {
      try {
        fallbackId = await this.fallbackProvider.store(item);
      } catch (error) {
        console.error(`Fallback provider store failed: ${error}`);
        if (!primaryId) throw error; // Fail if both failed
      }
    }
    
    // Try primary if not already tried and fallback succeeded
    if (!preferPrimary && !primaryId && fallbackId && this.primaryProvider) {
      try {
        if (await this.primaryProvider.isAvailable()) {
          primaryId = await this.primaryProvider.store(item);
        }
      } catch (error) {
        // Non-critical, we have fallback
        console.warn(`Primary provider store failed (non-critical): ${error}`);
      }
    }
    
    // Queue for sync if only stored in one provider
    if ((primaryId && !fallbackId) || (!primaryId && fallbackId)) {
      this.syncQueue.set(item.id, item);
    }
    
    // Update metrics
    this.metrics.totalItems++;
    this.metrics.itemsByTier[item.tier]++;
    
    return primaryId || fallbackId || item.id;
  }
  
  async retrieve(query: MemoryQuery): Promise<MemoryItem[]> {
    const results: Map<string, MemoryItem> = new Map();
    
    // Try primary provider
    if (this.primaryProvider && await this.primaryProvider.isAvailable()) {
      try {
        const primaryItems = await this.primaryProvider.retrieve(query);
        primaryItems.forEach(item => results.set(item.id, item));
      } catch (error) {
        console.warn(`Primary provider retrieve failed: ${error}`);
      }
    }
    
    // Try fallback provider
    if (this.fallbackProvider) {
      try {
        const fallbackItems = await this.fallbackProvider.retrieve(query);
        fallbackItems.forEach(item => {
          // Merge with primary results, primary takes precedence
          if (!results.has(item.id)) {
            results.set(item.id, item);
          }
        });
      } catch (error) {
        console.error(`Fallback provider retrieve failed: ${error}`);
        if (results.size === 0) throw error; // Fail if both failed
      }
    }
    
    return Array.from(results.values());
  }
  
  async retrieveContext(query: ContextQuery): Promise<ContextualMemory> {
    // Try primary first
    if (this.primaryProvider && await this.primaryProvider.isAvailable()) {
      try {
        return await this.primaryProvider.retrieveContext(query);
      } catch (error) {
        console.warn(`Primary provider context retrieval failed: ${error}`);
      }
    }
    
    // Fallback
    if (this.fallbackProvider) {
      try {
        return await this.fallbackProvider.retrieveContext(query);
      } catch (error) {
        console.error(`Fallback provider context retrieval failed: ${error}`);
        throw error;
      }
    }
    
    // Return empty context if both failed
    return {
      items: [],
      synthesis: '',
      relevanceScore: 0,
      tokenCount: 0,
      sources: {
        session: 0,
        working: 0,
        project: 0,
        team: 0,
        global: 0
      }
    };
  }
  
  async update(id: string, updates: Partial<MemoryItem>): Promise<boolean> {
    let primarySuccess = false;
    let fallbackSuccess = false;
    
    // Update in both providers
    if (this.primaryProvider && await this.primaryProvider.isAvailable()) {
      try {
        primarySuccess = await this.primaryProvider.update(id, updates);
      } catch (error) {
        console.warn(`Primary provider update failed: ${error}`);
      }
    }
    
    if (this.fallbackProvider) {
      try {
        fallbackSuccess = await this.fallbackProvider.update(id, updates);
      } catch (error) {
        console.warn(`Fallback provider update failed: ${error}`);
      }
    }
    
    return primarySuccess || fallbackSuccess;
  }
  
  async delete(id: string): Promise<boolean> {
    let primarySuccess = false;
    let fallbackSuccess = false;
    
    // Delete from both providers
    if (this.primaryProvider && await this.primaryProvider.isAvailable()) {
      try {
        primarySuccess = await this.primaryProvider.delete(id);
      } catch (error) {
        console.warn(`Primary provider delete failed: ${error}`);
      }
    }
    
    if (this.fallbackProvider) {
      try {
        fallbackSuccess = await this.fallbackProvider.delete(id);
      } catch (error) {
        console.warn(`Fallback provider delete failed: ${error}`);
      }
    }
    
    if (primarySuccess || fallbackSuccess) {
      this.metrics.totalItems--;
      // Remove from sync queue if present
      this.syncQueue.delete(id);
    }
    
    return primarySuccess || fallbackSuccess;
  }
  
  async semanticSearch(text: string, limit?: number, threshold?: number): Promise<MemoryItem[]> {
    const results: Map<string, MemoryItem> = new Map();
    
    // Try primary if it supports semantic search
    if (this.primaryProvider && 'semanticSearch' in this.primaryProvider) {
      try {
        const items = await (this.primaryProvider as any).semanticSearch(text, limit, threshold);
        items.forEach((item: MemoryItem) => results.set(item.id, item));
      } catch (error) {
        console.warn(`Primary provider semantic search failed: ${error}`);
      }
    }
    
    // Try fallback if it supports semantic search
    if (this.fallbackProvider && 'semanticSearch' in this.fallbackProvider) {
      try {
        const items = await (this.fallbackProvider as any).semanticSearch(text, limit, threshold);
        items.forEach((item: MemoryItem) => {
          if (!results.has(item.id)) {
            results.set(item.id, item);
          }
        });
      } catch (error) {
        console.warn(`Fallback provider semantic search failed: ${error}`);
      }
    }
    
    return Array.from(results.values()).slice(0, limit);
  }
  
  async cleanup(): Promise<number> {
    let totalCleaned = 0;
    
    // Cleanup both providers
    if (this.primaryProvider) {
      try {
        totalCleaned += await this.primaryProvider.cleanup();
      } catch (error) {
        console.warn(`Primary provider cleanup failed: ${error}`);
      }
    }
    
    if (this.fallbackProvider) {
      try {
        totalCleaned += await this.fallbackProvider.cleanup();
      } catch (error) {
        console.warn(`Fallback provider cleanup failed: ${error}`);
      }
    }
    
    return totalCleaned;
  }
  
  async export(): Promise<MemoryItem[]> {
    const allItems: Map<string, MemoryItem> = new Map();
    
    // Export from both providers
    if (this.primaryProvider) {
      try {
        const items = await this.primaryProvider.export();
        items.forEach(item => allItems.set(item.id, item));
      } catch (error) {
        console.warn(`Primary provider export failed: ${error}`);
      }
    }
    
    if (this.fallbackProvider) {
      try {
        const items = await this.fallbackProvider.export();
        items.forEach(item => {
          if (!allItems.has(item.id)) {
            allItems.set(item.id, item);
          }
        });
      } catch (error) {
        console.warn(`Fallback provider export failed: ${error}`);
      }
    }
    
    return Array.from(allItems.values());
  }
  
  async import(items: MemoryItem[]): Promise<number> {
    let totalImported = 0;
    
    // Import to both providers
    if (this.primaryProvider) {
      try {
        totalImported = await this.primaryProvider.import(items);
      } catch (error) {
        console.warn(`Primary provider import failed: ${error}`);
      }
    }
    
    if (this.fallbackProvider) {
      try {
        await this.fallbackProvider.import(items);
      } catch (error) {
        console.warn(`Fallback provider import failed: ${error}`);
      }
    }
    
    return totalImported;
  }
  
  async isAvailable(): Promise<boolean> {
    const primaryAvailable = this.primaryProvider ? 
      await this.primaryProvider.isAvailable() : false;
    const fallbackAvailable = this.fallbackProvider ? 
      await this.fallbackProvider.isAvailable() : false;
    
    return primaryAvailable || fallbackAvailable;
  }
  
  async close(): Promise<void> {
    // Stop sync
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Perform final sync
    await this.performSync();
    
    // Close providers
    if (this.primaryProvider) {
      await this.primaryProvider.close();
    }
    if (this.fallbackProvider) {
      await this.fallbackProvider.close();
    }
    
    await super.close();
  }
  
  /**
   * Helper methods
   */
  private async createProvider(type: Exclude<MemoryProvider, 'hybrid' | 'none'>): Promise<IMemoryProvider | null> {
    const config = (global as any).memoryConfig || {};
    
    switch (type) {
      case 'mem0':
        return await createMem0Provider(config.mem0 || {});
      
      case 'devlog':
        return await createDevLogProvider(config.devlog || {});
      
      case 'local':
        return await createLocalProvider(config.local || {
          storageType: 'json',
          path: './.focus-memory-hybrid',
          maxSizeMB: 100
        });
      
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }
  
  private shouldUsePrimary(tier: MemoryTier): boolean {
    return this.config.preferPrimaryFor?.includes(tier) || false;
  }
  
  private startSync(): void {
    this.syncInterval = setInterval(() => {
      this.performSync().catch(console.error);
    }, this.config.syncInterval!);
  }
  
  private async performSync(): Promise<void> {
    if (this.isSyncing || this.syncQueue.size === 0) return;
    
    this.isSyncing = true;
    const itemsToSync = Array.from(this.syncQueue.values());
    
    for (const item of itemsToSync) {
      try {
        // Check if item exists in both providers
        const primaryHas = this.primaryProvider ? 
          (await this.primaryProvider.retrieve({ text: item.id, limit: 1 })).length > 0 : false;
        const fallbackHas = this.fallbackProvider ? 
          (await this.fallbackProvider.retrieve({ text: item.id, limit: 1 })).length > 0 : false;
        
        // Sync to missing provider
        if (!primaryHas && this.primaryProvider && await this.primaryProvider.isAvailable()) {
          await this.primaryProvider.store(item);
        }
        if (!fallbackHas && this.fallbackProvider) {
          await this.fallbackProvider.store(item);
        }
        
        // Remove from queue if synced
        if (primaryHas || fallbackHas) {
          this.syncQueue.delete(item.id);
        }
      } catch (error) {
        console.warn(`Failed to sync item ${item.id}: ${error}`);
      }
    }
    
    this.isSyncing = false;
  }
}

/**
 * Factory function to create hybrid provider
 */
export async function createHybridProvider(config: HybridConfig): Promise<HybridProvider> {
  const provider = new HybridProvider(config);
  await provider.initialize();
  return provider;
}