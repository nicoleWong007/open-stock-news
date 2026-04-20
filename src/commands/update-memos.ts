import type { Command } from 'commander';

export function registerUpdateMemosCommand(program: Command): void {
  program
    .command('update-memos')
    .description('Update Oaktree Capital memos from the web')
    .action(() => {
      console.log('Memo updates will be available in Phase 2 (engines + knowledge).');
    });
}
