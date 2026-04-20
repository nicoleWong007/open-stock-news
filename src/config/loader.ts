import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { OakInvestConfigSchema, type OakInvestConfig } from './schema.js';
import { DEFAULT_CONFIG, DEFAULT_CONFIG_YAML } from './default-config.js';

export function getConfigDir(): string {
  return path.join(os.homedir(), '.oak-invest');
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.yaml');
}

export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): OakInvestConfig {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    console.warn(`[oak-invest] Config not found at ${configPath}. Using defaults.`);
    return DEFAULT_CONFIG;
  }

  const raw = fs.readFileSync(configPath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(
      `[oak-invest] Failed to parse config YAML at ${configPath}:\n${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const result = OakInvestConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[oak-invest] Invalid config at ${configPath}:\n${issues}`,
    );
  }

  return result.data;
}

export function writeDefaultConfig(): string {
  const configPath = getConfigPath();
  ensureConfigDir();
  fs.writeFileSync(configPath, DEFAULT_CONFIG_YAML, 'utf-8');
  return configPath;
}
