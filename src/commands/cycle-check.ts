import type { Command } from 'commander';

export function registerCycleCheckCommand(program: Command): void {
  program
    .command('cycle-check')
    .description('Check current market cycle positioning')
    .action(() => {
      console.log('Cycle check will be available in Phase 2 (engines + knowledge).');
    });
}
