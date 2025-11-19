/**
 * Hierarchical Memory Manager
 * Orchestrates multiple memory providers and manages tier-based memory hierarchy
 */

import { 
  MemoryConfig, 
  MemoryItem, 
  MemoryQuery, 
  ContextQuery,
  ContextualMemory,
  MemoryMetrics,
  MemoryTier,
  mergeMemoryConfig,
  validateMemoryConfig
} from './memory-config.js';
import { IMemoryProvider } from './memory-interface.js';
import { LocalProvider } from './providers/local-provider.js';
import { Mem0Provider } from './providers/mem0-provider.js';
import { randomBytes } from 'crypto';
// import { DevLogProvider } from './providers/devlog-provider.js';
// import { HybridProvider } from './providers/hybrid-provider.js';

/**
 * Main memory manager that coordinates all providers
 */
export class HierarchicalMemoryManager {
  private config: MemoryConfig;
  private provider: IMemoryProvider | null = null;
  private sessionId: string;
  private projectId?: string;
  private userId?: string;
  private teamId?: string;
  
  // Tier-based cleanup intervals
  private cleanupIntervals: Map<MemoryTier, NodeJS.Timeout> = new Map();
  
  constructor(userConfig?: Partial<MemoryConfig>) {
    this.config = mergeMemoryConfig(userConfig || {});
    this.sessionId = this.generateSessionId();
    
    // Validate configuration
    const validation = validateMemoryConfig(this.config);
    if (!validation.valid) {
      console.error('Invalid memory configuration:', validation.errors);
      // Fall back to local provider
      this.config.provider = 'local';
    }
  }
  
  /**
   * Initialize the memory manager and selected provider
   */
  async initialize(): Promise<void> {
    console.error(`🧠 Initializing memory manager with ${this.config.provider} provider...`);
    
    try {
      // Create the appropriate provider
      this.provider = await this.createProvider();
      
      if (!this.provider) {
        console.warn('Failed to create primary provider, falling back to local storage');
        this.config.provider = 'local';
        this.provider = await this.createLocalProvider();
      }
      
      // Set up automatic cleanup for each tier
      if (this.config.enableAutoCleanup) {
        this.setupAutoCleanup();
      }
      
      console.error(`✅ Memory manager initialized with ${this.provider.name} provider`);
    } catch (error) {
      console.error('Failed to initialize memory manager:', error);
      throw error;
    }
  }
  
  /**
   * Store a memory item with automatic tier assignment
   */
  async store(
    content: string,
    tier?: MemoryTier,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    // Auto-assign tier based on context if not provided
    if (!tier) {
      tier = this.inferTier(content, metadata);
    }
    
    // Check if tier is enabled
    if (!this.config.tiers[tier]) {
      console.warn(`Tier ${tier} is disabled, upgrading to next available tier`);
      const nextTier = this.getNextAvailableTier(tier);
      if (!nextTier) {
        throw new Error('No memory tiers are enabled');
      }
      tier = nextTier;
    }
    
    const item: MemoryItem = {
      id: this.generateId(),
      content,
      tier,
      userId: this.userId,
      projectId: this.projectId,
      teamId: this.teamId,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        sessionId: this.sessionId
      },
      ttl: this.config.ttlMinutes?.[tier]
    };
    
    return await this.provider.store(item);
  }
  
  /**
   * Retrieve memories with hierarchical context
   */
  async retrieve(query?: Partial<MemoryQuery>): Promise<MemoryItem[]> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    // Build query with defaults
    const fullQuery: MemoryQuery = {
      userId: query?.userId || this.userId,
      projectId: query?.projectId || this.projectId,
      teamId: query?.teamId || this.teamId,
      tiers: query?.tiers || this.getEnabledTiers(),
      ...query
    };
    
    return await this.provider.retrieve(fullQuery);
  }
  
  /**
   * Get contextual memories with synthesis
   */
  async getContext(
    text: string,
    maxTokens?: number,
    options?: Partial<ContextQuery>
  ): Promise<ContextualMemory> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    const query: ContextQuery = {
      text,
      userId: this.userId,
      projectId: this.projectId,
      teamId: this.teamId,
      tiers: this.getEnabledTiers(),
      contextWindow: maxTokens || 2000,
      priorityWeights: {
        recency: 0.4,
        relevance: 0.5,
        frequency: 0.1,
        ...options?.priorityWeights
      },
      ...options
    };
    
    return await this.provider.retrieveContext(query);
  }
  
  /**
   * Promote memory to higher tier
   */
  async promote(itemId: string, newTier: MemoryTier): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    // Check if new tier is enabled
    if (!this.config.tiers[newTier]) {
      console.warn(`Cannot promote to disabled tier ${newTier}`);
      return false;
    }
    
    return await this.provider.update(itemId, { 
      tier: newTier,
      ttl: this.config.ttlMinutes?.[newTier]
    });
  }
  
  /**
   * Clean up expired memories
   */
  async cleanup(): Promise<number> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    return await this.provider.cleanup();
  }
  
  /**
   * Get memory metrics
   */
  async getMetrics(): Promise<MemoryMetrics> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    return await this.provider.getMetrics();
  }
  
  /**
   * Semantic search across memories
   */
  async search(text: string, limit?: number): Promise<MemoryItem[]> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    // Use semantic search if available
    if (this.provider.semanticSearch) {
      return await this.provider.semanticSearch(text, limit);
    }
    
    // Fall back to text-based search
    return await this.retrieve({ text, limit });
  }
  
  /**
   * Export all memories
   */
  async export(): Promise<MemoryItem[]> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    return await this.provider.export();
  }
  
  /**
   * Import memories
   */
  async import(items: MemoryItem[]): Promise<number> {
    if (!this.provider) {
      throw new Error('Memory manager not initialized');
    }
    
    return await this.provider.import(items);
  }
  
  /**
   * Set context (project, user, team)
   */
  setContext(context: {
    projectId?: string;
    userId?: string;
    teamId?: string;
  }): void {
    if (context.projectId) this.projectId = context.projectId;
    if (context.userId) this.userId = context.userId;
    if (context.teamId) this.teamId = context.teamId;
  }
  
  /**
   * Start a new session
   */
  newSession(): string {
    this.sessionId = this.generateSessionId();
    return this.sessionId;
  }
  
  /**
   * Close and cleanup
   */
  async close(): Promise<void> {
    // Clear cleanup intervals
    this.cleanupIntervals.forEach(interval => clearInterval(interval));
    this.cleanupIntervals.clear();
    
    // Close provider
    if (this.provider) {
      await this.provider.close();
      this.provider = null;
    }
  }
  
  /**
   * Private helper methods
   */
  private async createProvider(): Promise<IMemoryProvider | null> {
    switch (this.config.provider) {
      case 'mem0':
        if (!this.config.mem0) {
          console.error('Mem0 configuration missing');
          return null;
        }
        try {
          const provider = new Mem0Provider(this.config.mem0);
          await provider.initialize();
          return provider;
        } catch (error) {
          console.error('Failed to create Mem0 provider:', error);
          return null;
        }
      
      case 'devlog':
        // TODO: Implement DevLog provider
        console.warn('DevLog provider not yet implemented');
        return null;
      
      case 'local':
        return await this.createLocalProvider();
      
      case 'hybrid':
        // TODO: Implement Hybrid provider
        console.warn('Hybrid provider not yet implemented');
        return null;
      
      case 'none':
        return null;
      
      default:
        console.warn(`Unknown provider: ${this.config.provider}`);
        return null;
    }
  }
  
  private async createLocalProvider(): Promise<IMemoryProvider> {
    const provider = new LocalProvider(
      this.config.local || {
        storageType: 'json',
        path: './.focus-memory',
        maxSizeMB: 100
      }
    );
    await provider.initialize();
    return provider;
  }
  
  private inferTier(content: string, metadata?: Record<string, any>): MemoryTier {
    // Infer based on content and metadata
    if (metadata?.tier) return metadata.tier as MemoryTier;
    
    // Default heuristics
    const contentLength = content.length;
    const hasCode = /```[\s\S]*?```/.test(content);
    const hasImportantKeywords = /critical|important|remember|always|never/i.test(content);
    
    if (hasImportantKeywords && this.config.tiers.project) {
      return 'project';
    }
    
    if (hasCode && this.config.tiers.working) {
      return 'working';
    }
    
    if (contentLength > 500 && this.config.tiers.working) {
      return 'working';
    }
    
    return 'session';
  }
  
  private getNextAvailableTier(tier: MemoryTier): MemoryTier | null {
    const tierOrder: MemoryTier[] = ['session', 'working', 'project', 'team', 'global'];
    const currentIndex = tierOrder.indexOf(tier);
    
    for (let i = currentIndex + 1; i < tierOrder.length; i++) {
      if (this.config.tiers[tierOrder[i]]) {
        return tierOrder[i];
      }
    }
    
    // Try lower tiers
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (this.config.tiers[tierOrder[i]]) {
        return tierOrder[i];
      }
    }
    
    return null;
  }
  
  private getEnabledTiers(): MemoryTier[] {
    const tiers: MemoryTier[] = [];
    const allTiers: MemoryTier[] = ['session', 'working', 'project', 'team', 'global'];
    
    allTiers.forEach(tier => {
      if (this.config.tiers[tier]) {
        tiers.push(tier);
      }
    });
    
    return tiers;
  }
  
  private setupAutoCleanup(): void {
    const tiers: MemoryTier[] = ['session', 'working', 'project', 'team', 'global'];
    
    tiers.forEach(tier => {
      if (this.config.tiers[tier] && this.config.ttlMinutes?.[tier]) {
        const ttl = this.config.ttlMinutes[tier];
        if (ttl > 0) {
          // Run cleanup at 1/4 of TTL interval
          const interval = Math.max(60000, (ttl * 60 * 1000) / 4); // Min 1 minute
          
          const intervalId = setInterval(async () => {
            try {
              await this.cleanupTier(tier);
            } catch (error) {
              console.error(`Failed to cleanup ${tier} tier:`, error);
            }
          }, interval);
          
          this.cleanupIntervals.set(tier, intervalId);
        }
      }
    });
  }
  
  private async cleanupTier(tier: MemoryTier): Promise<void> {
    if (!this.provider) return;
    
    const ttl = this.config.ttlMinutes?.[tier];
    if (!ttl || ttl <= 0) return;
    
    const cutoffDate = new Date(Date.now() - (ttl * 60 * 1000));
    
    const query: MemoryQuery = {
      tiers: [tier],
      endDate: cutoffDate
    };
    
    const deleted = await this.provider.deleteMany(query);
    if (deleted > 0) {
      console.error(`🗑️ Cleaned up ${deleted} expired ${tier} memories`);
    }
  }
  
  private generateId(): string {
    return `${Date.now()}-${randomBytes(6).toString('hex')}`;
  }
  
  private generateSessionId(): string {
    return `session-${Date.now()}-${randomBytes(6).toString('hex')}`;
  }
}

/**
 * Singleton instance
 */
let memoryManager: HierarchicalMemoryManager | null = null;

/**
 * Get or create memory manager instance
 */
export async function getMemoryManager(
  config?: Partial<MemoryConfig>
): Promise<HierarchicalMemoryManager> {
  if (!memoryManager) {
    memoryManager = new HierarchicalMemoryManager(config);
    await memoryManager.initialize();
  }
  return memoryManager;
}

/**
 * Reset memory manager (useful for testing)
 */
export async function resetMemoryManager(): Promise<void> {
  if (memoryManager) {
    await memoryManager.close();
    memoryManager = null;
  }
}