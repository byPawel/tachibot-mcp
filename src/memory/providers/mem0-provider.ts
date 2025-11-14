/**
 * Mem0 Memory Provider
 * Integration with Mem0 for persistent, semantic, and graph-based memory
 */

import { BaseMemoryProvider } from '../memory-interface.js';
import { 
  MemoryItem, 
  MemoryQuery, 
  Mem0Config,
  ContextQuery,
  ContextualMemory
} from '../memory-config.js';

// Dynamic import for optional mem0ai package
let Memory: any;

/**
 * Mem0 provider implementation
 */
export class Mem0Provider extends BaseMemoryProvider {
  readonly name = 'mem0';
  private memory: any;
  private config: Mem0Config;
  private isConnected: boolean = false;
  
  constructor(config: Mem0Config) {
    super();
    this.config = {
      apiKey: config.apiKey || process.env.MEM0_API_KEY,
      endpoint: config.endpoint || process.env.MEM0_ENDPOINT || 'https://api.mem0.ai',
      userId: config.userId || 'default',
      enableVectorSearch: config.enableVectorSearch !== false,
      enableGraphMemory: config.enableGraphMemory !== false,
      maxTokens: config.maxTokens || 2000,
      ...config
    };
  }
  
  protected async doInitialize(): Promise<void> {
    try {
      // Dynamically import mem0ai if available
      try {
        // @ts-ignore - Optional dependency
        const mem0Module = await import('mem0ai');
        Memory = mem0Module.Memory || mem0Module.default?.Memory;
      } catch (importError) {
        // If mem0ai is not installed, try the OSS version
        try {
          // @ts-ignore - Optional dependency
          const mem0OssModule = await import('mem0ai/oss');
          Memory = mem0OssModule.Memory || mem0OssModule.default?.Memory;
        } catch (ossError) {
          console.warn('Mem0 package not installed. Install with: npm install mem0ai');
          throw new Error('Mem0 provider requires mem0ai package');
        }
      }
      
      if (!this.config.apiKey) {
        throw new Error('Mem0 API key is required');
      }
      
      // Initialize Mem0 client
      this.memory = new Memory({
        apiKey: this.config.apiKey,
        endpoint: this.config.endpoint
      });
      
      this.isConnected = true;
      console.error('Mem0 provider initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Mem0 provider:', error);
      throw error;
    }
  }
  
  async store(item: MemoryItem): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Mem0 provider not initialized');
    }
    
    try {
      // Convert to Mem0 format
      const messages = [
        {
          role: 'system',
          content: `[${item.tier}] ${item.content}`
        }
      ];
      
      const metadata = {
        tier: item.tier,
        projectId: item.projectId,
        teamId: item.teamId,
        timestamp: item.timestamp.toISOString(),
        tags: item.tags || [],
        ...item.metadata
      };
      
      // Add to Mem0
      const result = await this.memory.add(messages, {
        userId: item.userId || this.config.userId,
        metadata
      });
      
      // Update metrics
      this.metrics.totalItems++;
      this.metrics.itemsByTier[item.tier]++;
      
      // Return the ID from Mem0 response
      return result.id || item.id;
    } catch (error) {
      console.error('Failed to store in Mem0:', error);
      throw error;
    }
  }
  
  async retrieve(query: MemoryQuery): Promise<MemoryItem[]> {
    if (!this.isConnected) {
      throw new Error('Mem0 provider not initialized');
    }
    
    try {
      const startTime = Date.now();
      
      // Build Mem0 query
      const mem0Query: any = {
        userId: query.userId || this.config.userId,
        limit: query.limit || 10
      };
      
      // Add metadata filters
      if (query.projectId) {
        mem0Query.filters = { projectId: query.projectId };
      }
      if (query.tags && query.tags.length > 0) {
        mem0Query.filters = { ...mem0Query.filters, tags: { $in: query.tags } };
      }
      
      let memories;
      
      // Use semantic search if text is provided
      if (query.text && this.config.enableVectorSearch) {
        memories = await this.memory.search(query.text, mem0Query);
      } else {
        // Get all memories with filters
        memories = await this.memory.getAll(mem0Query);
      }
      
      // Convert Mem0 results to MemoryItem format
      const items = this.convertMem0Results(memories);
      
      // Update metrics
      const retrievalTime = Date.now() - startTime;
      this.metrics.avgRetrievalTime = 
        (this.metrics.avgRetrievalTime + retrievalTime) / 2;
      
      return items;
    } catch (error) {
      console.error('Failed to retrieve from Mem0:', error);
      throw error;
    }
  }
  
  async retrieveContext(query: ContextQuery): Promise<ContextualMemory> {
    if (!this.isConnected) {
      throw new Error('Mem0 provider not initialized');
    }
    
    try {
      // Mem0's built-in context handling
      const memories = await this.retrieve(query);
      
      // If graph memory is enabled, get related memories
      if (this.config.enableGraphMemory && memories.length > 0) {
        const relatedMemories = await this.getRelatedMemories(memories[0].id);
        memories.push(...relatedMemories);
      }
      
      // Apply context window limit
      let selectedMemories = memories;
      if (query.contextWindow) {
        selectedMemories = this.limitByTokens(memories, query.contextWindow);
      }
      
      // Calculate source distribution
      const sources = {
        session: 0,
        working: 0,
        project: 0,
        team: 0,
        global: 0
      };
      
      selectedMemories.forEach(item => {
        sources[item.tier]++;
      });
      
      return {
        items: selectedMemories,
        synthesis: this.synthesizeItems(selectedMemories),
        relevanceScore: this.calculateRelevanceScore(selectedMemories, query),
        tokenCount: this.estimateTokenCount(selectedMemories),
        sources
      };
    } catch (error) {
      console.error('Failed to retrieve context from Mem0:', error);
      throw error;
    }
  }
  
  async update(id: string, updates: Partial<MemoryItem>): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Mem0 provider not initialized');
    }
    
    try {
      // Mem0 doesn't have direct update, so we delete and re-add
      await this.memory.delete(id);
      
      // Get the original item first (would need to store locally or retrieve)
      // For now, create new with updates
      const newItem: MemoryItem = {
        id,
        content: updates.content || '',
        tier: updates.tier || 'session',
        timestamp: updates.timestamp || new Date(),
        ...updates
      } as MemoryItem;
      
      await this.store(newItem);
      return true;
    } catch (error) {
      console.error('Failed to update in Mem0:', error);
      return false;
    }
  }
  
  async delete(id: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Mem0 provider not initialized');
    }
    
    try {
      await this.memory.delete(id);
      this.metrics.totalItems--;
      return true;
    } catch (error) {
      console.error('Failed to delete from Mem0:', error);
      return false;
    }
  }
  
  async semanticSearch(text: string, limit?: number, threshold?: number): Promise<MemoryItem[]> {
    if (!this.isConnected || !this.config.enableVectorSearch) {
      return [];
    }
    
    try {
      const results = await this.memory.search(text, {
        userId: this.config.userId,
        limit: limit || 10,
        threshold: threshold || 0.7
      });
      
      return this.convertMem0Results(results);
    } catch (error) {
      console.error('Failed to perform semantic search in Mem0:', error);
      return [];
    }
  }
  
  async getRelated(itemId: string, depth?: number): Promise<MemoryItem[]> {
    if (!this.isConnected || !this.config.enableGraphMemory) {
      return [];
    }
    
    return this.getRelatedMemories(itemId, depth);
  }
  
  async export(): Promise<MemoryItem[]> {
    if (!this.isConnected) {
      throw new Error('Mem0 provider not initialized');
    }
    
    try {
      const allMemories = await this.memory.getAll({
        userId: this.config.userId,
        limit: 10000 // Get all memories
      });
      
      return this.convertMem0Results(allMemories);
    } catch (error) {
      console.error('Failed to export from Mem0:', error);
      throw error;
    }
  }
  
  async import(items: MemoryItem[]): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Mem0 provider not initialized');
    }
    
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
    if (!this.isConnected) return false;
    
    try {
      // Try a simple operation to check connection
      await this.memory.getAll({ userId: this.config.userId, limit: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async close(): Promise<void> {
    this.isConnected = false;
    this.memory = null;
    await super.close();
  }
  
  /**
   * Helper methods
   */
  private convertMem0Results(mem0Data: any): MemoryItem[] {
    if (!mem0Data) return [];
    
    const results = Array.isArray(mem0Data) ? mem0Data : [mem0Data];
    
    return results.map(item => ({
      id: item.id || this.generateId(),
      content: item.memory || item.content || '',
      tier: item.metadata?.tier || 'session',
      userId: item.userId || this.config.userId,
      projectId: item.metadata?.projectId,
      teamId: item.metadata?.teamId,
      timestamp: item.metadata?.timestamp ? new Date(item.metadata.timestamp) : new Date(),
      metadata: item.metadata || {},
      tags: item.metadata?.tags || [],
      embedding: item.embedding,
      relationships: item.relationships,
      accessCount: item.metadata?.accessCount || 0,
      lastAccessed: item.metadata?.lastAccessed ? new Date(item.metadata.lastAccessed) : new Date()
    }));
  }
  
  private async getRelatedMemories(itemId: string, depth: number = 1): Promise<MemoryItem[]> {
    try {
      // This would use Mem0's graph memory features if available
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Failed to get related memories:', error);
      return [];
    }
  }
}

/**
 * Factory function to create Mem0 provider
 */
export async function createMem0Provider(config: Mem0Config): Promise<Mem0Provider | null> {
  try {
    const provider = new Mem0Provider(config);
    await provider.initialize();
    return provider;
  } catch (error) {
    console.error('Failed to create Mem0 provider:', error);
    return null;
  }
}