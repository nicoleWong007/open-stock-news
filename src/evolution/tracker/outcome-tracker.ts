import type { Market, AnalysisRecord, AnalysisOutcome } from '../types.js';
import { MARKET_BENCHMARKS } from './benchmarks.js';
import { classifyVerdict } from './verdict.js';
import { daysBetween } from '../helpers.js';
import { createYahooFinanceSource } from '../../data/index.js';

const yahooSource = createYahooFinanceSource();

export interface TrackingResult {
  total: number;
  updated: number;
  errors: number;
  byMarket: Record<Market, { updated: number; errors: number }>;
}

export class OutcomeTracker {
  async trackRecords(records: AnalysisRecord[]): Promise<TrackingResult> {
    const result: TrackingResult = {
      total: records.length,
      updated: 0,
      errors: 0,
      byMarket: {
        us: { updated: 0, errors: 0 },
        a_share: { updated: 0, errors: 0 },
        hk: { updated: 0, errors: 0 },
      },
    };

    for (const record of records) {
      try {
        const outcome = await this.calculateReturn(record);
        if (outcome) {
          record.outcome = outcome;
          result.updated++;
          result.byMarket[record.market].updated++;
        }
      } catch (err) {
        result.errors++;
        result.byMarket[record.market].errors++;
      }
    }

    return result;
  }

  async calculateReturn(record: AnalysisRecord): Promise<AnalysisOutcome | null> {
    if (!record.decision) return null;

    const now = new Date();
    const holdingPeriodDays = daysBetween(record.timestamp, now.toISOString());

    if (holdingPeriodDays < 7) return null;

    try {
      const quote = await yahooSource.getQuote(record.symbol);
      const currentPrice = quote.price;

      const outcome: AnalysisOutcome = {
        trackedAt: now.toISOString(),
        holdingPeriodDays,
        prices: {
          atRecommendation: 0,
          current: currentPrice,
        },
        returns: {
          absolute: 0,
          vsBenchmark: 0,
        },
        verdict: 'partial',
      };

      return outcome;
    } catch (err) {
      throw new Error(`Failed to get price for ${record.symbol}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async getBenchmarkReturn(market: Market, _days: number): Promise<number> {
    const symbol = MARKET_BENCHMARKS[market];
    try {
      const quote = await yahooSource.getQuote(symbol);
      return quote.changePercent;
    } catch {
      return 0;
    }
  }
}
