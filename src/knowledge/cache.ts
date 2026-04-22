import type { CachedEntry, CacheStats } from './types.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

class KnowledgeCache {
  private cache: Map<string, CachedEntry> = new Map();
  private ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(key: string): CachedEntry | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.metadata.loadedAt > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry;
  }

  set(key: string, content: string, source: string): void {
    const tokenCount = this.estimateTokens(content);
    
    this.cache.set(key, {
      content,
      metadata: {
        loadedAt: Date.now(),
        tokenCount,
        source,
      },
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  invalidate(pattern?: string): number {
    if (!pattern) {
      const size = this.cache.size;
      this.cache.clear();
      return size;
    }

    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    let totalBytes = 0;
    let totalTokens = 0;

    for (const entry of this.cache.values()) {
      totalBytes += entry.content.length;
      totalTokens += entry.metadata.tokenCount;
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      entries: this.cache.size,
      totalBytes,
      totalTokens,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }
}

let globalCache: KnowledgeCache | null = null;

export function getCache(ttlMs?: number): KnowledgeCache {
  if (!globalCache) {
    globalCache = new KnowledgeCache(ttlMs);
  }
  return globalCache;
}

export function clearCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
  globalCache = null;
}

export { KnowledgeCache };
