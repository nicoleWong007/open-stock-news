import fs from 'node:fs';
import type { Command } from 'commander';
import { loadConfig, getConfigPath } from '../config/loader.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Validate setup: config, API keys, data sources')
    .action(() => {
      const checks: { label: string; pass: boolean; detail: string }[] = [];

      // Check 1: config file exists
      const configPath = getConfigPath();
      const configExists = fs.existsSync(configPath);
      checks.push({
        label: 'Config file',
        pass: configExists,
        detail: configExists ? configPath : `Not found at ${configPath}. Run 'oak-invest init'.`,
      });

      // Check 2: config is valid
      let configValid = false;
      if (configExists) {
        try {
          loadConfig();
          configValid = true;
        } catch {
          configValid = false;
        }
      }
      checks.push({
        label: 'Config valid',
        pass: configValid,
        detail: configValid ? 'YAML parses and passes schema validation' : 'Config file has errors. Check YAML syntax.',
      });

      // Check 3: API keys
      const envKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
      const found = envKeys.filter((k) => process.env[k]);
      checks.push({
        label: 'API keys',
        pass: found.length > 0,
        detail: found.length > 0
          ? `Found: ${found.join(', ')}`
          : 'No API keys found in environment. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.',
      });

      // Print results
      for (const check of checks) {
        const icon = check.pass ? '✓' : '✗';
        console.log(`  ${icon} ${check.label}: ${check.detail}`);
      }

      const allPass = checks.every((c) => c.pass);
      console.log(allPass ? '\nAll checks passed.' : '\nSome checks failed. Fix the issues above.');
      process.exit(allPass ? 0 : 1);
    });
}
