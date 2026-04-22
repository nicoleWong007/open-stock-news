import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCache } from './cache.js';

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

function getProjectRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

function readDirFiles(dir: string, useCache = true): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(dir)) {
    return result;
  }
  
  const cache = useCache ? getCache() : null;
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const fullPath = path.join(dir, entry);
    const key = entry.replace('.md', '');
    
    if (cache) {
      const cached = cache.get(fullPath);
      if (cached) {
        result[key] = cached.content;
        continue;
      }
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    result[key] = content;
    
    if (cache) {
      cache.set(fullPath, content, fullPath);
    }
  }
  
  return result;
}

function readFile(filePath: string, useCache = true): string {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  
  const cache = useCache ? getCache() : null;
  
  if (cache) {
    const cached = cache.get(filePath);
    if (cached) {
      return cached.content;
    }
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (cache) {
    cache.set(filePath, content, filePath);
  }
  
  return content;
}

export function loadKnowledge(): KnowledgeContent {
  const projectRoot = getProjectRoot();
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

  const maximsPath = path.join(knowledgeDir, 'maxims.md');
  const maxims = readFile(maximsPath);

  const memos = readDirFiles(memosDir);

  return { books, principles, maxims, memos };
}

export function loadPrinciples(scope: MarketScope): Record<string, string> {
  const projectRoot = getProjectRoot();
  const principlesDir = path.join(projectRoot, 'knowledge', 'principles', scope);
  return readDirFiles(principlesDir);
}

export function loadMaxims(): string {
  const projectRoot = getProjectRoot();
  const maximsPath = path.join(projectRoot, 'knowledge', 'maxims.md');
  return readFile(maximsPath);
}

export function loadBooks(): Record<string, string> {
  const projectRoot = getProjectRoot();
  const booksDir = path.join(projectRoot, 'knowledge', 'books');
  return readDirFiles(booksDir);
}

export function loadMemos(): Record<string, string> {
  const projectRoot = getProjectRoot();
  const memosDir = path.join(projectRoot, 'knowledge', 'memos');
  return readDirFiles(memosDir);
}

export function loadMemoIndex(): { memos: Array<{ slug: string; title: string; date: string }> } | null {
  const projectRoot = getProjectRoot();
  const indexPath = path.join(projectRoot, 'knowledge', 'memos', 'index.json');
  
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  
  const content = readFile(indexPath);
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function loadCoreLayer(): string {
  const projectRoot = getProjectRoot();
  const decisionMatrixPath = path.join(projectRoot, 'knowledge', 'principles', 'shared', 'decision-matrix.md');
  
  const parts: string[] = [];
  
  const decisionMatrix = readFile(decisionMatrixPath);
  if (decisionMatrix) {
    parts.push(decisionMatrix);
  }
  
  const maxims = loadMaxims();
  if (maxims) {
    parts.push(maxims);
  }
  
  return parts.join('\n\n---\n\n');
}

export function loadFoundationLayer(): string {
  const parts: string[] = [];
  
  const books = loadBooks();
  const bookContents = Object.values(books);
  if (bookContents.length > 0) {
    parts.push(bookContents.join('\n\n---\n\n'));
  }
  
  const sharedPrinciples = loadPrinciples('shared');
  const principleContents = Object.values(sharedPrinciples);
  if (principleContents.length > 0) {
    parts.push(principleContents.join('\n\n---\n\n'));
  }
  
  return parts.join('\n\n---\n\n');
}

export function loadMarketLayer(market: MarketScope): string {
  if (market === 'shared') {
    return '';
  }
  
  const principles = loadPrinciples(market);
  const contents = Object.values(principles);
  return contents.join('\n\n---\n\n');
}

export function getMemoSlugs(): string[] {
  const projectRoot = getProjectRoot();
  const memosDir = path.join(projectRoot, 'knowledge', 'memos');
  
  if (!fs.existsSync(memosDir)) {
    return [];
  }
  
  return fs.readdirSync(memosDir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));
}

export function loadMemoBySlug(slug: string): string {
  const projectRoot = getProjectRoot();
  const memoPath = path.join(projectRoot, 'knowledge', 'memos', `${slug}.md`);
  return readFile(memoPath);
}
