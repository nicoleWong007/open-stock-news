import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeCache, getCache, clearCache } from '@/knowledge/cache.js';

describe('KnowledgeCache', () => {
  let cache: KnowledgeCache;

  beforeEach(() => {
    cache = new KnowledgeCache(1000);
  });

  afterEach(() => {
    cache.clear();
  });

  describe('get and set', () => {
    it('stores and retrieves content', () => {
      cache.set('test-key', 'test content', '/path/to/file.md');
      const entry = cache.get('test-key');
      expect(entry).not.toBeNull();
      expect(entry?.content).toBe('test content');
    });

    it('returns null for missing keys', () => {
      const entry = cache.get('nonexistent');
      expect(entry).toBeNull();
    });

    it('tracks metadata', () => {
      cache.set('test-key', 'test content', '/path/to/file.md');
      const entry = cache.get('test-key');
      expect(entry?.metadata.source).toBe('/path/to/file.md');
      expect(entry?.metadata.tokenCount).toBeGreaterThan(0);
      expect(entry?.metadata.loadedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('TTL expiration', () => {
    it('returns null after TTL expires', async () => {
      const shortCache = new KnowledgeCache(10);
      shortCache.set('test-key', 'test content', '/path/to/file.md');
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const entry = shortCache.get('test-key');
      expect(entry).toBeNull();
    });

    it('returns content before TTL expires', () => {
      cache.set('test-key', 'test content', '/path/to/file.md');
      const entry = cache.get('test-key');
      expect(entry).not.toBeNull();
    });
  });

  describe('invalidate', () => {
    it('clears all entries when no pattern provided', () => {
      cache.set('key1', 'content1', '/path/1');
      cache.set('key2', 'content2', '/path/2');
      
      const deleted = cache.invalidate();
      
      expect(deleted).toBe(2);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('clears matching entries with pattern', () => {
      cache.set('memo/first', 'content1', '/path/1');
      cache.set('memo/second', 'content2', '/path/2');
      cache.set('book/first', 'content3', '/path/3');
      
      const deleted = cache.invalidate('memo/');
      
      expect(deleted).toBe(2);
      expect(cache.get('memo/first')).toBeNull();
      expect(cache.get('memo/second')).toBeNull();
      expect(cache.get('book/first')).not.toBeNull();
    });
  });

  describe('getStats', () => {
    it('reports correct statistics', () => {
      cache.set('key1', 'content1', '/path/1');
      cache.set('key2', 'longer content here', '/path/2');
      
      cache.get('key1');
      cache.get('key1');
      cache.get('nonexistent');
      
      const stats = cache.getStats();
      
      expect(stats.entries).toBe(2);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.totalBytes).toBe('content1'.length + 'longer content here'.length);
    });
  });

  describe('has', () => {
    it('returns true for existing entries', () => {
      cache.set('test-key', 'content', '/path');
      expect(cache.has('test-key')).toBe(true);
    });

    it('returns false for missing entries', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes specific entry', () => {
      cache.set('test-key', 'content', '/path');
      expect(cache.has('test-key')).toBe(true);
      
      cache.delete('test-key');
      
      expect(cache.has('test-key')).toBe(false);
    });
  });
});

describe('Global cache functions', () => {
  afterEach(() => {
    clearCache();
  });

  it('returns singleton cache', () => {
    const cache1 = getCache();
    const cache2 = getCache();
    expect(cache1).toBe(cache2);
  });

  it('clears and recreates cache', () => {
    const cache1 = getCache();
    cache1.set('test', 'content', '/path');
    
    clearCache();
    
    const cache2 = getCache();
    expect(cache2.has('test')).toBe(false);
  });
});
