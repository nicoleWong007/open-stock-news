import type { Market } from '../types.js';

export const MARKET_BENCHMARKS: Record<Market, string> = {
  us: 'SPY',
  a_share: '000300.SZ',
  hk: '^HSI',
};

export const TRACKING_INTERVALS = [7, 30, 90, 180, 365];

export const MARKET_DISPLAY_NAMES: Record<Market, string> = {
  us: 'US Market',
  a_share: 'A-Share Market',
  hk: 'HK Market',
};

export const VERDICT_THRESHOLDS = {
  correct: {
    buy: 5,
    sell: -5,
    hold: 5,
  },
  partial: {
    buy: 0,
    sell: 0,
    hold: 10,
  },
};
