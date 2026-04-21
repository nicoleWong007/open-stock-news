// Market types
export type Market = 'us' | 'a_share' | 'hk';

// Recommendation types
export type Recommendation = 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';

// Verdict types
export type Verdict = 'correct' | 'incorrect' | 'partial';

// Principle types
export type PrincipleCategory = 'maxim' | 'rule' | 'heuristic' | 'adjustment';
export type PrincipleStatus = 'pending' | 'approved' | 'rejected';

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
    // A-share specific
    isStar?: boolean;      // 科创板
    isChiNext?: boolean;   // 创业板
    isBei?: boolean;       // 北交所
    // HK specific
    isHkTech?: boolean;
    isHkMainland?: boolean;
    // US specific
    isSp500?: boolean;
    isNasdaq100?: boolean;
    isEtf?: boolean;
  };
}

// Market indicators
export interface MarketIndicators {
  // US-specific
  sp500Trend?: string;
  nasdaqTrend?: string;
  fedRateEnvironment?: string;
  // A-share specific
  shanghaiIndexTrend?: string;
  northboundFlow?: number;    // 北向资金
  marginBalance?: number;      // 融资余额
  // HK specific
  hangSengTrend?: string;
  southboundFlow?: number;     // 南向资金
  ahPremium?: number;          // AH溢价
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

// Evidence detail for proposed principles
export interface EvidenceDetail {
  supportingRecords: string[];
  supportingCount: number;
  contradictingCount: number;
  successRate: number;
}

// Proposed principle
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

// Market stats
export interface MarketStats {
  overall: {
    totalRecommendations: number;
    correct: number;
    incorrect: number;
    partial: number;
    accuracyRate: number;
  };
  byCategory: Record<string, {
    count: number;
    accuracy: number;
    avgReturn: number;
  }>;
  bySector: Record<string, {
    count: number;
    accuracy: number;
    avgReturn: number;
  }>;
  byType: Record<string, {
    total: number;
    correct: number;
    accuracy: number;
  }>;
  byCycleScore: Record<string, {
    count: number;
    accuracy: number;
  }>;
  benchmarkReturns: {
    '1w': number;
    '1m': number;
    '3m': number;
    '6m': number;
    '1y': number;
  };
}

// Evolution stats
export interface EvolutionStats {
  lastUpdated: string;
  markets: {
    us: MarketStats;
    a_share: MarketStats;
    hk: MarketStats;
  };
  crossMarket: {
    bestPerformingMarket: string;
    marketAccuracies: Record<string, number>;
  };
}

// Pattern match for reflection
export interface PatternMatch {
  pattern: string;
  occurrences: number;
  successRate: number;
  examples: string[];
}

// Reflection result
export interface ReflectionResult {
  market: Market;
  recordsAnalyzed: number;
  successfulPatterns: PatternMatch[];
  failurePatterns: PatternMatch[];
  categoryInsights: Record<string, string>;
  proposedPrinciples: ProposedPrinciple[];
}
