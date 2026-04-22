import type { StockQuote, FinancialReport, ValuationMetrics } from '../types.js';

interface CachedSymbolData {
  quote?: StockQuote;
  financials?: FinancialReport;
  valuation?: ValuationMetrics;
  fetchedAt: number;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export class SymbolCache {
  private cache = new Map<string, CachedSymbolData>();
  private ttlMs: number;

  constructor(ttlMs: number = FIVE_MINUTES_MS) {
    this.ttlMs = ttlMs;
  }

  get(symbol: string, type: 'quote' | 'financials' | 'valuation'): StockQuote | FinancialReport | ValuationMetrics | null {
    const entry = this.cache.get(symbol);
    if (!entry) return null;

    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.cache.delete(symbol);
      return null;
    }

    return entry[type] ?? null;
  }

  set(symbol: string, type: 'quote', data: StockQuote): void;
  set(symbol: string, type: 'financials', data: FinancialReport): void;
  set(symbol: string, type: 'valuation', data: ValuationMetrics): void;
  set(symbol: string, type: string, data: unknown): void {
    let entry = this.cache.get(symbol);
    if (!entry) {
      entry = { fetchedAt: Date.now() };
      this.cache.set(symbol, entry);
    }
    if (type === 'quote') {
      entry.quote = data as StockQuote;
    } else if (type === 'financials') {
      entry.financials = data as FinancialReport;
    } else if (type === 'valuation') {
      entry.valuation = data as ValuationMetrics;
    }
    entry.fetchedAt = Date.now();
  }

  setBatch(
    quotes: Map<string, StockQuote>,
    financials: Map<string, FinancialReport>,
    valuations: Map<string, ValuationMetrics>
  ): void {
    const now = Date.now();
    const symbols = new Set([
      ...quotes.keys(),
      ...financials.keys(),
      ...valuations.keys(),
    ]);

    for (const symbol of symbols) {
      let entry = this.cache.get(symbol);
      if (!entry) {
        entry = { fetchedAt: now };
        this.cache.set(symbol, entry);
      }
      if (quotes.has(symbol)) entry.quote = quotes.get(symbol);
      if (financials.has(symbol)) entry.financials = financials.get(symbol);
      if (valuations.has(symbol)) entry.valuation = valuations.get(symbol);
      entry.fetchedAt = now;
    }
  }

  needsPrefetch(symbols: string[]): boolean {
    return symbols.some(s => !this.cache.has(s));
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      entries: this.cache.size,
      symbols: Array.from(this.cache.keys()),
    };
  }
}

let globalSymbolCache: SymbolCache | null = null;

export function getSymbolCache(): SymbolCache {
  if (!globalSymbolCache) {
    globalSymbolCache = new SymbolCache();
  }
  return globalSymbolCache;
}

export function clearSymbolCache(): void {
  if (globalSymbolCache) {
    globalSymbolCache.clear();
  }
  globalSymbolCache = null;
}
