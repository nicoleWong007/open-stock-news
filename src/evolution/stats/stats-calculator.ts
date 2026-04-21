import type { AnalysisRecord, Market, MarketStats, EvolutionStats } from '../types.js';
import { classifyVerdict, calculateAccuracy } from '../tracker/verdict.js';

export class StatsCalculator {
  calculateMarketStats(records: AnalysisRecord[]): MarketStats {
    const withOutcome = records.filter(r => r.outcome);
    
    const overall = this.calculateOverallStats(withOutcome);
    const byCategory = this.calculateByCategory(withOutcome);
    const bySector = this.calculateBySector(withOutcome);
    const byType = this.calculateByType(withOutcome);
    const byCycleScore = this.calculateByCycleScore(withOutcome);

    return {
      overall,
      byCategory,
      bySector,
      byType,
      byCycleScore,
      benchmarkReturns: {
        '1w': 0,
        '1m': 0,
        '3m': 0,
        '6m': 0,
        '1y': 0,
      },
    };
  }

  private calculateOverallStats(records: AnalysisRecord[]): MarketStats['overall'] {
    const total = records.length;
    let correct = 0;
    let incorrect = 0;
    let partial = 0;

    for (const record of records) {
      if (record.outcome) {
        switch (record.outcome.verdict) {
          case 'correct':
            correct++;
            break;
          case 'incorrect':
            incorrect++;
            break;
          case 'partial':
            partial++;
            break;
        }
      }
    }

    return {
      totalRecommendations: total,
      correct,
      incorrect,
      partial,
      accuracyRate: calculateAccuracy(correct, partial, total),
    };
  }

  private calculateByCategory(records: AnalysisRecord[]): MarketStats['byCategory'] {
    const result: MarketStats['byCategory'] = {};

    for (const record of records) {
      const category = record.stockCategory.type;
      if (!result[category]) {
        result[category] = { count: 0, accuracy: 0, avgReturn: 0 };
      }
      result[category].count++;
      if (record.outcome) {
        result[category].avgReturn += record.outcome.returns.absolute;
      }
    }

    for (const cat of Object.keys(result)) {
      const catRecords = records.filter(r => r.stockCategory.type === cat && r.outcome);
      const correct = catRecords.filter(r => r.outcome?.verdict === 'correct').length;
      const partial = catRecords.filter(r => r.outcome?.verdict === 'partial').length;
      result[cat].accuracy = calculateAccuracy(correct, partial, catRecords.length);
      result[cat].avgReturn = catRecords.length > 0 
        ? result[cat].avgReturn / catRecords.length 
        : 0;
    }

    return result;
  }

  private calculateBySector(records: AnalysisRecord[]): MarketStats['bySector'] {
    const result: MarketStats['bySector'] = {};

    for (const record of records) {
      const sector = record.stockCategory.sector || 'unknown';
      if (!result[sector]) {
        result[sector] = { count: 0, accuracy: 0, avgReturn: 0 };
      }
      result[sector].count++;
      if (record.outcome) {
        result[sector].avgReturn += record.outcome.returns.absolute;
      }
    }

    for (const sec of Object.keys(result)) {
      const secRecords = records.filter(r => r.stockCategory.sector === sec && r.outcome);
      const correct = secRecords.filter(r => r.outcome?.verdict === 'correct').length;
      const partial = secRecords.filter(r => r.outcome?.verdict === 'partial').length;
      result[sec].accuracy = calculateAccuracy(correct, partial, secRecords.length);
      result[sec].avgReturn = secRecords.length > 0 
        ? result[sec].avgReturn / secRecords.length 
        : 0;
    }

    return result;
  }

  private calculateByType(records: AnalysisRecord[]): MarketStats['byType'] {
    const result: MarketStats['byType'] = {};

    for (const record of records) {
      const type = record.decision.recommendation;
      if (!result[type]) {
        result[type] = { total: 0, correct: 0, accuracy: 0 };
      }
      result[type].total++;
      if (record.outcome?.verdict === 'correct') {
        result[type].correct++;
      }
    }

    for (const type of Object.keys(result)) {
      result[type].accuracy = result[type].total > 0
        ? (result[type].correct / result[type].total) * 100
        : 0;
    }

    return result;
  }

  private calculateByCycleScore(records: AnalysisRecord[]): MarketStats['byCycleScore'] {
    const result: MarketStats['byCycleScore'] = {};

    for (const record of records) {
      const score = record.context.cycleScore;
      let range: string;
      if (score <= 3) range = '0-3';
      else if (score <= 5) range = '4-5';
      else if (score === 6) range = '6';
      else if (score <= 8) range = '7-8';
      else range = '9-10';

      if (!result[range]) {
        result[range] = { count: 0, accuracy: 0 };
      }
      result[range].count++;
    }

    for (const range of Object.keys(result)) {
      const rangeRecords = records.filter(r => {
        const score = r.context.cycleScore;
        let r2: string;
        if (score <= 3) r2 = '0-3';
        else if (score <= 5) r2 = '4-5';
        else if (score === 6) r2 = '6';
        else if (score <= 8) r2 = '7-8';
        else r2 = '9-10';
        return r2 === range && r.outcome;
      });
      const correct = rangeRecords.filter(r => r.outcome?.verdict === 'correct').length;
      const partial = rangeRecords.filter(r => r.outcome?.verdict === 'partial').length;
      result[range].accuracy = calculateAccuracy(correct, partial, rangeRecords.length);
    }

    return result;
  }

  calculateEvolutionStats(records: AnalysisRecord[]): EvolutionStats {
    const usRecords = records.filter(r => r.market === 'us');
    const aShareRecords = records.filter(r => r.market === 'a_share');
    const hkRecords = records.filter(r => r.market === 'hk');

    const usStats = this.calculateMarketStats(usRecords);
    const aShareStats = this.calculateMarketStats(aShareRecords);
    const hkStats = this.calculateMarketStats(hkRecords);

    const marketAccuracies: Record<string, number> = {
      us: usStats.overall.accuracyRate,
      a_share: aShareStats.overall.accuracyRate,
      hk: hkStats.overall.accuracyRate,
    };

    const bestMarket = Object.entries(marketAccuracies)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'us';

    return {
      lastUpdated: new Date().toISOString(),
      markets: {
        us: usStats,
        a_share: aShareStats,
        hk: hkStats,
      },
      crossMarket: {
        bestPerformingMarket: bestMarket,
        marketAccuracies,
      },
    };
  }
}
