import fs from 'node:fs';
import type { Command } from 'commander';
import { writeDefaultConfig, getConfigPath, ensureConfigDir } from '../config/loader.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize oak-invest config directory and generate default config')
    .action(() => {
      const configPath = getConfigPath();
      ensureConfigDir();

      if (fs.existsSync(configPath)) {
        console.log(`Config already exists at ${configPath}`);
        console.log('To reset, delete the file and run init again.');
        return;
      }

      const created = writeDefaultConfig();
      console.log(`Created default config at ${created}`);
      console.log('Edit it to add your API keys and watchlists.');
    });
}
