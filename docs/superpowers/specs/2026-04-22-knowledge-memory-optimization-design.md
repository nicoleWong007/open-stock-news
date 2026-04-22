# Knowledge Memory Optimization Design

## Problem Statement

The `oak-invest` CLI agent loads the entire knowledge base into the system prompt on every request:

| Category | Size | Tokens | Current Behavior |
|----------|------|--------|------------------|
| **Memos** | 363KB | ~90,000 | ALL loaded every request |
| Books | 13KB | ~3,000 | All loaded |
| Principles | 15KB | ~4,000 | All loaded |
| Maxims | ~1KB | ~250 | All loaded |
| **Total** | ~420KB | ~100,000 | No filtering, no caching |

### Root Causes

1. **No Selective Loading** - `prompt-builder.ts` loads all knowledge unconditionally
2. **No Caching** - `loader.ts` reads from disk on every `loadKnowledge()` call
3. **No Token Budget** - No limit on knowledge context size
4. **Memos Overload** - Memos consume 90%+ of token budget but are rarely needed for most operations

### Impact

- **Wasted tokens**: ~90K tokens loaded for memos that may not be relevant
- **Slower response**: Large context increases latency
- **Limited scalability**: Adding more memos will hit context limits
- **Higher cost**: More tokens = higher API costs

## Solution Overview

Implement a **Layered Memory Architecture** with:

1. **Tiered Loading** - Load knowledge in layers based on necessity
2. **In-Memory Caching** - Cache loaded knowledge across calls
3. **On-Demand Retrieval** - Load memos only when explicitly requested
4. **Summary Mode** - Pre-generated summaries for large content

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    KnowledgeMemory (新模块)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Cache     │  │   Loader    │  │   PromptBuilder         │ │
│  │   Manager   │  │   (分层)     │  │   (选项化)              │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │              │
│         ▼                ▼                      ▼              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Memory Layers                          │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │  Layer 0: Core (always loaded)                            │ │
│  │  ├── identity.md (~300 tokens)                            │ │
│  │  ├── maxims.md (~250 tokens)                              │ │
│  │  └── decision-matrix.md (~800 tokens)                     │ │
│  │  Total: ~1.5K tokens                                      │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │  Layer 1: Foundation (loaded by default)                  │ │
│  │  ├── books/*.md (~3K tokens)                              │ │
│  │  └── principles/shared/*.md (~4K tokens)                  │ │
│  │  Total: ~7K tokens                                        │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │  Layer 2: Market-Specific (loaded by market param)        │ │
│  │  └── principles/{us,a_share,hk}/*.md (~1-2K each)         │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │  Layer 3: Dynamic (on-demand only)                        │ │
│  │  ├── memos/*.md (~90K tokens full)                        │ │
│  │  └── memo-summaries.json (~5K tokens)                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### KnowledgeConfig

```typescript
interface KnowledgeConfig {
  // Layer control
  layers: {
    core: boolean;        // Layer 0 - always true
    foundation: boolean;  // Layer 1 - default true
    market?: Market;      // Layer 2 - optional
    memos: boolean | 'summary' | 'latest' | number;  // Layer 3
  };
  
  // Memo filtering
  memoFilter?: {
    keywords?: string[];
    themes?: string[];
    fromDate?: string;
    toDate?: string;
    maxTokens?: number;
  };
  
  // Caching
  cache: {
    enabled: boolean;
    ttlMs: number;  // Time-to-live in milliseconds
  };
}
```

### MemoIndex (Enhanced)

```typescript
interface MemoEntry {
  slug: string;
  title: string;
  date: string;
  url: string;
  rssGuid: string;
  fetchedAt: string;
  
  // NEW: For summary mode
  summary: string;           // 3-5 sentence summary
  keyThemes: string[];       // e.g., ["bubble", "valuation"]
  keyQuotes: string[];       // 3-5 memorable quotes
  tokenCount: number;        // Approximate token count
}

interface MemoIndex {
  lastChecked: string;
  memos: MemoEntry[];
  
  // NEW: Index metadata
  metadata: {
    totalTokens: number;
    lastSummarized: string;
    summaryVersion: string;
  };
}
```

## Core Components

### 1. KnowledgeCache

**Location**: `src/knowledge/cache.ts`

**Purpose**: In-memory cache to avoid repeated disk reads

```typescript
class KnowledgeCache {
  private cache: Map<string, CachedEntry> = new Map();
  private config: CacheConfig;
  
  get(key: string): CachedEntry | null;
  set(key: string, content: string, metadata: EntryMetadata): void;
  invalidate(pattern?: string): void;
  getStats(): CacheStats;
}

interface CachedEntry {
  content: string;
  metadata: {
    loadedAt: number;
    tokenCount: number;
    source: string;
  };
}
```

**Caching Strategy**:
- Cache raw file content (not parsed)
- Use file path as key
- TTL-based expiration (default 5 minutes)
- Manual invalidation on memo updates

### 2. LayeredLoader

**Location**: `src/knowledge/layered-loader.ts`

**Purpose**: Load knowledge by layer with caching

```typescript
class LayeredLoader {
  private cache: KnowledgeCache;
  
  // Load all layers based on config
  async loadLayers(config: KnowledgeConfig): Promise<LoadedKnowledge>;
  
  // Load specific layer
  async loadLayer(layer: number, config: KnowledgeConfig): Promise<string>;
  
  // Get memos with filtering
  async loadMemos(options: MemoLoadOptions): Promise<string>;
}

interface LoadedKnowledge {
  core: string;          // Layer 0 content
  foundation?: string;   // Layer 1 content
  market?: string;       // Layer 2 content
  memos?: string;        // Layer 3 content (filtered)
}
```

### 3. MemoSummarizer

**Location**: `src/knowledge/memo-summarizer.ts`

**Purpose**: Generate and manage memo summaries

```typescript
class MemoSummarizer {
  // Generate summary for a single memo
  async summarizeMemo(content: string): Promise<MemoSummary>;
  
  // Update index.json with summaries
  async updateSummaries(): Promise<void>;
  
  // Get summary content for prompt
  getSummaryContent(memos: MemoEntry[]): string;
}

interface MemoSummary {
  summary: string;       // 3-5 sentences
  keyThemes: string[];   // 3-5 themes
  keyQuotes: string[];   // 3-5 quotes
}
```

### 4. Enhanced PromptBuilder

**Location**: `src/knowledge/prompt-builder.ts` (modified)

**Purpose**: Build system prompt with options

```typescript
interface PromptOptions {
  // What to include
  includeFoundation?: boolean;     // Layer 1, default true
  market?: MarketScope;            // Layer 2
  
  // Memo options
  memos?: {
    mode: 'none' | 'summary' | 'latest' | 'full';
    count?: number;                // For 'latest' mode
    keywords?: string[];           // Filter by keywords
    maxTokens?: number;            // Token budget
  };
  
  // Advanced
  maxKnowledgeTokens?: number;     // Total token budget
  marketContext?: string;          // Runtime context
}

function buildSystemPrompt(
  marketContext?: string, 
  options?: PromptOptions
): string;
```

## File Structure

```
src/knowledge/
├── cache.ts                    # NEW: In-memory cache
├── layered-loader.ts           # NEW: Layered loading
├── memo-summarizer.ts          # NEW: Summary generation
├── loader.ts                   # Modified: Use cache
├── prompt-builder.ts           # Modified: Options-based
├── types.ts                    # NEW: Type definitions
└── __tests__/
    ├── cache.test.ts
    ├── layered-loader.test.ts
    ├── memo-summarizer.test.ts
    └── prompt-builder.test.ts

knowledge/
├── memos/
│   ├── index.json              # Enhanced with summaries
│   └── *.md
├── core/                       # NEW: Core layer files
│   └── identity.md
└── ...

src/commands/
├── analyze.ts                  # Modified: Pass options
├── cycle-check.ts              # Modified: Pass options
└── chat.ts                     # Modified: Pass options
```

## Data Flow

### Before Optimization

```
User Request
    │
    ▼
buildSystemPrompt()
    │
    ▼
loadKnowledge() ──────────────────────┐
    │                                  │
    ▼                                  ▼
Read ALL files from disk         Load ALL content
    │                                  │
    └──────────────────────────────────┘
                    │
                    ▼
            Concatenate all
                    │
                    ▼
            100K+ token prompt
```

### After Optimization

```
User Request + Options
    │
    ▼
buildSystemPrompt(options)
    │
    ▼
LayeredLoader.loadLayers(config)
    │
    ├──▶ Layer 0 (Core): Cache hit or load (~1.5K tokens)
    │
    ├──▶ Layer 1 (Foundation): Cache hit or load (~7K tokens)
    │
    ├──▶ Layer 2 (Market): Load if market specified
    │
    └──▶ Layer 3 (Memos): 
         │
         ├── mode='none' → Skip
         ├── mode='summary' → Load summaries (~5K tokens)
         ├── mode='latest' → Load last N memos
         └── mode='full' → Load all (with token budget)
    │
    ▼
Assemble prompt (~8-15K tokens default)
```

## Implementation Phases

### Phase 1: Foundation (Day 1-2)

**Goal**: Reduce default token consumption by 90%

**Tasks**:
1. Create `KnowledgeCache` class
2. Modify `loader.ts` to use cache
3. Add `PromptOptions` interface
4. Modify `prompt-builder.ts`:
   - Add options parameter
   - Default memos to 'none'
   - Support 'latest' mode
5. Update command files to pass appropriate options
6. Add unit tests

**Deliverables**:
- `src/knowledge/cache.ts`
- Modified `src/knowledge/loader.ts`
- Modified `src/knowledge/prompt-builder.ts`
- `src/knowledge/types.ts`
- Tests

**Expected Result**:
- Default prompt: ~10K tokens (down from ~100K)
- Memos loadable via `memos: { mode: 'full' }`

### Phase 2: Summaries (Week 1)

**Goal**: Enable efficient memo access with summaries

**Tasks**:
1. Create `MemoSummarizer` class
2. Add summary generation to `update-memos init` command
3. Enhance `index.json` schema with summaries
4. Add `mode: 'summary'` support in prompt-builder
5. Add keyword filtering for memos
6. Update tests

**Deliverables**:
- `src/knowledge/memo-summarizer.ts`
- Enhanced `knowledge/memos/index.json`
- Modified `src/commands/update-memos.ts`
- Updated `src/knowledge/prompt-builder.ts`
- Tests

**Expected Result**:
- Summary mode: ~5K tokens for all memos
- Keyword filtering: Load only relevant memos

### Phase 3: Advanced Retrieval (Week 2-4, Optional)

**Goal**: Enable semantic search and RAG

**Tasks**:
1. Add vector embedding support (OpenAI embeddings or local)
2. Create vector index for memo chunks
3. Implement semantic search in `LayeredLoader`
4. Add token budget manager
5. Performance optimization

**Deliverables**:
- `src/knowledge/embeddings.ts`
- `src/knowledge/vector-store.ts`
- `src/knowledge/token-budget.ts`
- Vector index files

**Expected Result**:
- Semantic retrieval: Load only relevant passages
- Token budget enforcement: Never exceed budget

## API Changes

### buildSystemPrompt()

**Before**:
```typescript
function buildSystemPrompt(
  marketContext?: string, 
  market?: MarketScope
): string;
```

**After**:
```typescript
interface PromptOptions {
  includeFoundation?: boolean;
  market?: MarketScope;
  memos?: {
    mode: 'none' | 'summary' | 'latest' | 'full';
    count?: number;
    keywords?: string[];
    maxTokens?: number;
  };
  maxKnowledgeTokens?: number;
  marketContext?: string;
}

function buildSystemPrompt(
  marketContext?: string,
  options?: PromptOptions
): string;
```

### Usage Examples

```typescript
// Default: Core + Foundation only (~10K tokens)
buildSystemPrompt();

// With market-specific principles
buildSystemPrompt(marketData, { market: 'us' });

// With latest 3 memos
buildSystemPrompt(marketData, { 
  memos: { mode: 'latest', count: 3 } 
});

// With memo summaries
buildSystemPrompt(marketData, { 
  memos: { mode: 'summary' } 
});

// With keyword-filtered memos
buildSystemPrompt(marketData, { 
  memos: { 
    mode: 'full', 
    keywords: ['bubble', 'valuation'],
    maxTokens: 20000 
  } 
});

// Minimal: Core only
buildSystemPrompt(marketData, { 
  includeFoundation: false,
  memos: { mode: 'none' } 
});
```

## CLI Integration

### analyze command

```typescript
// Default: Foundation + market-specific, no memos
const prompt = buildSystemPrompt(marketContext, { 
  market: detectedMarket,
  memos: { mode: 'none' }
});
```

### cycle-check command

```typescript
// Cycle-focused: Include cycle-related memos
const prompt = buildSystemPrompt(marketContext, { 
  memos: { 
    mode: 'summary',
    keywords: ['cycle', 'pendulum'] 
  } 
});
```

### chat command (Phase 3)

```typescript
// Interactive: Allow dynamic memo loading
// Based on conversation context
const prompt = buildSystemPrompt(context, { 
  memos: { 
    mode: 'summary',
    keywords: extractedKeywords 
  } 
});
```

## Error Handling

1. **Cache miss**: Load from disk, cache result
2. **File not found**: Log warning, return empty string for that layer
3. **Summary not available**: Fall back to full memo loading
4. **Token budget exceeded**: Truncate from least important layer
5. **Invalid options**: Use defaults with warning

## Testing Strategy

### Unit Tests

```typescript
// cache.test.ts
describe('KnowledgeCache', () => {
  it('should cache and retrieve content');
  it('should respect TTL');
  it('should invalidate by pattern');
  it('should report stats');
});

// layered-loader.test.ts
describe('LayeredLoader', () => {
  it('should load Layer 0 always');
  it('should skip Layer 1 when disabled');
  it('should load market-specific layer');
  it('should not load memos by default');
  it('should load memos when enabled');
});

// prompt-builder.test.ts
describe('buildSystemPrompt', () => {
  it('should build minimal prompt');
  it('should include foundation by default');
  it('should exclude memos by default');
  it('should include memos when requested');
  it('should filter memos by keywords');
});
```

### Integration Tests

```typescript
describe('Knowledge Memory Integration', () => {
  it('should analyze stocks with minimal knowledge');
  it('should respect token budget');
  it('should cache across multiple calls');
  it('should invalidate cache on memo update');
});
```

## Performance Metrics

| Metric | Before | After Phase 1 | After Phase 2 |
|--------|--------|---------------|---------------|
| Default prompt tokens | ~100K | ~10K | ~8K |
| Disk reads per request | 18 files | 18 files (cached) | 18 files (cached) |
| Memo-related tokens | 90K | 0 (default) | 5K (summary) |
| First request latency | Baseline | Same | Same |
| Subsequent requests | Same | 50% faster | 50% faster |
| Memory footprint | Low | +5MB cache | +5MB cache |

## Migration Path

### Backward Compatibility

- `buildSystemPrompt(marketContext)` still works (old signature)
- Internally converts to `buildSystemPrompt(marketContext, {})`
- Default behavior: Foundation enabled, memos disabled

### Migration Steps

1. **Phase 1**: New optional parameter, backward compatible
2. **Phase 2**: Add summary generation, optional feature
3. **Phase 3**: Add vector search, optional feature

No breaking changes required.

## Acceptance Criteria

1. **Token Reduction**: Default prompt < 15K tokens
2. **Caching**: Subsequent calls hit cache 95%+ of the time
3. **Memo Control**: Memos load only when explicitly enabled
4. **Summary Mode**: Summary mode uses < 10K tokens for all memos
5. **No Regression**: All existing tests pass
6. **New Tests**: 80%+ coverage for new modules
7. **Performance**: No slower than current implementation

## Future Considerations

1. **Dynamic Layer Selection**: AI decides which layers to load
2. **Cross-session Cache**: Persist cache between CLI invocations
3. **Streaming**: Stream knowledge layers as loaded
4. **Compression**: Compress cached content
5. **Distributed Cache**: For multi-user scenarios

## Appendix: Configuration Example

```typescript
// Default configuration
const defaultConfig: KnowledgeConfig = {
  layers: {
    core: true,
    foundation: true,
    memos: 'none'
  },
  cache: {
    enabled: true,
    ttlMs: 300000  // 5 minutes
  }
};

// For deep analysis
const deepAnalysisConfig: KnowledgeConfig = {
  layers: {
    core: true,
    foundation: true,
    market: 'us',
    memos: 'summary'
  },
  cache: {
    enabled: true,
    ttlMs: 300000
  }
};

// For quick checks
const quickCheckConfig: KnowledgeConfig = {
  layers: {
    core: true,
    foundation: false,
    memos: 'none'
  },
  cache: {
    enabled: true,
    ttlMs: 300000
  }
};
```
