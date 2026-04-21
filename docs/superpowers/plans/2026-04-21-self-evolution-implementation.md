# Self-Evolution Implementation Plan

> 实现路径：按照设计文档分阶段实施自我进化系统

## Overview

| Phase | Focus | Files | Est. Time |
|-------|-------|-------|-----------|
| 0 | yahoo-finance2 v3 upgrade | 1 | 0.5h |
| 1 | Infrastructure | 8 | 2h |
| 2 | Tracking System | 8 | 3h |
| 3 | Reflection System | 6 | 3h |
| 4 | Review System | 6 | 2h |
| 5 | Polish & Testing | All tests | 2h |

**Total Estimated Time**: 12-15 hours

---

## Phase 0: yahoo-finance2 v3 Upgrade

### 0.1 Upgrade Package

**File**: `package.json`

```bash
pnpm update yahoo-finance2@^3.14.0
```

### 0.2 Update Import Pattern

**File**: `src/data/sources/yahoo-finance.ts`

**Changes**:
```typescript
// BEFORE
import yahooFinance from 'yahoo-finance2';

// AFTER
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
```

**Verification**:
```bash
pnpm build && pnpm test
```

---

## Phase 1: Infrastructure

### 1.1 Create Type Definitions

**File**: `src/evolution/types.ts` (NEW)

```typescript
// Market types
export type Market = 'us' | 'a_share' | 'hk';

// Recommendation types
export type Recommendation = 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';

// Verdict types
export type Verdict = 'correct' | 'incorrect' | 'partial';

// Cycle dimensions
export interface CycleDimensions {
  economic: number;
  profit: number;
  psychology: number;
  riskAttitude: number;
  credit: number;
}

// Stock category
export interface StockCategory {
  type: 'large_cap' | 'mid_cap' | 'small_cap' | 'growth' | 'value' | 'dividend';
  sector: string;
  flags?: {
    isStar?: boolean;
    isChiNext?: boolean;
    isBei?: boolean;
    isHkTech?: boolean;
    isHkMainland?: boolean;
    isSp500?: boolean;
    isNasdaq100?: boolean;
    isEtf?: boolean;
  };
}

// Market indicators
export interface MarketIndicators {
  sp500Trend?: string;
  nasdaqTrend?: string;
  fedRateEnvironment?: string;
  shanghaiIndexTrend?: string;
  northboundFlow?: number;
  marginBalance?: number;
  hangSengTrend?: string;
  southboundFlow?: number;
  ahPremium?: number;
}

// Context snapshot
export interface AnalysisContext {
  cycleScore: number;
  cycleDimensions: CycleDimensions;
  marketConditions: string;
  vixLevel?: number;
  marketIndicators?: MarketIndicators;
}

// Decision
export interface AnalysisDecision {
  recommendation: Recommendation;
  reasoning: string;
  confidence: number;
  keyFactors: string[];
  matrixBaseline: string;
  deviationReason?: string;
}

// Outcome
export interface AnalysisOutcome {
  trackedAt: string;
  holdingPeriodDays: number;
  prices: {
    atRecommendation: number;
    current: number;
  };
  returns: {
    absolute: number;
    vsBenchmark: number;
  };
  verdict: Verdict;
}

// Reflection
export interface AnalysisReflection {
  analyzedAt: string;
  whatWorked: string[];
  whatDidntWork: string[];
  lessons: string[];
}

// Analysis record
export interface AnalysisRecord {
  id: string;
  timestamp: string;
  market: Market;
  symbol: string;
  stockCategory: StockCategory;
  context: AnalysisContext;
  decision: AnalysisDecision;
  outcome?: AnalysisOutcome;
  reflection?: AnalysisReflection;
}
```

### 1.2 Create Experience Store

**File**: `src/evolution/memory/experience-store.ts` (NEW)

**Implementation**:
- Storage location: `~/.oak-invest/experiences/`
- Index file: `index.json` for quick lookups
- Monthly folders: `YYYY-MM/` for organization
- Individual records: `rec_{id}.json`

**Key Methods**:
- `save(record)`: Write record to disk
- `query(filters)`: Filter by market/symbol/date
- `get(id)`: Retrieve single record
- `updateOutcome(id, outcome)`: Update outcome field
- `updateReflection(id, reflection)`: Update reflection field
- `getPendingTracking(olderThanDays)`: Get records needing outcome
- `getPendingReflection()`: Get records needing reflection

### 1.3 Update Knowledge Loader

**File**: `src/knowledge/loader.ts` (MODIFY)

**Changes**:
1. Update `KnowledgeContent` interface to include market-specific principles
2. Add `readPrinciples(scope)` helper function
3. Create new directory structure

### 1.4 Create Knowledge Directories

**Files**: (NEW DIRECTORIES)
- `knowledge/principles/shared/` - Move existing principles here
- `knowledge/principles/us/` - US-specific (empty initially)
- `knowledge/principles/a_share/` - A-share specific (empty initially)
- `knowledge/principles/hk/` - HK specific (empty initially)

**Action**:
```bash
mkdir -p knowledge/principles/shared
mkdir -p knowledge/principles/us
mkdir -p knowledge/principles/a_share
mkdir -p knowledge/principles/hk
mv knowledge/principles/*.md knowledge/principles/shared/
touch knowledge/principles/us/.gitkeep
touch knowledge/principles/a_share/.gitkeep
touch knowledge/principles/hk/.gitkeep
```

### 1.5 Update Prompt Builder

**File**: `src/knowledge/prompt-builder.ts` (MODIFY)

**Changes**:
1. Add optional `market` parameter to `buildSystemPrompt`
2. Load market-specific principles if market is specified
3. Add market-specific section to system prompt

### 1.6 Add Helper Functions

**File**: `src/evolution/helpers.ts` (NEW)

```typescript
// Detect market from symbol format
export function detectMarket(symbol: string): Market {
  if (/^[A-Z]+$/.test(symbol)) return 'us';
  if (/\.(SH|SZ)$/.test(symbol)) return 'a_share';
  if (/\.HK$/.test(symbol)) return 'hk';
  throw new Error(`Unknown symbol format: ${symbol}`);
}

// Generate unique ID
export function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get storage directory
export function getExperienceDir(): string {
  return path.join(os.homedir(), '.oak-invest', 'experiences');
}
```

### 1.7 Integrate with Analyze Command

**File**: `src/commands/analyze.ts` (MODIFY)

**Changes**:
1. Import ExperienceStore
2. After analysis completes, create and save AnalysisRecord
3. Include market detection and categorization

### 1.8 Create Module Index

**File**: `src/evolution/index.ts` (NEW)

```typescript
export * from './types.js';
export * from './memory/experience-store.js';
export * from './helpers.js';
```

### 1.9 Phase 1 Verification

```bash
# Run tests
pnpm test

# Test analyze command saves experience
oak-invest analyze AAPL

# Verify experience was saved
ls ~/.oak-invest/experiences/
```

---

## Phase 2: Tracking System

### 2.1 Create Benchmarks Config

**File**: `src/evolution/tracker/benchmarks.ts` (NEW)

```typescript
export const MARKET_BENCHMARKS: Record<Market, string> = {
  us: 'SPY',
  a_share: '000300.SH',
  hk: 'HSI',
};

export const TRACKING_INTERVALS = [7, 30, 90, 180, 365]; // days

export const MARKET_NAMES: Record<Market, string> = {
  us: 'US Market',
  a_share: 'A-Share Market',
  hk: 'HK Market',
};
```

### 2.2 Create Verdict Classifier

**File**: `src/evolution/tracker/verdict.ts` (NEW)

```typescript
export function classifyVerdict(
  rec: Recommendation,
  returnPct: number,
  benchmarkReturn: number
): Verdict {
  const excessReturn = returnPct - benchmarkReturn;
  
  switch (rec) {
    case 'strong_buy':
    case 'buy':
      if (excessReturn > 5) return 'correct';
      if (excessReturn > 0) return 'partial';
      return 'incorrect';
      
    case 'hold':
      if (Math.abs(excessReturn) < 5) return 'correct';
      if (Math.abs(excessReturn) < 10) return 'partial';
      return 'incorrect';
      
    case 'reduce':
    case 'sell':
      if (excessReturn < -5) return 'correct';
      if (excessReturn < 0) return 'partial';
      return 'incorrect';
      
    default:
      return 'partial';
  }
}
```

### 2.3 Create Outcome Tracker

**File**: `src/evolution/tracker/outcome-tracker.ts` (NEW)

**Implementation**:
1. `trackAll()`: Process all pending records
2. `trackMarket(market)`: Process records for specific market
3. `calculateReturn(record)`: Fetch current price, compute return
4. `getBenchmarkReturn(market, days)`: Get benchmark performance
5. Rate limiting and error handling

### 2.4 Create Stats Calculator

**File**: `src/evolution/stats/stats-calculator.ts` (NEW)

**Implementation**:
1. Calculate overall accuracy
2. Breakdown by recommendation type
3. Breakdown by stock category
4. Breakdown by sector
5. Breakdown by cycle score
6. Market comparison

### 2.5 Create Track Command

**File**: `src/commands/track.ts` (NEW)

```bash
oak-invest track                    # Track all pending
oak-invest track --market us        # Track specific market
oak-invest track --symbol AAPL      # Track specific symbol
```

### 2.6 Create Accuracy Report Command

**File**: `src/commands/accuracy-report.ts` (NEW)

**Implementation**:
- Fetch stats from calculator
- Format as ASCII table
- Support `--by-category`, `--by-sector` flags

### 2.7 Create Experience Command

**File**: `src/commands/experience.ts` (NEW)

```bash
oak-invest experience list          # List all experiences
oak-invest experience show <id>     # Show specific record
oak-invest experience export        # Export to JSON
```

### 2.8 Phase 2 Verification

```bash
# Run tests
pnpm test

# Run tracking
oak-invest track

# View accuracy report
oak-invest accuracy-report
```

---

## Phase 3: Reflection System

### 3.1 Create Reflection Prompts

**File**: `src/evolution/reflection/prompts.ts` (NEW)

```typescript
export function buildReflectionPrompt(
  market: Market,
  records: AnalysisRecord[],
  stats: MarketStats
): string {
  return `You are reflecting on investment recommendations for ${market} market.

## Records to Analyze
${formatRecords(records)}

## Current Accuracy
- Overall: ${stats.overall.accuracyRate}%
- By category: ${formatCategoryStats(stats.byCategory)}
- By recommendation type: ${formatTypeStats(stats.byType)}

## Task
Analyze these records and:
1. Identify patterns in successful predictions
2. Identify patterns in failed predictions  
3. What market-specific factors were missed?
4. What stock categories performed differently?
5. Propose specific principles for this market

Return JSON with:
{
  "successfulPatterns": [...],
  "failurePatterns": [...],
  "categoryInsights": {...},
  "proposedPrinciples": [...]
}`;
}
```

### 3.2 Create Pattern Detector

**File**: `src/evolution/reflection/pattern-detector.ts` (NEW)

**Implementation**:
1. Statistical pattern detection
2. Correlation analysis
3. Factor importance ranking
4. Pattern confidence scoring

### 3.3 Create Reflection Engine

**File**: `src/evolution/reflection/reflection-engine.ts` (NEW)

**Implementation**:
1. Load records with outcomes
2. Calculate current stats
3. Detect patterns (statistical + LLM)
4. Generate proposed principles
5. Save proposals to candidates directory

### 3.4 Create Reflect Command

**File**: `src/commands/reflect.ts` (NEW)

```bash
oak-invest reflect                  # Reflect all markets
oak-invest reflect --market us      # Reflect specific market
oak-invest reflect history          # View past reflections
```

### 3.5 Create Proposed Principle Types

**File**: `src/evolution/curator/types.ts` (NEW)

```typescript
export type PrincipleCategory = 'maxim' | 'rule' | 'heuristic' | 'adjustment';
export type PrincipleStatus = 'pending' | 'approved' | 'rejected';

export interface EvidenceDetail {
  supportingRecords: string[];
  supportingCount: number;
  contradictingCount: number;
  successRate: number;
}

export interface ProposedPrinciple {
  id: string;
  proposedAt: string;
  applicableMarkets: Market[];
  applicableCategories?: StockCategory[];
  title: string;
  description: string;
  category: PrincipleCategory;
  evidence: {
    byMarket: Partial<Record<Market, EvidenceDetail>>;
    overallSuccessRate: number;
  };
  status: PrincipleStatus;
  reviewedAt?: string;
  reviewNotes?: string;
}
```

### 3.6 Phase 3 Verification

```bash
# Run tests
pnpm test

# Run reflection
oak-invest reflect --market us

# Check for proposed principles
ls ~/.oak-invest/candidates/us/
```

---

## Phase 4: Review System

### 4.1 Create Principle Formatter

**File**: `src/evolution/curator/principle-formatter.ts` (NEW)

**Implementation**:
1. Format principle for terminal display
2. Format principle as markdown file
3. Generate review summary

### 4.2 Create Knowledge Curator

**File**: `src/evolution/curator/knowledge-curator.ts` (NEW)

**Implementation**:
1. `listPending(market)`: List pending proposals
2. `getProposal(id)`: Get proposal details
3. `approve(id, notes)`: Approve and apply
4. `reject(id, reason)`: Reject with reason
5. `applyToKnowledge(principle)`: Write to knowledge files

### 4.3 Create Review Command

**File**: `src/commands/review.ts` (NEW)

```bash
oak-invest review list              # List pending principles
oak-invest review show <id>         # Show proposal details
oak-invest review approve <id>      # Approve proposal
oak-invest review reject <id>       # Reject proposal
```

### 4.4 Create Evolution Scheduler

**File**: `src/evolution/scheduler/evolution-scheduler.ts` (NEW)

**Implementation**:
1. Daily tracking at 6pm (weekdays)
2. Weekly reflection on Sunday 10am
3. Configurable schedules via config.yaml

### 4.5 Create Evolution Command

**File**: `src/commands/evolution.ts` (NEW)

```bash
oak-invest evolution status         # Show evolution status
oak-invest evolution stats          # Show detailed stats
oak-invest evolution start          # Start scheduler
oak-invest evolution export         # Export all data
```

### 4.6 Register All Commands

**File**: `src/index.ts` (MODIFY)

**Changes**:
Register new commands:
- `experience`
- `track`
- `accuracy-report`
- `reflect`
- `review`
- `evolution`

### 4.7 Phase 4 Verification

```bash
# Run all tests
pnpm test

# Test review workflow
oak-invest review list
oak-invest review show prop_xxx
oak-invest review approve prop_xxx

# Verify principle was added
ls knowledge/principles/us/

# Test scheduler
oak-invest evolution start
```

---

## Phase 5: Polish & Testing

### 5.1 Unit Tests

Create tests for all new modules:

| File | Test File |
|------|-----------|
| `evolution/memory/experience-store.ts` | `__tests__/experience-store.test.ts` |
| `evolution/tracker/outcome-tracker.ts` | `__tests__/outcome-tracker.test.ts` |
| `evolution/tracker/verdict.ts` | `__tests__/verdict.test.ts` |
| `evolution/stats/stats-calculator.ts` | `__tests__/stats-calculator.test.ts` |
| `evolution/reflection/reflection-engine.ts` | `__tests__/reflection-engine.test.ts` |
| `evolution/curator/knowledge-curator.ts` | `__tests__/knowledge-curator.test.ts` |

### 5.2 Integration Tests

1. Full analyze → track → reflect → review flow
2. Market-specific principle application
3. Scheduler execution

### 5.3 Error Handling

1. Yahoo Finance API errors
2. File system errors
3. Invalid data handling
4. LLM API errors

### 5.4 Documentation

1. Update README with new commands
2. Add examples for each command
3. Document config options

### 5.5 Final Verification

```bash
# Build
pnpm build

# Run all tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Integration test
oak-invest analyze AAPL
oak-invest track
oak-invest accuracy-report
oak-invest reflect
oak-invest review list
```

---

## Dependencies Graph

```
Phase 0 (yahoo-finance2 v3)
    │
    ▼
Phase 1 (Infrastructure)
    │
    ├──► types.ts
    ├──► experience-store.ts
    ├──► helpers.ts
    ├──► knowledge/loader.ts (modify)
    ├──► knowledge/prompt-builder.ts (modify)
    ├──► knowledge/principles/* (restructure)
    └──► commands/analyze.ts (modify)
    │
    ▼
Phase 2 (Tracking)
    │
    ├──► tracker/benchmarks.ts
    ├──► tracker/verdict.ts
    ├──► tracker/outcome-tracker.ts
    ├──► stats/stats-calculator.ts
    ├──► commands/track.ts
    ├──► commands/accuracy-report.ts
    └──► commands/experience.ts
    │
    ▼
Phase 3 (Reflection)
    │
    ├──► reflection/prompts.ts
    ├──► reflection/pattern-detector.ts
    ├──► reflection/reflection-engine.ts
    ├──► curator/types.ts
    └──► commands/reflect.ts
    │
    ▼
Phase 4 (Review)
    │
    ├──► curator/principle-formatter.ts
    ├──► curator/knowledge-curator.ts
    ├──► scheduler/evolution-scheduler.ts
    ├──► commands/review.ts
    ├──► commands/evolution.ts
    └──► index.ts (modify)
    │
    ▼
Phase 5 (Polish)
    │
    └──► All tests + documentation
```

---

## File Checklist

### New Files (25 files)

```
src/evolution/
├── index.ts
├── types.ts
├── helpers.ts
├── memory/
│   └── experience-store.ts
├── tracker/
│   ├── benchmarks.ts
│   ├── verdict.ts
│   └── outcome-tracker.ts
├── stats/
│   └── stats-calculator.ts
├── reflection/
│   ├── prompts.ts
│   ├── pattern-detector.ts
│   └── reflection-engine.ts
├── curator/
│   ├── types.ts
│   ├── principle-formatter.ts
│   └── knowledge-curator.ts
└── scheduler/
    └── evolution-scheduler.ts

src/commands/
├── experience.ts
├── track.ts
├── accuracy-report.ts
├── reflect.ts
├── review.ts
└── evolution.ts

knowledge/principles/
├── us/.gitkeep
├── a_share/.gitkeep
└── hk/.gitkeep
```

### Modified Files (4 files)

```
package.json                    # yahoo-finance2 version
src/data/sources/yahoo-finance.ts  # v3 import
src/knowledge/loader.ts         # Market-specific principles
src/knowledge/prompt-builder.ts # Market parameter
src/commands/analyze.ts         # Save experience
src/index.ts                    # Register commands
```

---

## Success Criteria

- [ ] All tests pass
- [ ] `oak-invest analyze AAPL` saves experience record
- [ ] `oak-invest track` updates outcomes
- [ ] `oak-invest accuracy-report` shows statistics
- [ ] `oak-invest reflect` generates proposed principles
- [ ] `oak-invest review` allows approve/reject
- [ ] Approved principles appear in knowledge/
- [ ] Type check passes with no errors
- [ ] Build succeeds
