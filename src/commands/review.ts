import type { Command } from 'commander';
import chalk from 'chalk';
import { KnowledgeCurator } from '../evolution/curator/knowledge-curator.js';
import { formatPrincipleForTerminal } from '../evolution/curator/principle-formatter.js';
import type { Market } from '../evolution/types.js';

export function registerReviewCommand(program: Command): void {
  program
    .command('review list')
    .description('List pending principles for review')
    .option('-m, --market <market>', 'Filter by market')
    .action(async (options: { market?: Market }) => {
      console.log(chalk.bold('\n📋 Pending Principles\n'));

      try {
        const curator = new KnowledgeCurator();
        const principles = await curator.listPending(options.market);

        if (principles.length === 0) {
          console.log(chalk.yellow('No pending principles.\n'));
          return;
        }

        for (const p of principles) {
          console.log(chalk.cyan(`• ${p.id}`));
          console.log(`  ${p.title}`);
          console.log(`  Markets: ${p.applicableMarkets.join(', ')} | Success: ${p.evidence.overallSuccessRate.toFixed(0)}%`);
          console.log();
        }

        console.log(chalk.dim(`Run 'oak-invest review show <id>' to see details.\n`));

      } catch (err) {
        console.error(chalk.red(`\nFailed to list proposals: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });

  program
    .command('review show <id>')
    .description('Show details of a proposed principle')
    .action(async (id: string) => {
      try {
        const curator = new KnowledgeCurator();
        const principle = await curator.getProposal(id);

        if (!principle) {
          console.error(chalk.red(`\nProposal not found: ${id}\n`));
          process.exit(1);
        }

        console.log(formatPrincipleForTerminal(principle));
        console.log();
        console.log(chalk.dim('Actions: oak-invest review approve|reject <id>'));

      } catch (err) {
        console.error(chalk.red(`\nFailed to show proposal: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });

  program
    .command('review approve <id>')
    .description('Approve a proposed principle')
    .option('-n, --notes <notes>', 'Review notes')
    .action(async (id: string, options: { notes?: string }) => {
      console.log(chalk.bold('\n✓ Approving Principle\n'));

      try {
        const curator = new KnowledgeCurator();
        await curator.approve(id, options.notes);

        console.log(chalk.green(`Approved: ${id}`));
        console.log(chalk.dim('Principle has been added to the knowledge base.\n'));

      } catch (err) {
        console.error(chalk.red(`\nFailed to approve: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });

  program
    .command('review reject <id>')
    .description('Reject a proposed principle')
    .requiredOption('-r, --reason <reason>', 'Reason for rejection')
    .action(async (id: string, options: { reason: string }) => {
      console.log(chalk.bold('\n✗ Rejecting Principle\n'));

      try {
        const curator = new KnowledgeCurator();
        await curator.reject(id, options.reason);

        console.log(chalk.yellow(`Rejected: ${id}`));
        console.log(chalk.dim(`Reason: ${options.reason}\n`));

      } catch (err) {
        console.error(chalk.red(`\nFailed to reject: ${err instanceof Error ? err.message : String(err)}\n`));
        process.exit(1);
      }
    });
}
