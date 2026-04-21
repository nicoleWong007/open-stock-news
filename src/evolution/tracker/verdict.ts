import type { Recommendation, Verdict } from '../types.js';

export function classifyVerdict(
  rec: Recommendation,
  returnPercent: number,
  benchmarkReturn: number
): Verdict {
  const excessReturn = returnPercent - benchmarkReturn;

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
      return 'partial';
  }
}

export function calculateAccuracy(
  correct: number,
  partial: number,
  total: number
): number {
  if (total === 0) return 0;
  return ((correct + 0.5 * partial) / total) * 100;
}
