import type { Command } from 'commander';

export function registerDailyReportCommand(program: Command): void {
  program
    .command('daily-report')
    .description('Generate daily investment report')
    .option('--email', 'Send report via email')
    .action((options: { email?: boolean }) => {
      console.log('Daily report will be available in Phase 3 (multi-market + email).');
      if (options.email) {
        console.log('Email delivery also requires Phase 3 email configuration.');
      }
    });
}
