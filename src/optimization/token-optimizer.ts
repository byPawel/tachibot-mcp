/**
 * Token Optimizer - Caching, compression, and batching for token efficiency
 * Part of Phase 1B implementation for 70% cost reduction
 */

import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

export interface TokenRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, any>;
  canBatch?: boolean;
  cacheKey?: string;
}

export interface OptimizedRequest extends TokenRequest {
  optimized: boolean;
  compressed?: boolean;
  fromCache?: boolean;
  batchId?: string;
  originalLength?: number;
  compressedLength?: number;
}

export interface CachedResponse {
  response: string;
  timestamp: number;
  hits: number;
  model: string;
  tokenCount?: number;
}

interface BatchItem {
  request: TokenRequest;
  resolve: (value: OptimizedRequest) => void;
  reject: (error: any) => void;
}

export class TokenOptimizer {
  // LRU Cache for responses - 100MB max size, 1 hour TTL
  private responseCache: LRUCache<string, CachedResponse>;

  // Batch queue for request batching
  private batchQueue: BatchItem[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  // Configuration
  private readonly config = {
    cacheMaxSize: 100 * 1024 * 1024, // 100MB
    cacheTTL: 60 * 60 * 1000, // 1 hour
    batchWindow: 100, // ms to wait for batch
    maxBatchSize: 10, // max requests per batch
    compressionThreshold: 2000, // characters
    compressionModel: 'gemini-2.5-flash', // Ultra cheap for compression
  };

  // Metrics
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    tokensCompressed: 0,
    tokensSaved: 0,
    batchesProcessed: 0,
  };

  constructor() {
    this.responseCache = new LRUCache<string, CachedResponse>({
      max: 1000, // Max 1000 entries
      ttl: this.config.cacheTTL,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
  }

  /**
   * Generate cache key for a request
   */
  private generateCacheKey(request: TokenRequest): string {
    if (request.cacheKey) return request.cacheKey;

    const keyData = {
      prompt: request.prompt,
      model: request.model,
      temperature: request.temperature || 0.7,
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Check cache for existing response
   */
  private checkCache(request: TokenRequest): CachedResponse | null {
    const key = this.generateCacheKey(request);
    const cached = this.responseCache.get(key);

    if (cached) {
      this.metrics.cacheHits++;
      cached.hits++;
      return cached;
    }

    this.metrics.cacheMisses++;
    return null;
  }


  /**
   * Compress prompt using cheap model (simulated for now)
   */
  private async compressPrompt(prompt: string): Promise<string> {
    // In production, this would call the actual compression model
    // For now, we'll simulate compression by removing redundancy

    if (prompt.length < this.config.compressionThreshold) {
      return prompt;
    }

    // Simulated compression techniques:
    // 1. Remove excessive whitespace
    let compressed = prompt.replace(/\s+/g, ' ').trim();

    // 2. Remove duplicate sentences
    const sentences = compressed.split(/[.!?]+/);
    const uniqueSentences = [...new Set(sentences)];
    compressed = uniqueSentences.join('. ');

    // 3. Remove filler words (carefully)
    const fillerWords = /\b(very|really|actually|basically|literally|just)\b/gi;
    compressed = compressed.replace(fillerWords, '');

    // 4. Compress common patterns
    compressed = compressed
      .replace(/in order to/gi, 'to')
      .replace(/as well as/gi, 'and')
      .replace(/at this point in time/gi, 'now')
      .replace(/due to the fact that/gi, 'because');

    // Track compression
    this.metrics.tokensCompressed += prompt.length;
    this.metrics.tokensSaved += prompt.length - compressed.length;

    return compressed;
  }

  /**
   * Optimize a single request
   */
  async optimizeSingle(request: TokenRequest): Promise<OptimizedRequest> {
    // ⚠️ CACHE DISABLED - Caching removed for simplicity at MCP scale
    // Cache was causing bugs (storing inputs instead of outputs) and maintenance overhead
    // not justified for 10-50 runs/day. See: ultrathinking analysis 2025-10-18

    // // 1. Check cache first (DISABLED)
    // const cached = this.checkCache(request);
    // if (cached) {
    //   return {
    //     ...request,
    //     prompt: cached.response,
    //     optimized: true,
    //     fromCache: true,
    //   };
    // }

    // 2. Compress if needed
    const originalLength = request.prompt.length;
    let optimizedPrompt = request.prompt;

    if (originalLength > this.config.compressionThreshold) {
      optimizedPrompt = await this.compressPrompt(request.prompt);
    }

    return {
      ...request,
      prompt: optimizedPrompt,
      optimized: true,
      compressed: optimizedPrompt !== request.prompt,
      originalLength,
      compressedLength: optimizedPrompt.length,
    };
  }

  /**
   * Add request to batch queue
   */
  async addToBatch(request: TokenRequest): Promise<OptimizedRequest> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ request, resolve, reject });

      // Process immediately if batch is full
      if (this.batchQueue.length >= this.config.maxBatchSize) {
        this.processBatch();
      } else {
        // Otherwise wait for batch window
        if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => {
            this.processBatch();
          }, this.config.batchWindow);
        }
      }
    });
  }

  /**
   * Process batched requests
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Extract batch
    const batch = this.batchQueue.splice(0, this.config.maxBatchSize);
    const batchId = crypto.randomBytes(8).toString('hex');

    this.metrics.batchesProcessed++;

    // Process each request in batch
    for (const item of batch) {
      try {
        const optimized = await this.optimizeSingle(item.request);
        item.resolve({
          ...optimized,
          batchId,
        });
      } catch (error) {
        item.reject(error);
      }
    }
  }

  /**
   * Main optimization entry point
   */
  async optimize(request: TokenRequest): Promise<OptimizedRequest> {
    // Check if request can be batched
    if (request.canBatch && !this.checkCache(request)) {
      return this.addToBatch(request);
    }

    // Otherwise optimize individually
    return this.optimizeSingle(request);
  }

  /**
   * Get optimization metrics
   */
  getMetrics(): {
    cacheHitRate: number;
    compressionRatio: number;
    totalSaved: number;
    batchesProcessed: number;
    recommendations: string[];
  } {
    const cacheHitRate =
      this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;

    const compressionRatio =
      this.metrics.tokensSaved / this.metrics.tokensCompressed || 0;

    const recommendations: string[] = [];

    if (cacheHitRate < 0.3) {
      recommendations.push(`⚠️ Low cache hit rate (${(cacheHitRate * 100).toFixed(1)}%). Consider caching more aggressively.`);
    }

    if (compressionRatio < 0.2) {
      recommendations.push('💡 Compression ratio is low. Consider more aggressive compression.');
    }

    if (this.metrics.batchesProcessed < 10) {
      recommendations.push('📊 Low batch usage. Enable batching for parallel requests.');
    }

    if (cacheHitRate > 0.7) {
      recommendations.push('✅ Excellent cache performance!');
    }

    return {
      cacheHitRate,
      compressionRatio,
      totalSaved: this.metrics.tokensSaved,
      batchesProcessed: this.metrics.batchesProcessed,
      recommendations,
    };
  }

  /**
   * Clear cache if it gets too large
   */
  maintainCache(): void {
    if (this.responseCache.size > 900) {
      // Keep 80% of most recently used
      const toKeep = Math.floor(this.responseCache.size * 0.8);
      while (this.responseCache.size > toKeep) {
        const oldestKey = this.responseCache.keys().next().value;
        if (oldestKey) {
          this.responseCache.delete(oldestKey);
        } else {
          break;
        }
      }
    }
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      tokensCompressed: 0,
      tokensSaved: 0,
      batchesProcessed: 0,
    };
  }

  /**
   * Shutdown optimizer (cleanup)
   */
  shutdown(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.processBatch(); // Process any remaining batched requests
  }
}

// Export singleton instance
export const tokenOptimizer = new TokenOptimizer();