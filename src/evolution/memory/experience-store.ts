import fs from 'node:fs';
import path from 'node:path';
import type { AnalysisRecord, Market } from '../types.js';
import {
  getExperienceDir,
  getMonthFolder,
  generateId,
} from '../helpers.js';

// Index structure for quick lookups
interface ExperienceIndex {
  lastUpdated: string;
  records: {
    id: string;
    market: Market;
    symbol: string;
    timestamp: string;
    hasOutcome: boolean;
    hasReflection: boolean;
  }[];
}

export class ExperienceStore {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || getExperienceDir();
  }

  // Ensure directories exist
  private ensureDirs(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    for (const market of ['us', 'a_share', 'hk'] as const) {
      const marketDir = path.join(this.baseDir, market);
      if (!fs.existsSync(marketDir)) {
        fs.mkdirSync(marketDir, { recursive: true });
      }
    }
  }

  // Get index file path
  private getIndexPath(): string {
    return path.join(this.baseDir, 'index.json');
  }

  // Load index
  private loadIndex(): ExperienceIndex {
    const indexPath = this.getIndexPath();
    if (!fs.existsSync(indexPath)) {
      return {
        lastUpdated: new Date().toISOString(),
        records: [],
      };
    }
    const content = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(content);
  }

  // Save index
  private saveIndex(index: ExperienceIndex): void {
    index.lastUpdated = new Date().toISOString();
    const indexPath = this.getIndexPath();
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  // Get file path for a record
  private getRecordPath(record: AnalysisRecord): string {
    const monthFolder = getMonthFolder(record.timestamp);
    const dir = path.join(this.baseDir, record.market, monthFolder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, `${record.id}.json`);
  }

  // Save a new analysis record
  async save(record: AnalysisRecord): Promise<void> {
    this.ensureDirs();
    
    // Save record file
    const filePath = this.getRecordPath(record);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
    
    // Update index
    const index = this.loadIndex();
    index.records.push({
      id: record.id,
      market: record.market,
      symbol: record.symbol,
      timestamp: record.timestamp,
      hasOutcome: false,
      hasReflection: false,
    });
    this.saveIndex(index);
  }

  // Query records by filters
  async query(filters: {
    market?: Market;
    symbol?: string;
    from?: Date;
    to?: Date;
    hasOutcome?: boolean;
    hasReflection?: boolean;
  }): Promise<AnalysisRecord[]> {
    const index = this.loadIndex();
    
    // Filter index entries
    let entries = index.records;
    if (filters.market) {
      entries = entries.filter(e => e.market === filters.market);
    }
    if (filters.symbol) {
      entries = entries.filter(e => e.symbol === filters.symbol);
    }
    if (filters.from) {
      entries = entries.filter(e => new Date(e.timestamp) >= filters.from!);
    }
    if (filters.to) {
      entries = entries.filter(e => new Date(e.timestamp) <= filters.to!);
    }
    if (filters.hasOutcome !== undefined) {
      entries = entries.filter(e => e.hasOutcome === filters.hasOutcome);
    }
    if (filters.hasReflection !== undefined) {
      entries = entries.filter(e => e.hasReflection === filters.hasReflection);
    }
    
    // Load records
    const records: AnalysisRecord[] = [];
    for (const entry of entries) {
      const record = await this.get(entry.id);
      if (record) {
        records.push(record);
      }
    }
    
    return records;
  }

  // Get a single record by ID
  async get(id: string): Promise<AnalysisRecord | null> {
    const index = this.loadIndex();
    const entry = index.records.find(e => e.id === id);
    if (!entry) return null;
    
    const monthFolder = getMonthFolder(entry.timestamp);
    const filePath = path.join(this.baseDir, entry.market, monthFolder, `${id}.json`);
    
    if (!fs.existsSync(filePath)) return null;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  // Update outcome field
  async updateOutcome(id: string, outcome: AnalysisRecord['outcome']): Promise<void> {
    const record = await this.get(id);
    if (!record) {
      throw new Error(`Record not found: ${id}`);
    }
    
    record.outcome = outcome;
    const filePath = path.join(
      this.baseDir,
      record.market,
      getMonthFolder(record.timestamp),
      `${id}.json`
    );
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
    
    // Update index
    const index = this.loadIndex();
    const entry = index.records.find(e => e.id === id);
    if (entry) {
      entry.hasOutcome = true;
      this.saveIndex(index);
    }
  }

  // Update reflection field
  async updateReflection(id: string, reflection: AnalysisRecord['reflection']): Promise<void> {
    const record = await this.get(id);
    if (!record) {
      throw new Error(`Record not found: ${id}`);
    }
    
    record.reflection = reflection;
    const filePath = path.join(
      this.baseDir,
      record.market,
      getMonthFolder(record.timestamp),
      `${id}.json`
    );
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
    
    // Update index
    const index = this.loadIndex();
    const entry = index.records.find(e => e.id === id);
    if (entry) {
      entry.hasReflection = true;
      this.saveIndex(index);
    }
  }

  // Get records pending outcome tracking
  async getPendingTracking(olderThanDays: number): Promise<AnalysisRecord[]> {
    const index = this.loadIndex();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    
    const entries = index.records.filter(e => 
      !e.hasOutcome && new Date(e.timestamp) <= cutoff
    );
    
    const records: AnalysisRecord[] = [];
    for (const entry of entries) {
      const record = await this.get(entry.id);
      if (record) records.push(record);
    }
    
    return records;
  }

  // Get records pending reflection
  async getPendingReflection(): Promise<AnalysisRecord[]> {
    const index = this.loadIndex();
    const entries = index.records.filter(e => 
      e.hasOutcome && !e.hasReflection
    );
    
    const records: AnalysisRecord[] = [];
    for (const entry of entries) {
      const record = await this.get(entry.id);
      if (record) records.push(record);
    }
    
    return records;
  }

  // Get all records (for stats)
  async getAll(): Promise<AnalysisRecord[]> {
    const index = this.loadIndex();
    const records: AnalysisRecord[] = [];
    for (const entry of index.records) {
      const record = await this.get(entry.id);
      if (record) records.push(record);
    }
    return records;
  }

  // Get stats summary
  async getStats(): Promise<{
    total: number;
    withOutcome: number;
    withReflection: number;
    byMarket: Record<Market, number>;
  }> {
    const index = this.loadIndex();
    
    const byMarket: Record<Market, number> = {
      us: 0,
      a_share: 0,
      hk: 0,
    };
    
    for (const entry of index.records) {
      byMarket[entry.market]++;
    }
    
    return {
      total: index.records.length,
      withOutcome: index.records.filter(e => e.hasOutcome).length,
      withReflection: index.records.filter(e => e.hasReflection).length,
      byMarket,
    };
  }
}
