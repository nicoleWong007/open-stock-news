import path from 'node:path';
import os from 'node:os';
import type { Market } from './types.js';

// Market names for display
export const MARKET_NAMES: Record<Market, string> = {
  us: 'US Market',
  a_share: 'A-Share Market',
  hk: 'HK Market',
};

export const MARKET_DISPLAY_NAMES = MARKET_NAMES;

// Detect market from symbol format
export function detectMarket(symbol: string): Market {
  // US stocks: uppercase letters only (AAPL, MSFT)
  if (/^[A-Z]+$/.test(symbol)) {
    return 'us';
  }
  // A-shares: end with .SH or .SZ (000001.SZ, 600519.SH)
  if (/\.(SH|SZ)$/.test(symbol)) {
    return 'a_share';
  }
  // HK stocks: end with .HK (0700.HK, 9988.HK)
  if (/\.HK$/.test(symbol)) {
    return 'hk';
  }
  throw new Error(`Unknown symbol format: ${symbol}`);
}

// Generate unique ID for records
export function generateId(prefix: string = 'rec'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

// Get base data directory
export function getDataDir(): string {
  return path.join(os.homedir(), '.oak-invest');
}

// Get experience storage directory
export function getExperienceDir(): string {
  return path.join(getDataDir(), 'experiences');
}

// Get candidates directory
export function getCandidatesDir(): string {
  return path.join(getDataDir(), 'candidates');
}

// Get evolution stats file path
export function getStatsFilePath(): string {
  return path.join(getDataDir(), 'evolution-stats.json');
}

// Get evolution log file path
export function getLogFilePath(): string {
  return path.join(getDataDir(), 'evolution-log.json');
}

// Slugify string for filenames
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-') // Allow Chinese characters
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

// Format date for storage
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

// Get month folder name from timestamp
export function getMonthFolder(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Calculate days between two dates
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
