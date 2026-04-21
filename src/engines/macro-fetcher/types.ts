// Index data (for S&P 500, NASDAQ, DOW)
export interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// Sector performance data
export interface SectorData {
  name: string;
  symbol: string;
  changePercent: number;
}

// Market sentiment data
export interface SentimentData {
  vix: number;
  vixClose: number;
  putCallRatio: number;
}

// Economic indicators
export interface EconomicData {
  tenYearYield: number;
  federalFundsRate: number;
  unemploymentRate: number;
  gdpGrowth: number;
}

// Commodity prices
export interface CommoditiesData {
  dxy: number;
  wti: number;
  gold: number;
}

// Full market context
export interface MarketContext {
  indices: {
    sp500: IndexData;
    nasdaq: IndexData;
    dow: IndexData;
  };
  sectors: SectorData[];
  sentiment: SentimentData;
  economic: EconomicData;
  commodities: CommoditiesData;
  metadata: {
    fetchedAt: number;
    marketDate: string;
    ttl: number;
  };
}

// Cache structure
export interface MacroCache {
  data: MarketContext;
  fetchedAt: number;
  marketDate: string;
}

// Configuration
export interface MacroConfig {
  cacheTtlMs: number;
  fredApiKey?: string;
  enabled: boolean;
}
