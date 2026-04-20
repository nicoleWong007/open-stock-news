import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MemoStore } from '../memo-store.js';
import type { MemoIndex } from '../types.js';

let tempDir: string;
let store: MemoStore;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-store-test-'));
  store = new MemoStore(tempDir);
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('MemoStore', () => {
  describe('loadIndex', () => {
    it('returns default empty index when no file exists', () => {
      const index = store.loadIndex();
      expect(index.memos).toEqual([]);
      expect(index.lastChecked).toBe('');
    });

    it('loads existing index from disk', () => {
      const index: MemoIndex = {
        lastChecked: '2026-04-21T00:00:00Z',
        memos: [{
          slug: 'test-memo',
          title: 'Test Memo',
          date: '2026-04-21',
          url: 'https://www.oaktreecapital.com/insights/memo/test-memo',
          rssGuid: 'guid-123',
          fetchedAt: '2026-04-21T00:00:00Z',
        }],
      };
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'index.json'),
        JSON.stringify(index, null, 2),
      );
      const loaded = store.loadIndex();
      expect(loaded.memos).toHaveLength(1);
      expect(loaded.memos[0].slug).toBe('test-memo');
    });
  });

  describe('saveIndex', () => {
    it('writes index.json to disk', () => {
      const index: MemoIndex = {
        lastChecked: '2026-04-21T00:00:00Z',
        memos: [],
      };
      store.saveIndex(index);
      const filePath = path.join(tempDir, 'index.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.lastChecked).toBe('2026-04-21T00:00:00Z');
    });
  });

  describe('saveMemo', () => {
    it('writes a .md file with frontmatter', () => {
      store.saveMemo('test-memo', 'Test Memo', '2026-04-21', 'https://example.com', 'Hello world content.');
      const filePath = path.join(tempDir, 'test-memo.md');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('title: "Test Memo"');
      expect(content).toContain('date: "2026-04-21"');
      expect(content).toContain('url: "https://example.com"');
      expect(content).toContain('Hello world content.');
    });

    it('creates memos directory if it does not exist', () => {
      const nestedDir = path.join(tempDir, 'nested', 'memos');
      const nestedStore = new MemoStore(nestedDir);
      nestedStore.saveMemo('test', 'Test', '2026-04-21', 'https://example.com', 'Content.');
      expect(fs.existsSync(path.join(nestedDir, 'test.md'))).toBe(true);
    });
  });

  describe('hasMemo', () => {
    it('returns false when memo does not exist', () => {
      const index = store.loadIndex();
      expect(store.hasMemo(index, 'nonexistent')).toBe(false);
    });

    it('returns true when memo guid exists in index', () => {
      const index: MemoIndex = {
        lastChecked: '',
        memos: [{
          slug: 'test-memo', title: 'Test', date: '2026-04-21',
          url: 'https://example.com', rssGuid: 'guid-123', fetchedAt: '',
        }],
      };
      expect(store.hasMemo(index, 'guid-123')).toBe(true);
    });
  });

  describe('knownGuids', () => {
    it('returns set of known GUIDs', () => {
      const index: MemoIndex = {
        lastChecked: '',
        memos: [
          { slug: 'a', title: 'A', date: '2026-01-01', url: '', rssGuid: 'guid-1', fetchedAt: '' },
          { slug: 'b', title: 'B', date: '2026-01-02', url: '', rssGuid: 'guid-2', fetchedAt: '' },
        ],
      };
      const guids = store.knownGuids(index);
      expect(guids).toEqual(new Set(['guid-1', 'guid-2']));
    });
  });
});
