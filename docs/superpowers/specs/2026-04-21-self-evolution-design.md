# Oak Invest Agent Self-Evolution Design

> 使 Oak Invest Agent 具备自我进化能力，通过自动追踪投资建议的准确性并从中学习，逐步提升分析质量和知识库深度。

## 1. 概述

### 1.1 目标

| 目标 | 描述 |
|------|------|
| **预测准确性提升** | 自动追踪股票价格，计算投资建议的准确率，识别成功/失败模式 |
| **知识库增长** | 从成功经验中提取新的投资原则，经人工审核后纳入知识库 |

### 1.2 设计原则

- **保守进化**: 原则级变更必须经过人工审核
- **市场分离**: 美股、A股、港股三个市场独立进化
- **自动追踪**: 减少用户负担，自动获取价格数据计算收益
- **证据驱动**: 每个新原则都有数据支撑

### 1.3 依赖升级

本次设计包含以下依赖升级：

| 包名 | 当前版本 | 升级版本 | 备注 |
|------|---------|---------|------|
| yahoo-finance2 | ^2.13.0 | ^3.14.0 | 需修改初始化方式 |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Self-Evolution Layer                              │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│  Experience     │  Outcome        │  Reflection     │  Knowledge        │
│  Store          │  Tracker        │  Engine         │  Curator          │
│                 │                 │                 │                   │
│  • Record every │  • Auto-track   │  • Weekly       │  • Human review   │
│    analysis     │    prices       │    reflection   │    gate           │
│  • Full context │  • Calculate    │  • Pattern      │  • Approved       │
│    snapshot     │    returns      │    detection    │    principles     │
│  • Persist to   │  • Accuracy     │  • Lesson       │  • Update         │
│    disk         │    scoring      │    extraction   │    knowledge/     │
├─────────────────┴─────────────────┴─────────────────┴───────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     Existing Agent (unchanged)                      │ │
│  │  CLI → Commands → Agent → Tools → Knowledge → LLM → Output         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Storage:                                                                │
│  ~/.oak-invest/                                                          │
│    ├── experiences/          # Analysis records (by market)             │
│    ├── candidates/           # Proposed principles (pending review)     │
│    └── evolution-stats.json  # Accuracy metrics                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 数据流

1. **分析完成** → Experience Store 保存记录
2. **定时任务** → Outcome Tracker 获取价格，更新收益
3. **每周反思** → Reflection Engine 分析模式，提出新原则
4. **人工审核** → 用户通过 CLI 审核，批准/拒绝
5. **批准生效** → Knowledge Curator 更新 knowledge/ 文件

---

## 3. 数据模型

### 3.1 AnalysisRecord (分析记录)

```typescript
interface AnalysisRecord {
  id: string;                              // UUID
  timestamp: string;                       // ISO timestamp
  
  // Market and stock classification
  market: 'us' | 'a_share' | 'hk';
  symbol: string;
  stockCategory: StockCategory;
  
  // Market context at decision time
  context: {
    cycleScore: number;                    // 0-10 overall
    cycleDimensions: {
      economic: number;
      profit: number;
      psychology: number;
      riskAttitude: number;
      credit: number;
    };
    marketConditions: string;              // Brief summary
    vixLevel?: number;
    
    // Market-specific indicators
    marketIndicators?: {
      // US-specific
      sp500Trend?: string;
      nasdaqTrend?: string;
      fedRateEnvironment?: string;
      
      // A-share specific
      shanghaiIndexTrend?: string;
      northboundFlow?: number;             // 北向资金
      marginBalance?: number;              // 融资余额
      
      // HK specific
      hangSengTrend?: string;
      southboundFlow?: number;             // 南向资金
      ahPremium?: number;                  // AH溢价
    };
  };
  
  // The decision made
  decision: {
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';
    reasoning: string;                     // Full LLM reasoning
    confidence: number;                    // 0.0 - 1.0
    keyFactors: string[];                  // Top 3-5 factors
    matrixBaseline: string;                // What decision matrix suggested
    deviationReason?: string;              // If deviated from matrix
  };
  
  // Outcome (filled by tracker)
  outcome?: {
    trackedAt: string;
    holdingPeriodDays: number;
    prices: {
      atRecommendation: number;
      current: number;
    };
    returns: {
      absolute: number;                    // %
      vsBenchmark: number;                 // Excess return %
    };
    verdict: 'correct' | 'incorrect' | 'partial';
  };
  
  // Reflection (filled by reflection engine)
  reflection?: {
    analyzedAt: string;
    whatWorked: string[];
    whatDidntWork: string[];
    lessons: string[];
  };
}
```

### 3.2 StockCategory (股票分类)

```typescript
interface StockCategory {
  // Primary classification
  type: 'large_cap' | 'mid_cap' | 'small_cap' | 'growth' | 'value' | 'dividend';
  
  // Sector
  sector: string;                         // e.g., 'tech', 'finance', 'consumer'
  
  // Market-specific flags
  flags?: {
    // A-share specific
    isStar?: boolean;                     // 科创板
    isChiNext?: boolean;                  // 创业板
    isBei?: boolean;                      // 北交所
    
    // HK specific
    isHkTech?: boolean;                   // 科技股
    isHkMainland?: boolean;               // 内地企业
    
    // US specific
    isSp500?: boolean;
    isNasdaq100?: boolean;
    isEtf?: boolean;
  };
}
```

### 3.3 ProposedPrinciple (提议原则)

```typescript
interface ProposedPrinciple {
  id: string;
  proposedAt: string;
  
  // Which market(s) does this apply to?
  applicableMarkets: ('us' | 'a_share' | 'hk')[];
  
  // Does it apply to specific categories?
  applicableCategories?: StockCategory[];
  
  // Content
  title: string;
  description: string;
  category: 'maxim' | 'rule' | 'heuristic' | 'adjustment';
  
  // Evidence - separated by market
  evidence: {
    byMarket: {
      us?: EvidenceDetail;
      a_share?: EvidenceDetail;
      hk?: EvidenceDetail;
    };
    overallSuccessRate: number;
  };
  
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewNotes?: string;
}

interface EvidenceDetail {
  supportingRecords: string[];
  supportingCount: number;
  contradictingCount: number;
  successRate: number;
}
```

### 3.4 EvolutionStats (进化统计)

```typescript
interface EvolutionStats {
  lastUpdated: string;
  
  // Stats separated by market
  markets: {
    us: MarketStats;
    a_share: MarketStats;
    hk: MarketStats;
  };
  
  // Cross-market comparison
  crossMarket: {
    bestPerformingMarket: string;
    marketAccuracies: Record<string, number>;
  };
}

interface MarketStats {
  // Overall accuracy for this market
  overall: {
    totalRecommendations: number;
    correct: number;
    incorrect: number;
    partial: number;
    accuracyRate: number;
  };
  
  // By stock category
  byCategory: Record<string, {
    count: number;
    accuracy: number;
    avgReturn: number;
  }>;
  
  // By sector
  bySector: Record<string, {
    count: number;
    accuracy: number;
    avgReturn: number;
  }>;
  
  // By recommendation type
  byType: Record<string, {
    total: number;
    correct: number;
    accuracy: number;
  }>;
  
  // By cycle score range
  byCycleScore: Record<string, {
    count: number;
    accuracy: number;
  }>;
  
  // Market-specific benchmarks
  benchmarkReturns: {
    '1w': number;
    '1m': number;
    '3m': number;
    '6m': number;
    '1y': number;
  };
}
```

---

## 4. 核心组件设计

### 4.1 Experience Store (经验存储)

**Purpose**: Capture and persist every analysis decision

**Location**: `src/evolution/memory/experience-store.ts`

**Key Methods**:
```typescript
class ExperienceStore {
  // Save a new analysis record
  save(record: AnalysisRecord): Promise<void>;
  
  // Query records by market/symbol/date range
  query(filters: {
    market?: Market;
    symbol?: string;
    from?: Date;
    to?: Date;
    hasOutcome?: boolean;
  }): Promise<AnalysisRecord[]>;
  
  // Get a single record by ID
  get(id: string): Promise<AnalysisRecord | null>;
  
  // Update outcome field (called by Outcome Tracker)
  updateOutcome(id: string, outcome: Outcome): Promise<void>;
  
  // Update reflection field (called by Reflection Engine)
  updateReflection(id: string, reflection: Reflection): Promise<void>;
  
  // Get records pending outcome tracking
  getPendingTracking(olderThanDays: number): Promise<AnalysisRecord[]>;
  
  // Get records pending reflection
  getPendingReflection(): Promise<AnalysisRecord[]>;
}
```

**Integration Point**: Hook into `src/commands/analyze.ts` after analysis completes

---

### 4.2 Outcome Tracker (结果追踪器)

**Purpose**: Automatically fetch prices and calculate returns

**Location**: `src/evolution/tracker/outcome-tracker.ts`

**Tracking Schedule**:
```typescript
const TRACKING_INTERVALS = [7, 30, 90, 180, 365]; // days

const MARKET_BENCHMARKS = {
  us: 'SPY',           // S&P 500 ETF
  a_share: '000300.SH', // 沪深300
  hk: 'HSI'            // Hang Seng Index
};
```

**Key Methods**:
```typescript
class OutcomeTracker {
  // Check all pending recommendations and update outcomes
  trackAll(): Promise<TrackingResult>;
  
  // Track specific symbol
  trackSymbol(symbol: string, market: Market): Promise<void>;
  
  // Calculate return for a record
  calculateReturn(record: AnalysisRecord): Promise<Outcome>;
  
  // Get current benchmark return for a market
  getBenchmarkReturn(market: Market, days: number): Promise<number>;
  
  // Classify verdict
  classifyVerdict(
    recommendation: Recommendation,
    returnPercent: number,
    benchmarkReturn: number
  ): 'correct' | 'incorrect' | 'partial';
}
```

**Verdict Classification Logic**:
```typescript
type Verdict = 'correct' | 'incorrect' | 'partial';
type Recommendation = 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';

function classifyVerdict(
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
      return 'partial'; // Fallback for unexpected values
  }
}
```

---

### 4.3 Reflection Engine (反思引擎)

**Purpose**: Analyze patterns and propose new principles

**Location**: `src/evolution/reflection/reflection-engine.ts`

**Reflection Triggers**:
- Scheduled: Weekly (Sunday) for records older than 30 days
- Threshold: When accuracy drops 10% below baseline
- Manual: User-triggered via CLI

**Key Methods**:
```typescript
class ReflectionEngine {
  // Run reflection for a specific market
  reflect(market: Market): Promise<ReflectionResult>;
  
  // Detect patterns in records
  detectPatterns(records: AnalysisRecord[]): Promise<PatternMatch[]>;
  
  // Extract lessons from a single record
  extractLesson(record: AnalysisRecord): Promise<Lesson>;
  
  // Generate proposed principles
  proposePrinciples(patterns: PatternMatch[]): Promise<ProposedPrinciple[]>;
  
  // Calculate accuracy stats
  calculateStats(records: AnalysisRecord[]): MarketStats;
}
```

**Reflection Prompt Template**:
```markdown
You are reflecting on investment recommendations for {market} market.

## Records to Analyze
{formattedRecords with outcomes}

## Current Accuracy
- Overall: {accuracyRate}%
- By category: {categoryStats}
- By recommendation type: {typeStats}

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
}
```

---

### 4.4 Knowledge Curator (知识管理员)

**Purpose**: Human review gate for proposed principles

**Location**: `src/evolution/curator/knowledge-curator.ts`

**Key Methods**:
```typescript
class KnowledgeCurator {
  // List all pending principles
  listPending(market?: Market): Promise<ProposedPrinciple[]>;
  
  // Get details of a proposed principle
  getProposal(id: string): Promise<ProposedPrinciple>;
  
  // Approve and apply to knowledge base
  approve(id: string, notes?: string): Promise<void>;
  
  // Reject with reason
  reject(id: string, reason: string): Promise<void>;
  
  // Apply approved principle to knowledge files
  applyToKnowledge(principle: ProposedPrinciple): Promise<void>;
  
  // Generate review summary for user
  generateReviewSummary(principle: ProposedPrinciple): string;
}
```

**Application Logic**:
```typescript
async function applyToKnowledge(principle: ProposedPrinciple) {
  const targetDir = principle.applicableMarkets.length === 3
    ? 'knowledge/principles/shared/'
    : `knowledge/principles/${principle.applicableMarkets[0]}/`;
  
  const filename = `${slugify(principle.title)}.md`;
  const content = formatPrincipleMarkdown(principle);
  
  await writeFile(path.join(targetDir, filename), content);
}
```

---

## 5. CLI 命令

### 5.1 Experience Commands

```bash
# View experience history
oak-invest experience list [--market us|a_share|hk] [--symbol AAPL] [--limit 20]

# View specific experience record
oak-invest experience show <record-id>

# Export experiences for analysis
oak-invest experience export [--market us] --output experiences.json
```

### 5.2 Tracking Commands

```bash
# Track outcomes for all pending recommendations
oak-invest track

# Track specific market
oak-invest track --market a_share

# Track specific symbol
oak-invest track --symbol 0700.HK

# View accuracy report
oak-invest accuracy-report [--market us] [--period 3m]

# Detailed accuracy by category/sector
oak-invest accuracy-report --market a_share --by-category --by-sector
```

**Accuracy Report Output Example**:
```
╔══════════════════════════════════════════════════════════════╗
║           ACCURACY REPORT - A-SHARE (Last 3 Months)          ║
╠══════════════════════════════════════════════════════════════╣
║ Overall Accuracy: 62.5% (25/40)                              ║
║ Benchmark (沪深300): +5.2%                                   ║
║ Avg Excess Return: +3.1%                                     ║
╠══════════════════════════════════════════════════════════════╣
║ By Recommendation:                                           ║
║   strong_buy: 75% (6/8)    buy: 60% (9/15)                  ║
║   hold: 50% (4/8)          reduce: 67% (4/6)  sell: 2/3     ║
╠══════════════════════════════════════════════════════════════╣
║ By Category:                                                 ║
║   large_cap: 70%           growth: 55%        value: 68%    ║
╠══════════════════════════════════════════════════════════════╣
║ By Sector:                                                   ║
║   tech: 58%                finance: 71%       consumer: 65% ║
╚══════════════════════════════════════════════════════════════╝
```

### 5.3 Reflection Commands

```bash
# Run weekly reflection (auto-scheduled)
oak-invest reflect [--market us|a_share|hk]

# Force reflection on all markets
oak-invest reflect --all

# View recent reflections
oak-invest reflect history [--market us]
```

### 5.4 Review Commands (Human Gate)

```bash
# List pending principles for review
oak-invest review list [--market us|a_share|hk]

# Review a specific proposal
oak-invest review show <proposal-id>

# Approve a proposal
oak-invest review approve <proposal-id> [--notes "Optional notes"]

# Reject a proposal
oak-invest review reject <proposal-id> --reason "Explanation"
```

**Review Interactive Session Example**:
```
$ oak-invest review show prop_a1b2c3

╔══════════════════════════════════════════════════════════════╗
║ PROPOSED PRINCIPLE: prop_a1b2c3                               ║
╠══════════════════════════════════════════════════════════════╣
║ Market: A-SHARE                                              ║
║ Category: rule                                               ║
╠══════════════════════════════════════════════════════════════╣
║ Title: 北向资金流入增强买入信号                               ║
║                                                              ║
║ Description:                                                 ║
║ 当北向资金连续3日净流入超过50亿，且股票估值低于行业平均PE时，  ║
║ 可将"hold"建议提升为"buy"。这一模式在A股市场表现优于港股。    ║
╠══════════════════════════════════════════════════════════════╣
║ Evidence:                                                    ║
║ • Supporting cases: 12 (成功率 83%)                          ║
║ • Contradicting cases: 2                                     ║
║ • Relevant records: rec_x1, rec_x2, ...                      ║
╠══════════════════════════════════════════════════════════════╣
║ Actions: [a]pprove  [r]eject  [s]kip  [d]etails             ║
╚══════════════════════════════════════════════════════════════╝

> a
Enter optional notes (or press Enter to skip): 适用于大盘股，小盘股需谨慎

✓ Approved and applied to knowledge/principles/a_share/
```

### 5.5 Evolution Status Commands

```bash
# View overall evolution status
oak-invest evolution status

# View stats for specific market
oak-invest evolution stats --market us

# Export evolution data
oak-invest evolution export --output evolution-data.json

# Start scheduler (background process)
oak-invest evolution start
```

**Status Output Example**:
```
╔══════════════════════════════════════════════════════════════╗
║                 EVOLUTION STATUS                             ║
╠══════════════════════════════════════════════════════════════╣
║ Total Records: 156                                          ║
║ Pending Tracking: 23                                        ║
║ Pending Reflection: 45                                      ║
║ Pending Review: 3                                           ║
╠══════════════════════════════════════════════════════════════╣
║ Market Accuracy:                                            ║
║   US:      65% ████████████░░░░░░░░░░░░                     ║
║   A-SHARE: 62% ████████████░░░░░░░░░░░░                     ║
║   HK:      58% ███████████░░░░░░░░░░░░░                     ║
╠══════════════════════════════════════════════════════════════╣
║ Approved Principles: 5                                      ║
║ Rejected Principles: 2                                      ║
║ Last Reflection: 2026-04-14                                 ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 6. 集成点

### 6.1 Analyze Command Integration

**File**: `src/commands/analyze.ts` (修改)

```typescript
// After analysis completes, save to experience store
import { ExperienceStore } from '../evolution/memory/experience-store.js';

async function runAnalysis(symbols: string[], config: OakInvestConfig) {
  const agent = createInvestmentAgent(config);
  const result = await agent.prompt(buildAnalysisPrompt(symbols));
  
  // NEW: Save to experience store
  const store = new ExperienceStore();
  for (const symbol of symbols) {
    const market = detectMarket(symbol); // us | a_share | hk
    const category = await categorizeStock(symbol, market);
    
    await store.save({
      id: generateId(),
      timestamp: new Date().toISOString(),
      market,
      symbol,
      stockCategory: category,
      context: {
        cycleScore: result.cycleScore,
        cycleDimensions: result.cycleDimensions,
        marketConditions: result.marketSummary,
        marketIndicators: await getMarketIndicators(market),
      },
      decision: {
        recommendation: result.recommendation,
        reasoning: result.reasoning,
        confidence: result.confidence,
        keyFactors: result.keyFactors,
        matrixBaseline: result.matrixBaseline,
      },
    });
  }
  
  return result;
}
```

### 6.2 Prompt Builder Integration

**File**: `src/knowledge/prompt-builder.ts` (修改)

```typescript
// Load market-specific principles alongside shared ones
export function buildSystemPrompt(
  market?: Market,
  marketContext?: string
): string {
  const knowledge = loadKnowledge();
  
  const parts: string[] = [IDENTITY_PROMPT];
  
  // Core principles (shared)
  parts.push(buildLayer('Core Investment Principles', 
    Object.values(knowledge.books).join('\n\n---\n\n')));
  
  // Shared decision rules
  const sharedPrinciples = loadPrinciples('shared');
  parts.push(buildLayer('Decision Rules (Universal)', 
    Object.values(sharedPrinciples).join('\n\n---\n\n')));
  
  // NEW: Market-specific principles
  if (market) {
    const marketPrinciples = loadPrinciples(market);
    if (Object.keys(marketPrinciples).length > 0) {
      parts.push(buildLayer(
        `${MARKET_NAMES[market]} Specific Adjustments`,
        Object.values(marketPrinciples).join('\n\n---\n\n')
      ));
    }
  }
  
  // ... rest of prompt building
  
  return parts.join('\n');
}

// Helper to load principles by market
function loadPrinciples(scope: 'shared' | Market): Record<string, string> {
  const dir = path.join(KNOWLEDGE_DIR, 'principles', scope);
  return readDirFiles(dir);
}
```

### 6.3 Scheduler Integration

**File**: `src/commands/evolution-scheduler.ts` (新建)

```typescript
import cron from 'node-cron';

export function startEvolutionScheduler(config: OakInvestConfig) {
  const tracker = new OutcomeTracker();
  const reflector = new ReflectionEngine();
  
  // Daily: Track outcomes at 6pm
  cron.schedule('0 18 * * 1-5', async () => {
    console.log('[Evolution] Running daily outcome tracking...');
    await tracker.trackAll();
  });
  
  // Weekly: Reflection on Sunday 10am
  cron.schedule('0 10 * * 0', async () => {
    console.log('[Evolution] Running weekly reflection...');
    for (const market of ['us', 'a_share', 'hk'] as const) {
      await reflector.reflect(market);
    }
  });
  
  console.log('Evolution scheduler started');
}
```

### 6.4 Knowledge Loader Update

**File**: `src/knowledge/loader.ts` (修改)

```typescript
interface KnowledgeContent {
  books: Record<string, string>;
  principles: {
    shared: Record<string, string>;
    us: Record<string, string>;
    a_share: Record<string, string>;
    hk: Record<string, string>;
  };
  maxims: string;
  memos: Record<string, string>;
}

export function loadKnowledge(): KnowledgeContent {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const principlesDir = path.join(projectRoot, 'knowledge', 'principles');
  
  return {
    books: readDirFiles(path.join(projectRoot, 'knowledge', 'books')),
    principles: {
      shared: readDirFiles(path.join(principlesDir, 'shared')),
      us: readDirFiles(path.join(principlesDir, 'us')),
      a_share: readDirFiles(path.join(principlesDir, 'a_share')),
      hk: readDirFiles(path.join(principlesDir, 'hk')),
    },
    maxims: readFile(path.join(projectRoot, 'knowledge', 'maxims.md')),
    memos: readDirFiles(path.join(projectRoot, 'knowledge', 'memos')),
  };
}
```

### 6.5 yahoo-finance2 v3 Upgrade

**File**: `src/data/sources/yahoo-finance.ts` (修改)

```typescript
// BEFORE (v2)
// import yahooFinance from 'yahoo-finance2';

// AFTER (v3)
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

// Rest of the code remains the same
// yahooFinance.quote(), yahooFinance.historical(), etc.
```

### 6.6 Market Indicators Data Source

**File**: `src/data/sources/market-indicators.ts` (新建)

```typescript
interface MarketIndicatorSource {
  // US Market
  getSp500Trend(): Promise<string>;
  getNasdaqTrend(): Promise<string>;
  getFedRate(): Promise<string>;
  
  // A-Share Market
  getShanghaiIndex(): Promise<string>;
  getNorthboundFlow(): Promise<number>;      // 北向资金
  getMarginBalance(): Promise<number>;        // 融资余额
  
  // HK Market
  getHangSengTrend(): Promise<string>;
  getSouthboundFlow(): Promise<number>;       // 南向资金
  getAhPremium(): Promise<number>;            // AH溢价
}
```

---

## 6.7 Helper Functions

以下辅助函数需要实现：

```typescript
// Detect market from symbol format
function detectMarket(symbol: string): Market {
  if (/^[A-Z]+$/.test(symbol)) return 'us';           // AAPL, MSFT
  if (/\.(SH|SZ)$/.test(symbol)) return 'a_share';    // 000001.SZ
  if (/\.HK$/.test(symbol)) return 'hk';              // 0700.HK
  throw new Error(`Unknown symbol format: ${symbol}`);
}

// Categorize stock based on market data
async function categorizeStock(symbol: string, market: Market): Promise<StockCategory> {
  // Fetch market cap, sector info from data source
  // Return StockCategory with type, sector, and market-specific flags
}

// Get market-specific indicators at analysis time
async function getMarketIndicators(market: Market): Promise<MarketIndicators> {
  // Fetch current market indicators based on market type
  // US: S&P500 trend, Fed rate, VIX
  // A-share: Shanghai index, northbound flow, margin balance
  // HK: Hang Seng, southbound flow, AH premium
}
```

### 6.8 Agent Result Structure

Agent analysis should return a structured result for experience storage:

```typescript
interface AnalysisResult {
  // Primary recommendation
  recommendation: Recommendation;
  confidence: number;
  reasoning: string;
  keyFactors: string[];
  
  // Cycle analysis
  cycleScore: number;
  cycleDimensions: CycleDimensions;
  
  // Market summary
  marketSummary: string;
  
  // Decision matrix comparison
  matrixBaseline: string;
  deviationReason?: string;
}
```

---

## 7. 文件结构

### 7.1 新建文件

```
src/
├── evolution/                          # NEW: Self-evolution module
│   ├── index.ts                        # Module exports
│   │
│   ├── memory/                         # Experience Store
│   │   ├── experience-store.ts
│   │   ├── types.ts
│   │   └── __tests__/
│   │       └── experience-store.test.ts
│   │
│   ├── tracker/                        # Outcome Tracker
│   │   ├── outcome-tracker.ts
│   │   ├── benchmarks.ts
│   │   ├── verdict.ts
│   │   └── __tests__/
│   │       ├── outcome-tracker.test.ts
│   │       └── verdict.test.ts
│   │
│   ├── reflection/                     # Reflection Engine
│   │   ├── reflection-engine.ts
│   │   ├── pattern-detector.ts
│   │   ├── prompts.ts
│   │   └── __tests__/
│   │       └── reflection-engine.test.ts
│   │
│   ├── curator/                        # Knowledge Curator
│   │   ├── knowledge-curator.ts
│   │   ├── principle-formatter.ts
│   │   └── __tests__/
│   │       └── knowledge-curator.test.ts
│   │
│   ├── stats/                          # Statistics
│   │   ├── stats-calculator.ts
│   │   ├── types.ts
│   │   └── __tests__/
│   │       └── stats-calculator.test.ts
│   │
│   └── scheduler/                      # Scheduling
│       ├── evolution-scheduler.ts
│       └── __tests__/
│           └── evolution-scheduler.test.ts
│
├── commands/                           # Updated CLI commands
│   ├── analyze.ts                      # MODIFIED: Add experience saving
│   ├── experience.ts                   # NEW
│   ├── track.ts                        # NEW
│   ├── reflect.ts                      # NEW
│   ├── review.ts                       # NEW
│   └── evolution.ts                    # NEW
│
├── knowledge/                          # Updated module
│   ├── loader.ts                       # MODIFIED
│   └── prompt-builder.ts               # MODIFIED
│
├── data/
│   └── sources/
│       ├── market-indicators.ts        # NEW
│       └── yahoo-finance.ts            # MODIFIED: v3 upgrade
│
└── index.ts                            # MODIFIED: Register new commands
```

### 7.2 Knowledge 目录结构 (修改)

```
knowledge/
├── books/                              # Existing
│   ├── mastering-the-market-cycle.md
│   └── the-most-important-thing.md
│
├── principles/                         # MODIFIED: Add market subdirs
│   ├── shared/                         # Universal principles
│   │   ├── decision-matrix.md
│   │   ├── risk-framework.md
│   │   ├── valuation-rules.md
│   │   ├── contrarian-checklist.md
│   │   └── cycle-positioning.md
│   │
│   ├── us/                             # NEW: US-specific
│   │   └── .gitkeep
│   │
│   ├── a_share/                        # NEW: A-share specific
│   │   └── .gitkeep
│   │
│   └── hk/                             # NEW: HK specific
│       └── .gitkeep
│
├── memos/                              # Existing (dynamic)
│   └── ...
│
└── maxims.md                           # Existing
```

### 7.3 用户数据目录

```
~/.oak-invest/
├── config.yaml                         # Existing
│
├── experiences/                        # NEW: Experience storage
│   ├── index.json
│   ├── us/
│   │   └── 2026-01/
│   │       ├── rec_abc123.json
│   │       └── rec_def456.json
│   ├── a_share/
│   │   └── 2026-01/
│   └── hk/
│       └── 2026-01/
│
├── candidates/                         # NEW: Proposed principles
│   ├── us/
│   ├── a_share/
│   ├── hk/
│   └── rejected/
│
├── evolution-stats.json                # NEW: Accuracy metrics
│
└── evolution-log.json                  # NEW: Audit log
```

---

## 8. 依赖

### 8.1 升级依赖

| 包名 | 当前版本 | 升级版本 | 备注 |
|------|---------|---------|------|
| yahoo-finance2 | ^2.13.0 | ^3.14.0 | Breaking: 需修改初始化方式 |

### 8.2 现有依赖 (无需新增)

以下依赖已安装，无需新增：

- `node-cron` - 定时任务调度
- `cheerio` - HTML 解析 (如需网页抓取)
- `zod` - 数据验证

---

## 9. 实施阶段

### Phase 1: 基础设施

1. 升级 yahoo-finance2 到 v3
2. 创建 experience store 数据结构和存储
3. 修改 analyze command 保存记录
4. 创建 knowledge 目录结构 (market subdirs)

### Phase 2: 追踪系统

1. 实现 outcome tracker
2. 实现 verdict classification
3. 添加 accuracy-report 命令
4. 创建统计计算器

### Phase 3: 反思系统

1. 实现 reflection engine
2. 实现 pattern detector
3. 添加 reflect 命令
4. 集成 LLM 反思提示

### Phase 4: 审核系统

1. 实现 knowledge curator
2. 添加 review 命令
3. 实现原则格式化和应用
4. 添加 evolution scheduler

### Phase 5: 完善

1. 完善所有测试
2. 添加 market indicators 数据源
3. 优化 UI 输出
4. 文档完善

---

## 10. 非目标

以下内容明确排除在本设计之外：

- **自动交易执行**: 只提供分析和学习，不执行交易
- **实时行情推送**: 按需获取，不做 WebSocket 推送
- **自动修改核心原则**: 核心原则 (Howard Marks 理念) 需人工审核
- **用户偏好学习**: 本设计不包含用户个性化偏好学习
- **多用户支持**: 个人工具，不考虑多租户

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Yahoo Finance API 限流 | 无法获取价格数据 | 重试机制 + 本地缓存 |
| LLM 反思成本高 | 反思运行成本增加 | 限制反思频率，批量处理 |
| 错误原则被批准 | 降低分析质量 | 审核时展示完整证据链 |
| 存储空间增长 | 磁盘占用增加 | 定期归档旧记录 |

---

## 12. 成功标准

本设计成功的标准：

1. **自动追踪**: 分析完成后自动记录，无需用户干预
2. **准确性可见**: 用户可随时查看各市场的准确率统计
3. **原则进化**: 每月至少产生 1-2 个有价值的新原则候选
4. **人工可控**: 所有权变更需人工确认，可追溯
5. **市场独立**: 三个市场的进化互不干扰
