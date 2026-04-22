import pLimit from 'p-limit';
import type { MarketDataSource, StockQuote, FinancialReport, ValuationMetrics } from '../types.js';
import { withRetry, withTimeout } from './utils.js';
import { getSymbolCache, SymbolCache } from './symbol-cache.js';
import { YahooFinanceSource } from './yahoo-finance.js';

export interface BatchFetcherOptions {
  maxConcurrency?: number;
  source?: MarketDataSource;
  cache?: SymbolCache;
  onProgress?: (current: number, total: number, symbol: string) => void;
}

export interface BatchFetchResult {
  quotes: Map<string, StockQuote>;
  financials: Map<string, FinancialReport>;
  valuations: Map<string, ValuationMetrics>;
  errors: Map<string, Error>;
}

const DEFAULT_MAX_CONCURRENCY = 5;

export class BatchFetcher {
  private limiter: ReturnType<typeof pLimit>;
  private source: MarketDataSource;
  private cache: SymbolCache;
  private onProgress?: (current: number, total: number, symbol: string) => void;
  private completedCount = 0;

  constructor(options: BatchFetcherOptions = {}) {
    const maxConcurrency = options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    this.limiter = pLimit(maxConcurrency);
    this.source = options.source ?? new YahooFinanceSource();
    this.cache = options.cache ?? getSymbolCache();
    this.onProgress = options.onProgress;
  }

  async prefetchBatch(symbols: string[]): Promise<BatchFetchResult> {
    const quotes = new Map<string, StockQuote>();
    const financials = new Map<string, FinancialReport>();
    const valuations = new Map<string, ValuationMetrics>();
    const errors = new Map<string, Error>();
    this.completedCount = 0;

    const totalOperations = symbols.length * 3;

    await Promise.all([
      this.fetchBatchOfType(symbols, 'quote', quotes, errors, totalOperations),
      this.fetchBatchOfType(symbols, 'financials', financials, errors, totalOperations),
      this.fetchBatchOfType(symbols, 'valuation', valuations, errors, totalOperations),
    ]);

    this.cache.setBatch(quotes, financials, valuations);

    return { quotes, financials, valuations, errors };
  }

  private async fetchBatchOfType<T>(
    symbols: string[],
    type: 'quote' | 'financials' | 'valuation',
    results: Map<string, T>,
    errors: Map<string, Error>,
    totalOperations: number
  ): Promise<void> {
    const fetchFn = this.getFetchFunction(type);

    await Promise.all(
      symbols.map((symbol) =>
        this.limiter(async () => {
          try {
            const data = await withRetry(
              () => withTimeout(fetchFn(symbol), symbol),
              symbol
            );
            results.set(symbol, data as T);
          } catch (err) {
            errors.set(symbol, err instanceof Error ? err : new Error(String(err)));
          } finally {
            this.completedCount++;
            if (this.onProgress) {
              this.onProgress(this.completedCount, totalOperations, symbol);
            }
          }
        })
      )
    );
  }

  private getFetchFunction(type: string): (symbol: string) => Promise<unknown> {
    switch (type) {
      case 'quote':
        return (s) => this.source.getQuote(s);
      case 'financials':
        return (s) => this.source.getFinancials(s);
      case 'valuation':
        return (s) => this.source.getValuationMetrics(s);
      default:
        throw new Error(`Unknown fetch type: ${type}`);
    }
  }
}
