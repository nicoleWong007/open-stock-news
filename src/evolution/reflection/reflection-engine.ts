import fs from 'node:fs';
import path from 'node:path';
import type { AnalysisRecord, Market, ProposedPrinciple, ReflectionResult } from '../types.js';
import { ExperienceStore } from '../memory/experience-store.js';
import { StatsCalculator } from '../stats/stats-calculator.js';
import { PatternDetector } from './pattern-detector.js';
import { getCandidatesDir, generateId } from '../helpers.js';

export class ReflectionEngine {
  private store: ExperienceStore;
  private calculator: StatsCalculator;
  private detector: PatternDetector;

  constructor() {
    this.store = new ExperienceStore();
    this.calculator = new StatsCalculator();
    this.detector = new PatternDetector();
  }

  async reflect(market: Market): Promise<ReflectionResult> {
    const records = await this.store.query({
      market,
      hasOutcome: true,
    });

    const stats = this.calculator.calculateMarketStats(records);
    const { successful, failures } = this.detector.detectPatterns(records);

    const proposedPrinciples = this.generateProposedPrinciples(
      market,
      stats
    );

    for (const principle of proposedPrinciples) {
      await this.saveProposal(principle);
    }

    const categoryInsights = this.extractCategoryInsights(stats);

    return {
      market,
      recordsAnalyzed: records.length,
      successfulPatterns: successful,
      failurePatterns: failures,
      categoryInsights,
      proposedPrinciples,
    };
  }

  private generateProposedPrinciples(
    market: Market,
    stats: ReturnType<StatsCalculator['calculateMarketStats']>
  ): ProposedPrinciple[] {
    const principles: ProposedPrinciple[] = [];

    if (stats.byType['strong_buy'] && stats.byType['strong_buy'].accuracy > 70) {
      principles.push({
        id: generateId('prop'),
        proposedAt: new Date().toISOString(),
        applicableMarkets: [market],
        title: `Strong buy signals are reliable in ${market}`,
        description: `Strong buy recommendations have shown ${stats.byType['strong_buy'].accuracy.toFixed(0)}% accuracy. Consider increasing confidence for similar signals.`,
        category: 'heuristic',
        evidence: {
          byMarket: {
            [market]: {
              supportingRecords: [],
              supportingCount: stats.byType['strong_buy'].total,
              contradictingCount: 0,
              successRate: stats.byType['strong_buy'].accuracy,
            },
          },
          overallSuccessRate: stats.byType['strong_buy'].accuracy,
        },
        status: 'pending',
      });
    }

    if (stats.byType['sell'] && stats.byType['sell'].accuracy > 60) {
      principles.push({
        id: generateId('prop'),
        proposedAt: new Date().toISOString(),
        applicableMarkets: [market],
        title: `Sell signals are accurate in ${market}`,
        description: `Sell recommendations have shown ${stats.byType['sell'].accuracy.toFixed(0)}% accuracy. Trust these signals.`,
        category: 'rule',
        evidence: {
          byMarket: {
            [market]: {
              supportingRecords: [],
              supportingCount: stats.byType['sell'].total,
              contradictingCount: 0,
              successRate: stats.byType['sell'].accuracy,
            },
          },
          overallSuccessRate: stats.byType['sell'].accuracy,
        },
        status: 'pending',
      });
    }

    return principles;
  }

  private extractCategoryInsights(
    stats: ReturnType<StatsCalculator['calculateMarketStats']>
  ): Record<string, string> {
    const insights: Record<string, string> = {};

    for (const [category, data] of Object.entries(stats.byCategory)) {
      if (data.accuracy > 70) {
        insights[category] = `High accuracy (${data.accuracy.toFixed(0)}%). Consider prioritizing.`;
      } else if (data.accuracy < 40) {
        insights[category] = `Low accuracy (${data.accuracy.toFixed(0)}%). Requires more caution.`;
      }
    }

    return insights;
  }

  private async saveProposal(principle: ProposedPrinciple): Promise<void> {
    const baseDir = getCandidatesDir();
    const marketDir = path.join(baseDir, principle.applicableMarkets[0]);
    
    if (!fs.existsSync(marketDir)) {
      fs.mkdirSync(marketDir, { recursive: true });
    }

    const filePath = path.join(marketDir, `${principle.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(principle, null, 2), 'utf-8');
  }
}
