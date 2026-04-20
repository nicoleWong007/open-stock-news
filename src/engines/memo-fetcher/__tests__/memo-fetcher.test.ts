import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MemoFetcher } from '../memo-fetcher.js';

let tempDir: string;
let fetcher: MemoFetcher;

const MOCK_RSS_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title>Memo One</title>
  <description><![CDATA[<a href="https://oaktreecapital.com/insights/memo/memo-one">here</a>]]></description>
  <guid>guid-1</guid>
  <pubDate>Thu, 26 Feb 2026 05:00:00 -0000</pubDate>
</item>
<item>
  <title>Special Episode</title>
  <description><![CDATA[No memo link here]]></description>
  <guid>guid-special</guid>
  <pubDate>Mon, 01 Jan 2026 00:00:00 -0000</pubDate>
</item>
<item>
  <title>Memo Two</title>
  <description><![CDATA[<a href="https://oaktreecapital.com/insights/memo/memo-two">here</a>]]></description>
  <guid>guid-2</guid>
  <pubDate>Tue, 09 Dec 2025 05:00:00 -0000</pubDate>
</item>
</channel></rss>`;

const MOCK_HTML = `
<html><body>
<div class="article-content">
  <p>This is memo content for testing.</p>
  <h2>Key Insight</h2>
  <p>Some analysis here.</p>
</div>
</body></html>`;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-fetcher-test-'));
  fetcher = new MemoFetcher(tempDir, 0);
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('MemoFetcher', () => {
  describe('init', () => {
    it('fetches memos from RSS and saves them', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_RSS_XML) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_HTML) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_HTML) });

      vi.stubGlobal('fetch', mockFetch);

      const result = await fetcher.init(10);

      expect(result.fetched).toHaveLength(2);
      expect(result.fetched).toContain('memo-one');
      expect(result.fetched).toContain('memo-two');
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      expect(fs.existsSync(path.join(tempDir, 'memo-one.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'memo-two.md'))).toBe(true);

      const index = JSON.parse(fs.readFileSync(path.join(tempDir, 'index.json'), 'utf-8'));
      expect(index.memos).toHaveLength(2);
    });

    it('respects the limit parameter', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_RSS_XML) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_HTML) });

      vi.stubGlobal('fetch', mockFetch);

      const result = await fetcher.init(1);
      expect(result.fetched).toHaveLength(1);
    });
  });

  describe('check', () => {
    it('detects and fetches only new memos', async () => {
      const existingIndex = {
        lastChecked: '2026-01-01T00:00:00Z',
        memos: [{
          slug: 'memo-one', title: 'Memo One', date: '2026-02-26',
          url: 'https://www.oaktreecapital.com/insights/memo/memo-one',
          rssGuid: 'guid-1', fetchedAt: '2026-01-01T00:00:00Z',
        }],
      };
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'index.json'), JSON.stringify(existingIndex, null, 2));

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_RSS_XML) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_HTML) });

      vi.stubGlobal('fetch', mockFetch);

      const result = await fetcher.check();
      expect(result.fetched).toEqual(['memo-two']);
      expect(result.skipped).toEqual(['memo-one']);

      const index = JSON.parse(fs.readFileSync(path.join(tempDir, 'index.json'), 'utf-8'));
      expect(index.memos).toHaveLength(2);
      expect(index.lastChecked).toBeTruthy();
    });

    it('returns no new memos when up to date', async () => {
      const existingIndex = {
        lastChecked: '2026-04-01T00:00:00Z',
        memos: [
          { slug: 'memo-one', title: 'Memo One', date: '2026-02-26', url: '', rssGuid: 'guid-1', fetchedAt: '' },
          { slug: 'memo-two', title: 'Memo Two', date: '2025-12-09', url: '', rssGuid: 'guid-2', fetchedAt: '' },
        ],
      };
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'index.json'), JSON.stringify(existingIndex, null, 2));

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_RSS_XML) });

      vi.stubGlobal('fetch', mockFetch);

      const result = await fetcher.check();
      expect(result.fetched).toHaveLength(0);
    });
  });

  describe('status', () => {
    it('returns current index info', () => {
      fs.mkdirSync(tempDir, { recursive: true });
      const index = {
        lastChecked: '2026-04-21T00:00:00Z',
        memos: [
          { slug: 'test', title: 'Test', date: '2026-01-01', url: '', rssGuid: 'g1', fetchedAt: '' },
        ],
      };
      fs.writeFileSync(path.join(tempDir, 'index.json'), JSON.stringify(index, null, 2));

      const status = fetcher.status();
      expect(status.total).toBe(1);
      expect(status.lastChecked).toBe('2026-04-21T00:00:00Z');
      expect(status.latest?.title).toBe('Test');
    });
  });
});
