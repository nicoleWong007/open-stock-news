import type { Command } from 'commander';

export function registerChatCommand(program: Command): void {
  program
    .command('chat [question]')
    .description('Interactive investment discussion')
    .action((question?: string) => {
      console.log(question ?? 'No question provided.');
      console.log('Interactive chat will be available in Phase 3.');
    });
}
