import type { Command } from 'commander';
import cron from 'node-cron';
import { MemoFetcher } from '../engines/memo-fetcher/index.js';

export function registerUpdateMemosCommand(program: Command): void {
  const cmd = program
    .command('update-memos')
    .description('Manage Oaktree Capital Howard Marks memos');

  cmd
    .command('init')
    .description('Fetch the latest 10 memos from Oaktree Capital')
    .option('-n, --count <number>', 'Number of memos to fetch', '10')
    .action(async (options) => {
      const fetcher = new MemoFetcher();
      const count = parseInt(options.count, 10);
      const result = await fetcher.init(count);
      process.exit(result.errors.length > 0 ? 1 : 0);
    });

  cmd
    .command('check')
    .description('Check for new memos since last update')
    .action(async () => {
      const fetcher = new MemoFetcher();
      const result = await fetcher.check();
      process.exit(result.errors.length > 0 ? 1 : 0);
    });

  cmd
    .command('schedule')
    .description('Start weekly scheduler to auto-check for new memos')
    .option('--cron <expression>', 'Cron expression for schedule', '0 9 * * 1')
    .action((options) => {
      const fetcher = new MemoFetcher();
      const expression = options.cron;

      if (!cron.validate(expression)) {
        console.error(`Invalid cron expression: ${expression}`);
        process.exit(1);
      }

      console.log(`Starting memo scheduler: ${expression}`);
      console.log('Press Ctrl+C to stop.');

      cron.schedule(expression, async () => {
        try {
          console.log(`\n[${new Date().toISOString()}] Running scheduled memo check...`);
          await fetcher.check();
        } catch (err) {
          console.error('Scheduled check failed:', err);
        }
      });

      process.on('SIGINT', () => {
        console.log('\nScheduler stopped.');
        process.exit(0);
      });
    });

  cmd
    .command('status')
    .description('Show current memo status')
    .action(() => {
      const fetcher = new MemoFetcher();
      const status = fetcher.status();

      console.log(`Total memos: ${status.total}`);
      console.log(`Last checked: ${status.lastChecked || 'never'}`);
      if (status.latest) {
        console.log(`Latest: ${status.latest.title} (${status.latest.date})`);
      }
    });
}
