import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import type {
  MarketDataSource,
  StockQuote,
  OHLCV,
  FinancialReport,
  ValuationMetrics,
} from '../types.js';
import { withRetry, withTimeout } from './utils.js';

export class YahooFinanceSource implements MarketDataSource {
  async getQuote(symbol: string): Promise<StockQuote> {
    return withTimeout(
      withRetry(async () => {
        const quote = await yahooFinance.quote(symbol);
        const regularMarketPrice = quote.regularMarketPrice ?? 0;
        const regularMarketChange = quote.regularMarketChange ?? 0;
        const regularMarketChangePercent = quote.regularMarketChangePercent ?? 0;

        return {
          symbol,
          name: quote.shortName ?? quote.longName ?? symbol,
          price: regularMarketPrice,
          change: regularMarketChange,
          changePercent: regularMarketChangePercent,
          volume: quote.regularMarketVolume ?? 0,
          marketCap: quote.marketCap ?? 0,
          currency: quote.currency ?? 'USD',
          exchange: quote.fullExchangeName ?? quote.exchange ?? '',
          timestamp: typeof quote.regularMarketTime === 'number' ? quote.regularMarketTime : Date.now(),
        };
      }, symbol),
      symbol,
    );
  }

  async getHistoricalPrices(symbol: string, range: string): Promise<OHLCV[]> {
    return withTimeout(
      withRetry(async () => {
        const results = await yahooFinance.historical(symbol, {
          period1: range,
        });
        return results.map((row) => ({
          date: row.date.toISOString().split('T')[0],
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
        }));
      }, symbol),
      symbol,
    );
  }

  async getFinancials(symbol: string): Promise<FinancialReport> {
    return withTimeout(
      withRetry(async () => {
        const summary = await yahooFinance.quoteSummary(symbol, {
          modules: ['financialData', 'defaultKeyStatistics', 'earnings'],
        });

        const fd = summary.financialData;
        const ks = summary.defaultKeyStatistics;

        return {
          symbol,
          period: 'annual',
          revenue: fd?.totalRevenue ?? 0,
          netIncome: 0,
          eps: ks?.trailingEps ?? 0,
          grossMargin: fd?.grossMargins ?? 0,
          operatingMargin: fd?.operatingMargins ?? 0,
          netMargin: fd?.profitMargins ?? 0,
          roe: fd?.returnOnEquity ?? 0,
          debtToEquity: fd?.debtToEquity ?? 0,
          currentRatio: fd?.currentRatio ?? 0,
          freeCashFlow: fd?.freeCashflow ?? 0,
          timestamp: Date.now(),
        };
      }, symbol),
      symbol,
    );
  }

  async getValuationMetrics(symbol: string): Promise<ValuationMetrics> {
    return withTimeout(
      withRetry(async () => {
        const summary = await yahooFinance.quoteSummary(symbol, {
          modules: ['defaultKeyStatistics', 'summaryDetail', 'financialData'],
        });

        const ks = summary.defaultKeyStatistics;
        const sd = summary.summaryDetail;

        return {
          symbol,
          pe: sd?.trailingPE ?? null,
          forwardPe: ks?.forwardPE ?? null,
          pb: ks?.priceToBook ?? null,
          ps: sd?.priceToSalesTrailing12Months ?? null,
          evToEbitda: ks?.enterpriseToEbitda ?? null,
          peg: ks?.pegRatio ?? null,
          dividendYield: sd?.dividendYield ?? null,
          timestamp: Date.now(),
        };
      }, symbol),
      symbol,
    );
  }
}

export function createYahooFinanceSource(): MarketDataSource {
  return new YahooFinanceSource();
}
