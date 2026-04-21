import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { MarketContext } from './types.js';

const CACHE_DIR = '.oak-invest';
const CACHE_FILE = 'macro-context.json';

export class MacroStore {
  private cachePath: string;

  constructor() {
    const homeDir = os.homedir();
    this.cachePath = path.join(homeDir, CACHE_DIR, 'cache', CACHE_FILE);
  }

  async load(): Promise<MarketContext | null> {
    try {
      const data = await fs.readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(data) as MarketContext;
      return parsed;
    } catch {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  async save(context: MarketContext): Promise<void> {
    const dir = path.dirname(this.cachePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.cachePath, JSON.stringify(context, null, 2), 'utf-8');
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.cachePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  getCachePath(): string {
    return this.cachePath;
  }
}

export function createMacroStore(): MacroStore {
  return new MacroStore();
}
