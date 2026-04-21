import type { AnalysisRecord, MarketStats, Market } from '../types.js';
import { MARKET_DISPLAY_NAMES } from '../helpers.js';

export function buildReflectionPrompt(
  market: Market,
  records: AnalysisRecord[],
  stats: MarketStats
): string {
  const marketName = MARKET_DISPLAY_NAMES[market];
  const formattedRecords = formatRecordsForPrompt(records.slice(0, 20));
  const categoryStats = formatCategoryStats(stats.byCategory);
  const typeStats = formatTypeStats(stats.byType);

  return `You are reflecting on investment recommendations for ${marketName}.

## Records to Analyze
${formattedRecords}

## Current Accuracy
- Overall: ${stats.overall.accuracyRate.toFixed(1)}%
- Total Recommendations: ${stats.overall.totalRecommendations}
- Correct: ${stats.overall.correct}
- Partial: ${stats.overall.partial}
- Incorrect: ${stats.overall.incorrect}

## By Category
${categoryStats}

## By Recommendation Type
${typeStats}

## Task
Analyze these records and identify patterns. Return JSON with this structure:

{
  "successfulPatterns": [
    {
      "pattern": "Description of the pattern",
      "occurrences": number,
      "successRate": number
    }
  ],
  "failurePatterns": [
    {
      "pattern": "Description of the pattern",
      "occurrences": number,
      "successRate": number
    }
  ],
  "categoryInsights": {
    "categoryName": "insight about this category"
  },
  "proposedPrinciples": [
    {
      "title": "Principle title",
      "description": "Detailed description",
      "category": "maxim|rule|heuristic|adjustment",
      "evidence": "Why this principle is proposed"
    }
  ]
}

Focus on:
1. What factors led to correct predictions?
2. What factors led to incorrect predictions?
3. Are there market-specific patterns?
4. What categories/sectors performed differently?
5. What adjustments to the decision rules would improve accuracy?`;
}

function formatRecordsForPrompt(records: AnalysisRecord[]): string {
  return records.map(r => {
    const outcome = r.outcome
      ? `Outcome: ${r.outcome.verdict} (${r.outcome.returns.absolute.toFixed(1)}%)`
      : 'Outcome: pending';
    return `
- ${r.symbol} (${r.stockCategory.type}, ${r.stockCategory.sector})
  Recommendation: ${r.decision.recommendation} (confidence: ${(r.decision.confidence * 100).toFixed(0)}%)
  Cycle Score: ${r.context.cycleScore}
  Key Factors: ${r.decision.keyFactors.slice(0, 3).join(', ')}
  ${outcome}`;
  }).join('\n');
}

function formatCategoryStats(stats: Record<string, { count: number; accuracy: number }>): string {
  return Object.entries(stats)
    .map(([cat, data]) => `- ${cat}: ${data.accuracy.toFixed(1)}% (${data.count} records)`)
    .join('\n');
}

function formatTypeStats(stats: Record<string, { total: number; correct: number; accuracy: number }>): string {
  return Object.entries(stats)
    .map(([type, data]) => `- ${type}: ${data.accuracy.toFixed(1)}% (${data.correct}/${data.total})`)
    .join('\n');
}
