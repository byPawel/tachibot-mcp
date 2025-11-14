import * as crypto from 'crypto';

export interface CacheEntry {
  key: string;
  result: any;
  tokens: number;
  timestamp: number;
  hits: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memorySaved: number;
  tokensSaved: number;
}

export class ResultCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 1000;
  private ttl: number = 3600000; // 1 hour default
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(maxSize?: number, ttl?: number) {
    if (maxSize) this.maxSize = maxSize;
    if (ttl) this.ttl = ttl;
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  async get(key: string): Promise<any | null> {
    const hash = this.hashKey(key);
    const entry = this.cache.get(hash);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.ttl) {
      this.cache.delete(hash);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    return entry.result;
  }

  async set(key: string, value: any): Promise<void> {
    const hash = this.hashKey(key);
    
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(hash, {
      key: hash,
      result: value.result,
      tokens: value.tokens || 0,
      timestamp: value.timestamp || Date.now(),
      hits: 0,
      lastAccessed: Date.now()
    });
  }

  getStats(): CacheStats {
    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;
    const hitRate = totalHits / (totalHits + totalMisses) || 0;
    
    let tokensSaved = 0;
    let memorySaved = 0;
    
    for (const entry of this.cache.values()) {
      if (entry.hits > 0) {
        tokensSaved += entry.tokens * entry.hits;
        memorySaved += JSON.stringify(entry.result).length * entry.hits;
      }
    }

    return {
      totalEntries: this.cache.size,
      totalHits,
      totalMisses,
      hitRate,
      memorySaved,
      tokensSaved
    };
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  private evictLRU(): void {
    let oldest: CacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (!oldest || entry.lastAccessed < oldest.lastAccessed) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }
}