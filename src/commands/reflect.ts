import type { Command } from 'commander';
import chalk from 'chalk';
import { ReflectionEngine } from '../evolution/reflection/reflection-engine.js';
import { MARKET_DISPLAY_NAMES } from '../evolution/helpers.js';
import type { Market } from '../evolution/types.js';

export function registerReflectCommand(program: Command): void {
  program
    .command('reflect')
    .description('Run reflection on past recommendations')
    .option('-m, --market <market>', 'Reflect on specific market (us, a_share, hk)')
    .option('--all', 'Reflect on all markets')
    .action(async (options: { market?: Market; all?: boolean }) => {
      console.log(chalk.bold('\n🧠 Running Reflection\n'));

      try {
        const engine = new ReflectionEngine();
        const markets: Market[] = options.all
          ? ['us', 'a_share', 'hk']
          : options.market
            ? [options.market]
            : ['us', 'a_share', 'hk'];

        for (const market of markets) {
          console.log(chalk.cyan.bold(`\n${MARKET_DISPLAY_NAMES[market]}`));
          console.log('─'.repeat(40));

          const result = await engine.reflect(market);

          console.log(`Records analyzed: ${result.recordsAnalyzed}`);

          if (result.successfulPatterns.length > 0) {
            console.log(chalk.green('\n✓ Successful Patterns:'));
            for (const p of result.successfulPatterns.slice(0, 3)) {
              console.log(`  • ${p.pattern} (${p.occurrences} occurrences)`);
            }
          }

          if (result.failurePatterns.length > 0) {
            console.log(chalk.red('\n✗ Failure Patterns:'));
            for (const p of result.failurePatterns.slice(0, 3)) {
              console.log(`  • ${p.pattern} (${p.occurrences} occurrences)`);
            }
          }

          if (result.proposedPrinciples.length > 0) {
            console.log(chalk.yellow('\n📝 Proposed Principles:'));
            for (const p of result.proposedPrinciples) {
              console.log(`  • ${p.title}`);
              console.log(chalk.dim(`    ${p.description.substring(0, 80)}...`));
            }
          }

          if (Object.keys(result.categoryInsights).length > 0) {
            console.log(chalk.dim('\nCategory Insights:'));
            for (const [cat, insight] of Object.entries(result.categoryInsights)) {
              console.log(`  ${cat}: ${insight}`);
            }
          }
        }

        console.log(chalk.dim('\nRun `oak-invest review list` to approve proposed principles.\n'));

      } catch (err) {
        console.error(chalk.red(`\nReflection failed: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });
}
