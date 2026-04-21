import type { AnalysisRecord, PatternMatch } from '../types.js';

export class PatternDetector {
  detectPatterns(records: AnalysisRecord[]): {
    successful: PatternMatch[];
    failures: PatternMatch[];
  } {
    const withOutcome = records.filter(r => r.outcome);
    const successful = withOutcome.filter(r => r.outcome?.verdict === 'correct');
    const failures = withOutcome.filter(r => r.outcome?.verdict === 'incorrect');

    return {
      successful: this.extractPatterns(successful, 'success'),
      failures: this.extractPatterns(failures, 'failure'),
    };
  }

  private extractPatterns(
    records: AnalysisRecord[],
    type: 'success' | 'failure'
  ): PatternMatch[] {
    const patterns: PatternMatch[] = [];

    const cyclePatterns = this.detectCyclePatterns(records);
    patterns.push(...cyclePatterns);

    const categoryPatterns = this.detectCategoryPatterns(records);
    patterns.push(...categoryPatterns);

    const recommendationPatterns = this.detectRecommendationPatterns(records);
    patterns.push(...recommendationPatterns);

    return patterns.sort((a, b) => b.successRate - a.successRate).slice(0, 10);
  }

  private detectCyclePatterns(records: AnalysisRecord[]): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    const ranges = ['0-3', '4-5', '6', '7-8', '9-10'] as const;

    for (const range of ranges) {
      const matching = records.filter(r => {
        const score = r.context.cycleScore;
        if (range === '0-3') return score <= 3;
        if (range === '4-5') return score >= 4 && score <= 5;
        if (range === '6') return score === 6;
        if (range === '7-8') return score >= 7 && score <= 8;
        return score >= 9;
      });

      if (matching.length >= 3) {
        patterns.push({
          pattern: `Cycle score ${range} with ${matching[0].decision.recommendation}`,
          occurrences: matching.length,
          successRate: (matching.length / records.length) * 100,
          examples: matching.slice(0, 3).map(r => r.id),
        });
      }
    }

    return patterns;
  }

  private detectCategoryPatterns(records: AnalysisRecord[]): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    const byCategory: Record<string, AnalysisRecord[]> = {};

    for (const record of records) {
      const cat = record.stockCategory.type;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(record);
    }

    for (const [category, matching] of Object.entries(byCategory)) {
      if (matching.length >= 2) {
        patterns.push({
          pattern: `${category} stocks`,
          occurrences: matching.length,
          successRate: (matching.length / records.length) * 100,
          examples: matching.slice(0, 3).map(r => r.id),
        });
      }
    }

    return patterns;
  }

  private detectRecommendationPatterns(records: AnalysisRecord[]): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    const byRec: Record<string, AnalysisRecord[]> = {};

    for (const record of records) {
      const rec = record.decision.recommendation;
      if (!byRec[rec]) byRec[rec] = [];
      byRec[rec].push(record);
    }

    for (const [rec, matching] of Object.entries(byRec)) {
      if (matching.length >= 2) {
        patterns.push({
          pattern: `${rec} recommendations`,
          occurrences: matching.length,
          successRate: (matching.length / records.length) * 100,
          examples: matching.slice(0, 3).map(r => r.id),
        });
      }
    }

    return patterns;
  }
}
