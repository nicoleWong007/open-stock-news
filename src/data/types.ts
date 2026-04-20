export type StockSymbol = string;

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  currency: string;
  exchange: string;
  timestamp: number;
}

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinancialReport {
  symbol: string;
  period: 'quarterly' | 'annual';
  revenue: number;
  netIncome: number;
  eps: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  debtToEquity: number;
  currentRatio: number;
  freeCashFlow: number;
  timestamp: number;
}

export interface ValuationMetrics {
  symbol: string;
  pe: number | null;
  forwardPe: number | null;
  pb: number | null;
  ps: number | null;
  evToEbitda: number | null;
  peg: number | null;
  dividendYield: number | null;
  timestamp: number;
}

export interface MarketDataSource {
  getQuote(symbol: string): Promise<StockQuote>;
  getHistoricalPrices(symbol: string, range: string): Promise<OHLCV[]>;
  getFinancials(symbol: string): Promise<FinancialReport>;
  getValuationMetrics(symbol: string): Promise<ValuationMetrics>;
}
