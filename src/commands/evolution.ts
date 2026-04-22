import type { Command } from 'commander';
import chalk from 'chalk';
import { ExperienceStore } from '../evolution/memory/experience-store.js';
import { StatsCalculator } from '../evolution/stats/stats-calculator.js';
import { startEvolutionScheduler, stopEvolutionScheduler, isSchedulerRunning } from '../evolution/scheduler/evolution-scheduler.js';
import { loadConfig } from '../config/loader.js';
import { MARKET_DISPLAY_NAMES } from '../evolution/helpers.js';
import type { Market } from '../evolution/types.js';

export function registerEvolutionCommand(program: Command): void {
  const evolutionCmd = program
    .command('evolution')
    .description('Evolution system management');

  evolutionCmd
    .command('status')
    .description('Show evolution system status')
    .action(async () => {
      console.log(chalk.bold('\n🔄 Evolution Status\n'));

      try {
        const store = new ExperienceStore();
        const stats = await store.getStats();

        console.log(`Total Records: ${stats.total}`);
        console.log(`With Outcome: ${stats.withOutcome}`);
        console.log(`With Reflection: ${stats.withReflection}`);
        console.log();

        console.log('By Market:');
        for (const [market, count] of Object.entries(stats.byMarket)) {
          const name = MARKET_DISPLAY_NAMES[market as Market];
          const bar = '█'.repeat(Math.floor(count / 2));
          console.log(`  ${name}: ${bar} ${count}`);
        }
        console.log();

        console.log(`Scheduler: ${isSchedulerRunning() ? chalk.green('Running') : chalk.dim('Stopped')}`);
        console.log();

      } catch (err) {
        console.error(chalk.red(`\nFailed to get status: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });

  evolutionCmd
    .command('stats')
    .description('Show detailed evolution statistics')
    .option('-m, --market <market>', 'Filter by market')
    .action(async (options: { market?: Market }) => {
      console.log(chalk.bold('\n📊 Evolution Statistics\n'));

      try {
        const store = new ExperienceStore();
        const calculator = new StatsCalculator();

        const records = await store.getAll();
        const filtered = options.market
          ? records.filter(r => r.market === options.market)
          : records;

        if (filtered.length === 0) {
          console.log(chalk.yellow('No records found.\n'));
          return;
        }

        const stats = calculator.calculateEvolutionStats(filtered);

        const markets = options.market
          ? [options.market]
          : (['us', 'a_share', 'hk'] as Market[]);

        for (const market of markets) {
          const marketStats = stats.markets[market];
          const name = MARKET_DISPLAY_NAMES[market];

          console.log(chalk.cyan.bold(name));
          console.log('─'.repeat(30));
          console.log(`Accuracy: ${marketStats.overall.accuracyRate.toFixed(1)}%`);
          console.log(`Total: ${marketStats.overall.totalRecommendations}`);
          console.log(`Correct: ${marketStats.overall.correct}`);
          console.log(`Partial: ${marketStats.overall.partial}`);
          console.log(`Incorrect: ${marketStats.overall.incorrect}`);
          console.log();
        }

        if (!options.market) {
          console.log(chalk.bold('Cross-Market:'));
          console.log(`Best: ${stats.crossMarket.bestPerformingMarket}`);
          for (const [market, accuracy] of Object.entries(stats.crossMarket.marketAccuracies)) {
            console.log(`  ${market}: ${accuracy.toFixed(1)}%`);
          }
        }

        console.log();

      } catch (err) {
        console.error(chalk.red(`\nFailed to get stats: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });

  evolutionCmd
    .command('start')
    .description('Start the evolution scheduler')
    .action(async () => {
      console.log(chalk.bold('\n▶️ Starting Evolution Scheduler\n'));

      try {
        const config = loadConfig();
        startEvolutionScheduler(config);
        console.log();
      } catch (err) {
        console.error(chalk.red(`\nFailed to start scheduler: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });

  evolutionCmd
    .command('stop')
    .description('Stop the evolution scheduler')
    .action(() => {
      console.log(chalk.bold('\n⏹️ Stopping Evolution Scheduler\n'));
      stopEvolutionScheduler();
      console.log();
    });
}
