import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type MarketScope = 'shared' | 'us' | 'a_share' | 'hk';

interface KnowledgeContent {
  books: Record<string, string>;
  principles: {
    shared: Record<string, string>;
    us: Record<string, string>;
    a_share: Record<string, string>;
    hk: Record<string, string>;
  };
  maxims: string;
  memos: Record<string, string>;
}

function readDirFiles(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(dir)) {
    return result;
  }
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const fullPath = path.join(dir, entry);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const key = entry.replace('.md', '');
    result[key] = content;
  }
  return result;
}

export function loadKnowledge(): KnowledgeContent {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const knowledgeDir = path.join(projectRoot, 'knowledge');

  const booksDir = path.join(knowledgeDir, 'books');
  const principlesDir = path.join(knowledgeDir, 'principles');
  const memosDir = path.join(knowledgeDir, 'memos');

  const books = readDirFiles(booksDir);
  
  const principles = {
    shared: readDirFiles(path.join(principlesDir, 'shared')),
    us: readDirFiles(path.join(principlesDir, 'us')),
    a_share: readDirFiles(path.join(principlesDir, 'a_share')),
    hk: readDirFiles(path.join(principlesDir, 'hk')),
  };

  let maxims = '';
  const maximsPath = path.join(knowledgeDir, 'maxims.md');
  if (fs.existsSync(maximsPath)) {
    maxims = fs.readFileSync(maximsPath, 'utf-8');
  }

  const memos = readDirFiles(memosDir);

  return { books, principles, maxims, memos };
}

export function loadPrinciples(scope: MarketScope): Record<string, string> {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const principlesDir = path.join(projectRoot, 'knowledge', 'principles', scope);
  return readDirFiles(principlesDir);
}
