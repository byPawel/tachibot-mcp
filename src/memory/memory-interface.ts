/**
 * Memory Provider Interface
 * Common interface for all memory providers (mem0, DevLog, local, etc.)
 */

import { 
  MemoryItem, 
  MemoryQuery, 
  ContextQuery, 
  ContextualMemory,
  MemoryMetrics,
  MemoryTier
} from './memory-config.js';

/**
 * Base interface for all memory providers
 */
export interface IMemoryProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;
  
  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;
  
  /**
   * Store a memory item
   */
  store(item: MemoryItem): Promise<string>; // Returns item ID
  
  /**
   * Store multiple items in batch
   */
  storeBatch(items: MemoryItem[]): Promise<string[]>;
  
  /**
   * Retrieve memories based on query
   */
  retrieve(query: MemoryQuery): Promise<MemoryItem[]>;
  
  /**
   * Retrieve contextual memories with synthesis
   */
  retrieveContext(query: ContextQuery): Promise<ContextualMemory>;
  
  /**
   * Update an existing memory item
   */
  update(id: string, updates: Partial<MemoryItem>): Promise<boolean>;
  
  /**
   * Delete a memory item
   */
  delete(id: string): Promise<boolean>;
  
  /**
   * Delete memories matching query
   */
  deleteMany(query: MemoryQuery): Promise<number>; // Returns count deleted
  
  /**
   * Search memories using semantic similarity
   */
  semanticSearch?(text: string, limit?: number, threshold?: number): Promise<MemoryItem[]>;
  
  /**
   * Get related memories using graph relationships
   */
  getRelated?(itemId: string, depth?: number): Promise<MemoryItem[]>;
  
  /**
   * Clean up expired memories
   */
  cleanup(): Promise<number>; // Returns count cleaned
  
  /**
   * Get provider metrics
   */
  getMetrics(): Promise<MemoryMetrics>;
  
  /**
   * Export all memories (for backup/migration)
   */
  export(): Promise<MemoryItem[]>;
  
  /**
   * Import memories (for restore/migration)
   */
  import(items: MemoryItem[]): Promise<number>; // Returns count imported
  
  /**
   * Check if provider is available/connected
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Close/cleanup provider resources
   */
  close(): Promise<void>;
}

/**
 * Abstract base class for memory providers with common functionality
 */
export abstract class BaseMemoryProvider implements IMemoryProvider {
  abstract readonly name: string;
  protected initialized: boolean = false;
  protected metrics: MemoryMetrics = {
    totalItems: 0,
    itemsByTier: {
      session: 0,
      working: 0,
      project: 0,
      team: 0,
      global: 0
    },
    totalTokens: 0,
    avgRetrievalTime: 0,
    hitRate: 0,
    storageUsedMB: 0
  };
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.doInitialize();
    this.initialized = true;
  }
  
  protected abstract doInitialize(): Promise<void>;
  
  abstract store(item: MemoryItem): Promise<string>;
  
  async storeBatch(items: MemoryItem[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      const id = await this.store(item);
      ids.push(id);
    }
    return ids;
  }
  
  abstract retrieve(query: MemoryQuery): Promise<MemoryItem[]>;
  
  async retrieveContext(query: ContextQuery): Promise<ContextualMemory> {
    // Default implementation - can be overridden
    const items = await this.retrieve(query);
    
    // Apply priority weights if specified
    if (query.priorityWeights) {
      items.sort((a, b) => {
        const scoreA = this.calculatePriorityScore(a, query.priorityWeights!);
        const scoreB = this.calculatePriorityScore(b, query.priorityWeights!);
        return scoreB - scoreA;
      });
    }
    
    // Limit by context window if specified
    let selectedItems = items;
    if (query.contextWindow) {
      selectedItems = this.limitByTokens(items, query.contextWindow);
    }
    
    // Calculate source distribution
    const sources = {
      session: 0,
      working: 0,
      project: 0,
      team: 0,
      global: 0
    };
    
    selectedItems.forEach(item => {
      sources[item.tier]++;
    });
    
    return {
      items: selectedItems,
      synthesis: this.synthesizeItems(selectedItems),
      relevanceScore: this.calculateRelevanceScore(selectedItems, query),
      tokenCount: this.estimateTokenCount(selectedItems),
      sources
    };
  }
  
  abstract update(id: string, updates: Partial<MemoryItem>): Promise<boolean>;
  abstract delete(id: string): Promise<boolean>;
  
  async deleteMany(query: MemoryQuery): Promise<number> {
    const items = await this.retrieve(query);
    let deleted = 0;
    for (const item of items) {
      if (await this.delete(item.id)) {
        deleted++;
      }
    }
    return deleted;
  }
  
  async cleanup(): Promise<number> {
    // Default implementation - remove expired items
    const now = new Date();
    let cleaned = 0;
    
    // This would need to be implemented based on storage backend
    // For now, return 0
    return cleaned;
  }
  
  async getMetrics(): Promise<MemoryMetrics> {
    return { ...this.metrics };
  }
  
  abstract export(): Promise<MemoryItem[]>;
  abstract import(items: MemoryItem[]): Promise<number>;
  
  async isAvailable(): Promise<boolean> {
    return this.initialized;
  }
  
  async close(): Promise<void> {
    this.initialized = false;
  }
  
  /**
   * Helper methods
   */
  protected calculatePriorityScore(
    item: MemoryItem, 
    weights: { recency: number; relevance: number; frequency: number }
  ): number {
    const now = Date.now();
    const age = now - item.timestamp.getTime();
    const recencyScore = Math.exp(-age / (1000 * 60 * 60 * 24)); // Decay over days
    
    const frequencyScore = Math.min(1, (item.accessCount || 0) / 10);
    
    // Relevance would need to be calculated based on query
    const relevanceScore = 0.5; // Default middle value
    
    return (
      weights.recency * recencyScore +
      weights.relevance * relevanceScore +
      weights.frequency * frequencyScore
    );
  }
  
  protected limitByTokens(items: MemoryItem[], maxTokens: number): MemoryItem[] {
    const selected: MemoryItem[] = [];
    let totalTokens = 0;
    
    for (const item of items) {
      const itemTokens = this.estimateTokens(item.content);
      if (totalTokens + itemTokens <= maxTokens) {
        selected.push(item);
        totalTokens += itemTokens;
      } else {
        break;
      }
    }
    
    return selected;
  }
  
  protected synthesizeItems(items: MemoryItem[]): string {
    if (items.length === 0) return '';
    
    // Group by tier
    const byTier: Record<MemoryTier, MemoryItem[]> = {
      session: [],
      working: [],
      project: [],
      team: [],
      global: []
    };
    
    items.forEach(item => {
      byTier[item.tier].push(item);
    });
    
    // Create synthesis
    const parts: string[] = [];
    
    if (byTier.session.length > 0) {
      parts.push(`Recent context: ${byTier.session.map(i => i.content).join('; ')}`);
    }
    if (byTier.project.length > 0) {
      parts.push(`Project context: ${byTier.project.map(i => i.content).join('; ')}`);
    }
    
    return parts.join('\n');
  }
  
  protected calculateRelevanceScore(items: MemoryItem[], query: ContextQuery): number {
    if (items.length === 0) return 0;
    
    // Simple implementation - can be enhanced
    return Math.min(1, items.length / 10);
  }
  
  protected estimateTokenCount(items: MemoryItem[]): number {
    return items.reduce((sum, item) => sum + this.estimateTokens(item.content), 0);
  }
  
  protected estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}