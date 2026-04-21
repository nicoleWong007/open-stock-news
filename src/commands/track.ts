import type { Command } from 'commander';
import chalk from 'chalk';
import { ExperienceStore } from '../evolution/memory/experience-store.js';
import { OutcomeTracker } from '../evolution/tracker/outcome-tracker.js';
import { StatsCalculator } from '../evolution/stats/stats-calculator.js';
import { MARKET_DISPLAY_NAMES } from '../evolution/helpers.js';
import type { Market } from '../evolution/types.js';

export function registerTrackCommand(program: Command): void {
  program
    .command('track')
    .description('Track outcomes for pending recommendations')
    .option('-m, --market <market>', 'Track specific market (us, a_share, hk)')
    .option('-s, --symbol <symbol>', 'Track specific symbol')
    .action(async (options: { market?: Market; symbol?: string }) => {
      console.log(chalk.bold('\n📊 Tracking Outcomes\n'));

      try {
        const store = new ExperienceStore();
        const tracker = new OutcomeTracker();

        let records = await store.getPendingTracking(7);

        if (options.market) {
          records = records.filter(r => r.market === options.market);
        }
        if (options.symbol) {
          records = records.filter(r => r.symbol === options.symbol);
        }

        if (records.length === 0) {
          console.log(chalk.yellow('No pending records to track.\n'));
          return;
        }

        console.log(chalk.dim(`Found ${records.length} records to track...\n`));

        const result = await tracker.trackRecords(records);

        for (const record of records) {
          if (record.outcome) {
            await store.updateOutcome(record.id, record.outcome);
          }
        }

        console.log(chalk.green(`\n✓ Tracking complete:`));
        console.log(`  Updated: ${result.updated}`);
        if (result.errors > 0) {
          console.log(chalk.yellow(`  Errors: ${result.errors}`));
        }
        console.log();

      } catch (err) {
        console.error(chalk.red(`\nTracking failed: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });
}

export function registerAccuracyReportCommand(program: Command): void {
  program
    .command('accuracy-report')
    .description('Show accuracy statistics for recommendations')
    .option('-m, --market <market>', 'Filter by market (us, a_share, hk)')
    .option('-p, --period <period>', 'Time period (1m, 3m, 6m, 1y)', '3m')
    .option('--by-category', 'Show breakdown by stock category')
    .option('--by-sector', 'Show breakdown by sector')
    .action(async (options: {
      market?: Market;
      period: string;
      byCategory?: boolean;
      bySector?: boolean;
    }) => {
      console.log(chalk.bold('\n📈 Accuracy Report\n'));

      try {
        const store = new ExperienceStore();
        const calculator = new StatsCalculator();

        const periodDays: Record<string, number> = {
          '1w': 7,
          '1m': 30,
          '3m': 90,
          '6m': 180,
          '1y': 365,
        };

        const days = periodDays[options.period] || 90;
        const from = new Date();
        from.setDate(from.getDate() - days);

        let records = await store.query({ from, hasOutcome: true });

        if (options.market) {
          records = records.filter(r => r.market === options.market);
        }

        if (records.length === 0) {
          console.log(chalk.yellow('No records found for the specified period.\n'));
          return;
        }

        const stats = calculator.calculateEvolutionStats(records);

        const markets = options.market ? [options.market] : (['us', 'a_share', 'hk'] as Market[]);

        for (const market of markets) {
          const marketStats = stats.markets[market];
          const name = MARKET_DISPLAY_NAMES[market];

          console.log(chalk.bold.cyan(`\n${name}`));
          console.log('─'.repeat(40));

          const { overall } = marketStats;
          console.log(`Overall Accuracy: ${formatPercent(overall.accuracyRate)}`);
          console.log(`Total: ${overall.totalRecommendations} | Correct: ${overall.correct} | Partial: ${overall.partial} | Incorrect: ${overall.incorrect}`);

          if (options.byCategory && Object.keys(marketStats.byCategory).length > 0) {
            console.log(chalk.dim('\nBy Category:'));
            for (const [cat, data] of Object.entries(marketStats.byCategory)) {
              console.log(`  ${cat}: ${formatPercent(data.accuracy)} (${data.count})`);
            }
          }

          if (options.bySector && Object.keys(marketStats.bySector).length > 0) {
            console.log(chalk.dim('\nBy Sector:'));
            for (const [sector, data] of Object.entries(marketStats.bySector)) {
              console.log(`  ${sector}: ${formatPercent(data.accuracy)} (${data.count})`);
            }
          }

          if (Object.keys(marketStats.byType).length > 0) {
            console.log(chalk.dim('\nBy Recommendation:'));
            for (const [type, data] of Object.entries(marketStats.byType)) {
              console.log(`  ${type}: ${formatPercent(data.accuracy)} (${data.correct}/${data.total})`);
            }
          }
        }

        console.log();

      } catch (err) {
        console.error(chalk.red(`\nFailed to generate report: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });
}

export function registerExperienceCommand(program: Command): void {
  program
    .command('experience')
    .description('Manage experience records')
    .command('list')
    .description('List experience records')
    .option('-m, --market <market>', 'Filter by market')
    .option('-s, --symbol <symbol>', 'Filter by symbol')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(async (options: { market?: Market; symbol?: string; limit: string }) => {
      const store = new ExperienceStore();
      const limit = parseInt(options.limit, 10);

      const records = await store.query({
        market: options.market,
        symbol: options.symbol,
      });

      const limited = records.slice(0, limit);

      console.log(chalk.bold('\n📚 Experience Records\n'));

      if (limited.length === 0) {
        console.log(chalk.yellow('No records found.\n'));
        return;
      }

      for (const record of limited) {
        const status = record.outcome
          ? chalk.green('✓')
          : chalk.yellow('⏳');
        console.log(`${status} ${record.id}`);
        console.log(`   ${record.symbol} (${record.market}) - ${record.decision.recommendation}`);
        console.log(`   ${new Date(record.timestamp).toLocaleDateString()}`);
        console.log();
      }

      console.log(chalk.dim(`Showing ${limited.length} of ${records.length} records\n`));
    });

  program
    .command('experience show <id>')
    .description('Show details of an experience record')
    .action(async (id: string) => {
      const store = new ExperienceStore();
      const record = await store.get(id);

      if (!record) {
        console.error(chalk.red(`\nRecord not found: ${id}\n`));
        process.exit(1);
      }

      console.log(chalk.bold('\n📄 Experience Record\n'));
      console.log(`ID: ${record.id}`);
      console.log(`Symbol: ${record.symbol}`);
      console.log(`Market: ${record.market}`);
      console.log(`Timestamp: ${record.timestamp}`);
      console.log(`\nRecommendation: ${chalk.cyan(record.decision.recommendation)}`);
      console.log(`Confidence: ${(record.decision.confidence * 100).toFixed(0)}%`);
      console.log(`\nReasoning:\n${record.decision.reasoning}`);

      if (record.outcome) {
        console.log(chalk.bold('\n📊 Outcome'));
        console.log(`Tracked: ${record.outcome.trackedAt}`);
        console.log(`Holding Period: ${record.outcome.holdingPeriodDays} days`);
        console.log(`Return: ${record.outcome.returns.absolute.toFixed(2)}%`);
        console.log(`vs Benchmark: ${record.outcome.returns.vsBenchmark.toFixed(2)}%`);
        console.log(`Verdict: ${formatVerdict(record.outcome.verdict)}`);
      }

      console.log();
    });
}

function formatPercent(value: number): string {
  const formatted = value.toFixed(1);
  if (value >= 70) return chalk.green(`${formatted}%`);
  if (value >= 50) return chalk.yellow(`${formatted}%`);
  return chalk.red(`${formatted}%`);
}

function formatVerdict(verdict: string): string {
  switch (verdict) {
    case 'correct':
      return chalk.green('✓ Correct');
    case 'incorrect':
      return chalk.red('✗ Incorrect');
    case 'partial':
      return chalk.yellow('◐ Partial');
    default:
      return verdict;
  }
}
