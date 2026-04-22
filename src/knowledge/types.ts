import type { MarketScope } from './loader.js';

/**
 * Memo loading mode
 * - 'none': Don't load any memos (default)
 * - 'summary': Load pre-generated summaries only
 * - 'latest': Load the N most recent memos
 * - 'full': Load all memos (with optional filtering)
 */
export type MemoMode = 'none' | 'summary' | 'latest' | 'full';

/**
 * Options for memo loading
 */
export interface MemoOptions {
  /** Loading mode */
  mode: MemoMode;
  /** Number of memos to load (for 'latest' mode) */
  count?: number;
  /** Filter by keywords (for 'full' mode) */
  keywords?: string[];
  /** Maximum tokens to allocate for memos */
  maxTokens?: number;
}

/**
 * Options for building system prompt
 */
export interface PromptOptions {
  /** Include foundation layer (books + shared principles). Default: true */
  includeFoundation?: boolean;
  /** Market scope for market-specific principles */
  market?: MarketScope;
  /** Memo loading options. Default: { mode: 'none' } */
  memos?: MemoOptions;
  /** Maximum total tokens for knowledge content */
  maxKnowledgeTokens?: number;
}

/**
 * Configuration for knowledge memory system
 */
export interface KnowledgeConfig {
  /** Layer control */
  layers: {
    core: boolean;
    foundation: boolean;
    market?: MarketScope;
    memos: MemoMode;
  };
  /** Memo filtering */
  memoFilter?: {
    keywords?: string[];
    count?: number;
    maxTokens?: number;
  };
  /** Cache configuration */
  cache: {
    enabled: boolean;
    ttlMs: number;
  };
}

/**
 * Cached entry structure
 */
export interface CachedEntry {
  /** Raw content */
  content: string;
  /** Entry metadata */
  metadata: {
    /** When the entry was cached (timestamp) */
    loadedAt: number;
    /** Approximate token count */
    tokenCount: number;
    /** Source file path */
    source: string;
  };
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of entries in cache */
  entries: number;
  /** Total cached content size in bytes */
  totalBytes: number;
  /** Total cached tokens (approximate) */
  totalTokens: number;
  /** Cache hit count */
  hits: number;
  /** Cache miss count */
  misses: number;
  /** Hit rate percentage */
  hitRate: number;
}

/**
 * Default memo options
 */
export const DEFAULT_MEMO_OPTIONS: MemoOptions = {
  mode: 'none',
};

/**
 * Default prompt options
 */
export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  includeFoundation: true,
  memos: DEFAULT_MEMO_OPTIONS,
};

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG = {
  enabled: true,
  ttlMs: 5 * 60 * 1000, // 5 minutes
};
