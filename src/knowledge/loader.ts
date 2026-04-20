import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface KnowledgeContent {
  books: Record<string, string>;
  principles: Record<string, string>;
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
  const principles = readDirFiles(principlesDir);

  let maxims = '';
  const maximsPath = path.join(knowledgeDir, 'maxims.md');
  if (fs.existsSync(maximsPath)) {
    maxims = fs.readFileSync(maximsPath, 'utf-8');
  }

  const memos = readDirFiles(memosDir);

  return { books, principles, maxims, memos };
}
