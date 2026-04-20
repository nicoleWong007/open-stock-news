import fs from 'node:fs';
import path from 'node:path';
import type { MemoIndex } from './types.js';

const DEFAULT_INDEX: MemoIndex = { lastChecked: '', memos: [] };

export class MemoStore {
  constructor(private readonly memosDir: string) {}

  private ensureDir(): void {
    if (!fs.existsSync(this.memosDir)) {
      fs.mkdirSync(this.memosDir, { recursive: true });
    }
  }

  loadIndex(): MemoIndex {
    const indexPath = path.join(this.memosDir, 'index.json');
    if (!fs.existsSync(indexPath)) return { ...DEFAULT_INDEX };
    try {
      const raw = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(raw) as MemoIndex;
    } catch {
      return { ...DEFAULT_INDEX };
    }
  }

  saveIndex(index: MemoIndex): void {
    this.ensureDir();
    const indexPath = path.join(this.memosDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  saveMemo(slug: string, title: string, date: string, url: string, content: string): void {
    this.ensureDir();
    const filePath = path.join(this.memosDir, `${slug}.md`);
    const frontmatter = `---\ntitle: "${title}"\ndate: "${date}"\nurl: "${url}"\n---\n\n${content}`;
    fs.writeFileSync(filePath, frontmatter, 'utf-8');
  }

  hasMemo(index: MemoIndex, rssGuid: string): boolean {
    return index.memos.some(m => m.rssGuid === rssGuid);
  }

  knownGuids(index: MemoIndex): Set<string> {
    return new Set(index.memos.map(m => m.rssGuid));
  }
}
