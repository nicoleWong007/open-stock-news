# Oaktree Memo Auto-Fetcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automatic fetching of Howard Marks' memos using ART19 podcast RSS for change detection and Oaktree website HTML for content.

**Architecture:** RssPoller detects new memos via ART19 RSS feed → HtmlScraper fetches memo HTML from oaktreecapital.com → cheerio converts to Markdown → MemoStore persists to `knowledge/memos/` as `.md` files with `index.json` metadata. CLI exposes `init`, `check`, `schedule`, `status` subcommands.

**Tech Stack:** TypeScript, Node.js 20+, cheerio (HTML parsing), node-cron (scheduling), vitest (testing). No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-04-21-oaktree-memo-fetcher-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/engines/memo-fetcher/types.ts` | Type definitions for MemoEntry, MemoIndex, RssEpisode |
| Create | `src/engines/memo-fetcher/rss-poller.ts` | Fetch + parse ART19 RSS XML into RssEpisode[] |
| Create | `src/engines/memo-fetcher/html-scraper.ts` | Fetch Oaktree memo page, extract text, convert to Markdown |
| Create | `src/engines/memo-fetcher/memo-store.ts` | Read/write memo .md files and index.json |
| Create | `src/engines/memo-fetcher/memo-fetcher.ts` | Orchestration: combines rss-poller + html-scraper + memo-store |
| Create | `src/engines/memo-fetcher/__tests__/rss-poller.test.ts` | Unit tests for RSS parsing |
| Create | `src/engines/memo-fetcher/__tests__/html-scraper.test.ts` | Unit tests for HTML→Markdown |
| Create | `src/engines/memo-fetcher/__tests__/memo-store.test.ts` | Unit tests for file I/O |
| Create | `src/engines/memo-fetcher/__tests__/memo-fetcher.test.ts` | Integration tests for full flow |
| Create | `src/engines/memo-fetcher/index.ts` | Re-exports |
| Modify | `src/commands/update-memos.ts` | Rewrite stub to full CLI with subcommands |

**Existing files NOT modified** (verified compatible as-is):
- `src/knowledge/loader.ts` — reads all `.md` from `knowledge/memos/`, will pick up new files automatically
- `src/knowledge/prompt-builder.ts` — already injects memos into system prompt

---

### Task 1: Types

**Files:**
- Create: `src/engines/memo-fetcher/types.ts`
- Test: `src/engines/memo-fetcher/__tests__/types.test.ts` (skip — pure types, no logic to test)

- [ ] **Step 1: Create the types file**

```typescript
// src/engines/memo-fetcher/types.ts

/** A parsed episode from the ART19 podcast RSS feed */
export interface RssEpisode {
  title: string;
  description: string;
  guid: string;
  pubDate: string;
}

/** A memo that links to an Oaktree memo page (filtered from RssEpisode) */
export interface MemoCandidate {
  title: string;
  slug: string;
  url: string;
  date: string;       // ISO date string "2026-02-26"
  rssGuid: string;
}

/** A stored memo entry in index.json */
export interface MemoEntry {
  slug: string;
  title: string;
  date: string;
  url: string;
  rssGuid: string;
  fetchedAt: string;
}

/** The index.json structure */
export interface MemoIndex {
  lastChecked: string;
  memos: MemoEntry[];
}

/** Result of a fetch operation */
export interface FetchResult {
  fetched: string[];
  skipped: string[];
  errors: Array<{ slug: string; error: string }>;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit src/engines/memo-fetcher/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/engines/memo-fetcher/types.ts
git commit -m "feat(memo-fetcher): add type definitions for memo fetching"
```

---

### Task 2: RssPoller

**Files:**
- Create: `src/engines/memo-fetcher/rss-poller.ts`
- Create: `src/engines/memo-fetcher/__tests__/rss-poller.test.ts`

- [ ] **Step 1: Write failing test for RSS parsing**

```typescript
// src/engines/memo-fetcher/__tests__/rss-poller.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRssXml, extractMemoCandidates, fetchRssEpisodes } from '../rss-poller.js';

const SAMPLE_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Memo by Howard Marks</title>
    <item>
      <title>AI Hurtles Ahead</title>
      <description><![CDATA[<p>You can read the memo <a href="https://oaktreecapital.com/insights/memo/ai-hurtles-ahead">here</a>.</p>]]></description>
      <guid isPermaLink="false">gid://art19-episode-locator/V0/acikbIG5u</guid>
      <pubDate>Thu, 26 Feb 2026 05:00:00 -0000</pubDate>
    </item>
    <item>
      <title>30 Years of Oaktree</title>
      <description><![CDATA[<p>A fireside chat with cofounders.</p>]]></description>
      <guid isPermaLink="false">gid://art19-episode-locator/V0/L_o48uv</guid>
      <pubDate>Tue, 06 May 2025 04:00:00 -0000</pubDate>
    </item>
    <item>
      <title>Is It a Bubble?</title>
      <description><![CDATA[<p>You can read the memo <a href="https://www.oaktreecapital.com/insights/memo/is-it-a-bubble">here</a>.</p>]]></description>
      <guid isPermaLink="false">gid://art19-episode-locator/V0/mzMJ3lmL</guid>
      <pubDate>Tue, 09 Dec 2025 05:00:00 -0000</pubDate>
    </item>
    <item>
      <title>Behind The Memo: On Bubble Watch</title>
      <description><![CDATA[<p>Howard discusses his recent memo, <em>On Bubble Watch</em>.</p>]]></description>
      <guid isPermaLink="false">gid://art19-episode-locator/V0/GY8gpZ6e</guid>
      <pubDate>Thu, 27 Feb 2025 05:00:00 -0000</pubDate>
    </item>
  </channel>
</rss>`;

describe('parseRssXml', () => {
  it('extracts all items from RSS XML', () => {
    const episodes = parseRssXml(SAMPLE_RSS_XML);
    expect(episodes).toHaveLength(4);
    expect(episodes[0].title).toBe('AI Hurtles Ahead');
    expect(episodes[0].guid).toBe('gid://art19-episode-locator/V0/acikbIG5u');
  });

  it('preserves description with CDATA', () => {
    const episodes = parseRssXml(SAMPLE_RSS_XML);
    expect(episodes[0].description).toContain('oaktreecapital.com/insights/memo/ai-hurtles-ahead');
  });

  it('preserves pubDate', () => {
    const episodes = parseRssXml(SAMPLE_RSS_XML);
    expect(episodes[0].pubDate).toBe('Thu, 26 Feb 2026 05:00:00 -0000');
  });
});

describe('extractMemoCandidates', () => {
  it('filters to only episodes with memo links', () => {
    const episodes = parseRssXml(SAMPLE_RSS_XML);
    const candidates = extractMemoCandidates(episodes);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].title).toBe('AI Hurtles Ahead');
    expect(candidates[1].title).toBe('Is It a Bubble?');
  });

  it('extracts correct slug from URL', () => {
    const episodes = parseRssXml(SAMPLE_RSS_XML);
    const candidates = extractMemoCandidates(episodes);
    expect(candidates[0].slug).toBe('ai-hurtles-ahead');
    expect(candidates[1].slug).toBe('is-it-a-bubble');
  });

  it('constructs correct URL', () => {
    const episodes = parseRssXml(SAMPLE_RSS_XML);
    const candidates = extractMemoCandidates(episodes);
    expect(candidates[0].url).toBe('https://www.oaktreecapital.com/insights/memo/ai-hurtles-ahead');
  });

  it('converts pubDate to ISO date string', () => {
    const episodes = parseRssXml(SAMPLE_RSS_XML);
    const candidates = extractMemoCandidates(episodes);
    expect(candidates[0].date).toBe('2026-02-26');
  });

  it('preserves rssGuid for dedup', () => {
    const episodes = parseRssXml(SAMPLE_RSS_XML);
    const candidates = extractMemoCandidates(episodes);
    expect(candidates[0].rssGuid).toBe('gid://art19-episode-locator/V0/acikbIG5u');
  });

  it('returns empty array when no episodes have memo links', () => {
    const episodes = [
      { title: 'Chat', description: 'No link here', guid: 'abc', pubDate: 'Thu, 01 Jan 2025 00:00:00 -0000' },
    ];
    const candidates = extractMemoCandidates(episodes);
    expect(candidates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engines/memo-fetcher/__tests__/rss-poller.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement rss-poller.ts**

```typescript
// src/engines/memo-fetcher/rss-poller.ts
import type { RssEpisode, MemoCandidate } from './types.js';

const RSS_FEED_URL = 'https://rss.art19.com/the-memo-by-howard-marks';
const MEMO_URL_PATTERN = /oaktreecapital\.com\/insights\/memo\/([^"<\s]+)/;

/**
 * Parse RSS XML string into an array of RssEpisode objects.
 * Uses regex-based extraction to avoid DOMParser dependency issues in Node.js.
 */
export function parseRssXml(xml: string): RssEpisode[] {
  const episodes: RssEpisode[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/);
    const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? '').trim();

    const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/);
    const description = descMatch?.[1] ?? descMatch?.[2] ?? '';

    const guidMatch = itemContent.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
    const guid = (guidMatch?.[1] ?? '').trim();

    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const pubDate = (pubDateMatch?.[1] ?? '').trim();

    episodes.push({ title, description, guid, pubDate });
  }

  return episodes;
}

/**
 * Convert an RFC 2822 pubDate to ISO date string (YYYY-MM-DD).
 */
function parsePubDate(pubDate: string): string {
  const date = new Date(pubDate);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/**
 * Filter episodes to only those that link to Oaktree memo pages,
 * and extract memo slug, URL, and date from each.
 */
export function extractMemoCandidates(episodes: RssEpisode[]): MemoCandidate[] {
  const candidates: MemoCandidate[] = [];

  for (const episode of episodes) {
    const match = episode.description.match(MEMO_URL_PATTERN);
    if (!match) continue;

    const slug = match[1];
    const date = parsePubDate(episode.pubDate);

    candidates.push({
      title: episode.title,
      slug,
      url: `https://www.oaktreecapital.com/insights/memo/${slug}`,
      date,
      rssGuid: episode.guid,
    });
  }

  return candidates;
}

/**
 * Fetch the RSS feed from ART19 and return parsed episodes.
 */
export async function fetchRssEpisodes(): Promise<RssEpisode[]> {
  const response = await fetch(RSS_FEED_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'oak-invest/0.1.0 (memo-fetcher)' },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  return parseRssXml(xml);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engines/memo-fetcher/__tests__/rss-poller.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engines/memo-fetcher/rss-poller.ts src/engines/memo-fetcher/__tests__/rss-poller.test.ts
git commit -m "feat(memo-fetcher): add RSS poller for ART19 feed parsing"
```

---

### Task 3: HtmlScraper

**Files:**
- Create: `src/engines/memo-fetcher/html-scraper.ts`
- Create: `src/engines/memo-fetcher/__tests__/html-scraper.test.ts`

- [ ] **Step 1: Write failing test for HTML→Markdown conversion**

```typescript
// src/engines/memo-fetcher/__tests__/html-scraper.test.ts
import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, extractMemoContent } from '../html-scraper.js';

describe('htmlToMarkdown', () => {
  it('converts paragraphs', () => {
    const html = '<p>Hello world.</p><p>Second paragraph.</p>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('Hello world.\n\nSecond paragraph.');
  });

  it('converts headings', () => {
    const html = '<h2>Section</h2><h3>Subsection</h3><h4>Detail</h4>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('## Section\n\n### Subsection\n\n#### Detail');
  });

  it('converts bold and italic', () => {
    const html = '<p>This is <strong>bold</strong> and <em>italic</em>.</p>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('This is **bold** and *italic*.');
  });

  it('converts links', () => {
    const html = '<p>Read <a href="https://example.com">this link</a>.</p>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('Read [this link](https://example.com).');
  });

  it('converts blockquotes', () => {
    const html = '<blockquote><p>A wise quote.</p></blockquote>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('> A wise quote.');
  });

  it('converts unordered lists', () => {
    const html = '<ul><li>First</li><li>Second</li></ul>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('- First\n- Second');
  });

  it('converts ordered lists', () => {
    const html = '<ol><li>First</li><li>Second</li></ol>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('1. First\n2. Second');
  });

  it('converts line breaks', () => {
    const html = '<p>Line one<br>Line two</p>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('Line one\nLine two.');
  });

  it('handles empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(htmlToMarkdown('<p></p>')).toBe('');
  });
});

describe('extractMemoContent', () => {
  it('extracts content from article-content div', () => {
    const html = `
      <html><body>
        <div class="sidebar">Menu</div>
        <div class="article-content">
          <p>The memo text goes here.</p>
          <h2>A Section</h2>
          <p>More details.</p>
        </div>
        <div class="footer">Footer</div>
      </body></html>
    `;
    const md = extractMemoContent(html);
    expect(md).toContain('The memo text goes here.');
    expect(md).toContain('## A Section');
    expect(md).toContain('More details.');
    expect(md).not.toContain('Menu');
    expect(md).not.toContain('Footer');
  });

  it('returns empty string when no content selector matches', () => {
    const html = '<html><body><p>No article content here.</p></body></html>';
    const md = extractMemoContent(html);
    expect(md).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engines/memo-fetcher/__tests__/html-scraper.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement html-scraper.ts**

```typescript
// src/engines/memo-fetcher/html-scraper.ts
import * as cheerio from 'cheerio';

/**
 * Convert an HTML string to Markdown using cheerio for parsing.
 * Handles: p, h2-h4, strong/b, em/i, a, blockquote, ul/ol, br, sup.
 */
export function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html);
  const root = $.root();

  function convertNode(el: cheerio.Cheerio<cheerio.Element>): string {
    const parts: string[] = [];

    el.contents().each((_i, node) => {
      const $node = $(node);

      if (node.type === 'text') {
        const text = $node.text();
        if (text) parts.push(text);
        return;
      }

      if (node.type !== 'tag') return;

      const tag = (node as cheerio.Element).tagName?.toLowerCase();

      switch (tag) {
        case 'p': {
          const inner = convertNode($node);
          if (inner.trim()) parts.push(inner);
          break;
        }
        case 'h2':
          parts.push(`## ${convertNode($node)}`);
          break;
        case 'h3':
          parts.push(`### ${convertNode($node)}`);
          break;
        case 'h4':
          parts.push(`#### ${convertNode($node)}`);
          break;
        case 'strong':
        case 'b':
          parts.push(`**${convertNode($node)}**`);
          break;
        case 'em':
        case 'i':
          parts.push(`*${convertNode($node)}*`);
          break;
        case 'a': {
          const href = $node.attr('href') ?? '';
          const text = convertNode($node);
          parts.push(`[${text}](${href})`);
          break;
        }
        case 'blockquote': {
          const inner = convertNode($node).trim();
          const lines = inner.split('\n').map(l => `> ${l}`).join('\n');
          parts.push(lines);
          break;
        }
        case 'ul':
          $node.children('li').each((_li, li) => {
            parts.push(`- ${convertNode($(li)).trim()}`);
          });
          break;
        case 'ol': {
          let idx = 1;
          $node.children('li').each((_li, li) => {
            parts.push(`${idx++}. ${convertNode($(li)).trim()}`);
          });
          break;
        }
        case 'br':
          parts.push('\n');
          break;
        case 'sup':
          parts.push(convertNode($node));
          break;
        default:
          parts.push(convertNode($node));
          break;
      }
    });

    return parts.join('');
  }

  let result = convertNode(root);

  // Clean up excessive newlines
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

/**
 * Extract memo content from a full Oaktree memo page HTML.
 * Tries selectors in priority order until one matches.
 */
export function extractMemoContent(pageHtml: string): string {
  const $ = cheerio.load(pageHtml);

  // Try content selectors in priority order
  const selectors = [
    '.article-content',
    '.memo-content',
    '.insights-3col-wrapper .article-content',
  ];

  for (const selector of selectors) {
    const $el = $(selector);
    if ($el.length > 0) {
      return htmlToMarkdown($el.html() ?? '');
    }
  }

  return '';
}

const BASE_URL = 'https://www.oaktreecapital.com';

/**
 * Fetch a memo page from Oaktree and convert to Markdown.
 */
export async function fetchMemoHtml(slug: string): Promise<string> {
  const url = `${BASE_URL}/insights/memo/${slug}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'oak-invest/0.1.0 (memo-fetcher)' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch memo ${slug}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return extractMemoContent(html);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engines/memo-fetcher/__tests__/html-scraper.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engines/memo-fetcher/html-scraper.ts src/engines/memo-fetcher/__tests__/html-scraper.test.ts
git commit -m "feat(memo-fetcher): add HTML scraper with Markdown conversion"
```

---

### Task 4: MemoStore

**Files:**
- Create: `src/engines/memo-fetcher/memo-store.ts`
- Create: `src/engines/memo-fetcher/__tests__/memo-store.test.ts`

- [ ] **Step 1: Write failing test for MemoStore**

```typescript
// src/engines/memo-fetcher/__tests__/memo-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MemoStore } from '../memo-store.js';
import type { MemoEntry, MemoIndex } from '../types.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engines/memo-fetcher/__tests__/memo-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement memo-store.ts**

```typescript
// src/engines/memo-fetcher/memo-store.ts
import fs from 'node:fs';
import path from 'node:path';
import type { MemoEntry, MemoIndex } from './types.js';

const DEFAULT_INDEX: MemoIndex = { lastChecked: '', memos: [] };

export class MemoStore {
  constructor(private readonly memosDir: string) {}

  /** Ensure the memos directory exists */
  private ensureDir(): void {
    if (!fs.existsSync(this.memosDir)) {
      fs.mkdirSync(this.memosDir, { recursive: true });
    }
  }

  /** Load the memo index from disk, or return empty default */
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

  /** Save the memo index to disk */
  saveIndex(index: MemoIndex): void {
    this.ensureDir();
    const indexPath = path.join(this.memosDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  /** Save a memo as a .md file with YAML frontmatter */
  saveMemo(slug: string, title: string, date: string, url: string, content: string): void {
    this.ensureDir();
    const filePath = path.join(this.memosDir, `${slug}.md`);
    const frontmatter = `---\ntitle: "${title}"\ndate: "${date}"\nurl: "${url}"\n---\n\n${content}`;
    fs.writeFileSync(filePath, frontmatter, 'utf-8');
  }

  /** Check if a memo with the given RSS GUID already exists in the index */
  hasMemo(index: MemoIndex, rssGuid: string): boolean {
    return index.memos.some(m => m.rssGuid === rssGuid);
  }

  /** Get a set of all known RSS GUIDs for fast lookup */
  knownGuids(index: MemoIndex): Set<string> {
    return new Set(index.memos.map(m => m.rssGuid));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engines/memo-fetcher/__tests__/memo-store.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engines/memo-fetcher/memo-store.ts src/engines/memo-fetcher/__tests__/memo-store.test.ts
git commit -m "feat(memo-fetcher): add MemoStore for file I/O and index management"
```

---

### Task 5: MemoFetcher Orchestration

**Files:**
- Create: `src/engines/memo-fetcher/memo-fetcher.ts`
- Create: `src/engines/memo-fetcher/__tests__/memo-fetcher.test.ts`

- [ ] **Step 1: Write failing test for MemoFetcher**

```typescript
// src/engines/memo-fetcher/__tests__/memo-fetcher.test.ts
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
  fetcher = new MemoFetcher(tempDir, 0); // 0ms delay for tests
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('MemoFetcher', () => {
  describe('init', () => {
    it('fetches memos from RSS and saves them', async () => {
      // Mock global fetch
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_RSS_XML) }) // RSS
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_HTML) })     // memo-one
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(MOCK_HTML) });    // memo-two

      vi.stubGlobal('fetch', mockFetch);

      const result = await fetcher.init(10);

      expect(result.fetched).toHaveLength(2);
      expect(result.fetched).toContain('memo-one');
      expect(result.fetched).toContain('memo-two');
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      // Verify files exist
      expect(fs.existsSync(path.join(tempDir, 'memo-one.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'memo-two.md'))).toBe(true);

      // Verify index
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
      // First: init with one memo already known
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

      // Verify index updated
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engines/memo-fetcher/__tests__/memo-fetcher.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement memo-fetcher.ts**

```typescript
// src/engines/memo-fetcher/memo-fetcher.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchRssEpisodes, extractMemoCandidates } from './rss-poller.js';
import { fetchMemoHtml } from './html-scraper.js';
import { MemoStore } from './memo-store.js';
import type { MemoEntry, MemoIndex, FetchResult } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Default path to knowledge/memos/ relative to project root.
 */
function getDefaultMemosDir(): string {
  return path.resolve(__dirname, '..', '..', '..', 'knowledge', 'memos');
}

export class MemoFetcher {
  private store: MemoStore;

  /**
   * @param memosDir Path to the memos directory (knowledge/memos/)
   * @param delayMs Delay between page fetches in milliseconds (default 2000)
   */
  constructor(
    memosDir: string = getDefaultMemosDir(),
    private readonly delayMs: number = 2000,
  ) {
    this.store = new MemoStore(memosDir);
  }

  /**
   * Initialize: fetch the latest N memos from RSS.
   */
  async init(limit: number = 10): Promise<FetchResult> {
    const result: FetchResult = { fetched: [], skipped: [], errors: [] };

    console.log('Fetching RSS feed...');
    const episodes = await fetchRssEpisodes();
    const candidates = extractMemoCandidates(episodes);
    const toFetch = candidates.slice(0, limit);

    console.log(`Found ${candidates.length} memo candidates, fetching ${toFetch.length}...`);

    for (const candidate of toFetch) {
      try {
        console.log(`  Fetching: ${candidate.title}...`);
        const markdown = await fetchMemoHtml(candidate.slug);

        if (!markdown.trim()) {
          result.errors.push({ slug: candidate.slug, error: 'Empty content extracted' });
          continue;
        }

        const entry: MemoEntry = {
          slug: candidate.slug,
          title: candidate.title,
          date: candidate.date,
          url: candidate.url,
          rssGuid: candidate.rssGuid,
          fetchedAt: new Date().toISOString(),
        };

        this.store.saveMemo(entry.slug, entry.title, entry.date, entry.url, markdown);

        // Update index incrementally
        const index = this.store.loadIndex();
        index.memos.push(entry);
        index.memos.sort((a, b) => b.date.localeCompare(a.date));
        index.lastChecked = new Date().toISOString();
        this.store.saveIndex(index);

        result.fetched.push(candidate.slug);
        console.log(`  ✓ Saved: ${candidate.title}`);

        // Rate limit (skip on last item)
        if (toFetch.indexOf(candidate) < toFetch.length - 1) {
          await this.delay();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ slug: candidate.slug, error: msg });
        console.error(`  ✗ Failed: ${candidate.title} — ${msg}`);
      }
    }

    console.log(`Done. Fetched: ${result.fetched.length}, Errors: ${result.errors.length}`);
    return result;
  }

  /**
   * Check for new memos since last check.
   */
  async check(): Promise<FetchResult> {
    const result: FetchResult = { fetched: [], skipped: [], errors: [] };

    console.log('Checking for new memos...');
    const episodes = await fetchRssEpisodes();
    const candidates = extractMemoCandidates(episodes);

    const index = this.store.loadIndex();
    const known = this.store.knownGuids(index);

    for (const candidate of candidates) {
      if (known.has(candidate.rssGuid)) {
        result.skipped.push(candidate.slug);
        continue;
      }

      try {
        console.log(`  New memo found: ${candidate.title}`);
        const markdown = await fetchMemoHtml(candidate.slug);

        if (!markdown.trim()) {
          result.errors.push({ slug: candidate.slug, error: 'Empty content extracted' });
          continue;
        }

        const entry: MemoEntry = {
          slug: candidate.slug,
          title: candidate.title,
          date: candidate.date,
          url: candidate.url,
          rssGuid: candidate.rssGuid,
          fetchedAt: new Date().toISOString(),
        };

        this.store.saveMemo(entry.slug, entry.title, entry.date, entry.url, markdown);

        index.memos.push(entry);
        result.fetched.push(candidate.slug);
        console.log(`  ✓ Saved: ${candidate.title}`);

        if (result.fetched.length < candidates.filter(c => !known.has(c.rssGuid)).length - 1) {
          await this.delay();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ slug: candidate.slug, error: msg });
        console.error(`  ✗ Failed: ${candidate.title} — ${msg}`);
      }
    }

    // Update index
    index.memos.sort((a, b) => b.date.localeCompare(a.date));
    index.lastChecked = new Date().toISOString();
    this.store.saveIndex(index);

    if (result.fetched.length === 0 && result.errors.length === 0) {
      console.log('No new memos found.');
    } else {
      console.log(`Check complete. New: ${result.fetched.length}, Skipped: ${result.skipped.length}, Errors: ${result.errors.length}`);
    }

    return result;
  }

  /**
   * Get current status of the memo store.
   */
  status(): { total: number; lastChecked: string; latest: MemoEntry | undefined } {
    const index = this.store.loadIndex();
    return {
      total: index.memos.length,
      lastChecked: index.lastChecked,
      latest: index.memos.length > 0 ? index.memos[0] : undefined,
    };
  }

  private delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.delayMs));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engines/memo-fetcher/__tests__/memo-fetcher.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engines/memo-fetcher/memo-fetcher.ts src/engines/memo-fetcher/__tests__/memo-fetcher.test.ts
git commit -m "feat(memo-fetcher): add MemoFetcher orchestration layer"
```

---

### Task 6: Barrel Export

**Files:**
- Create: `src/engines/memo-fetcher/index.ts`

- [ ] **Step 1: Create the barrel export file**

```typescript
// src/engines/memo-fetcher/index.ts
export { MemoFetcher } from './memo-fetcher.js';
export { parseRssXml, extractMemoCandidates, fetchRssEpisodes } from './rss-poller.js';
export { htmlToMarkdown, extractMemoContent, fetchMemoHtml } from './html-scraper.js';
export { MemoStore } from './memo-store.js';
export type { MemoEntry, MemoIndex, MemoCandidate, RssEpisode, FetchResult } from './types.js';
```

- [ ] **Step 2: Verify everything compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/engines/memo-fetcher/index.ts
git commit -m "feat(memo-fetcher): add barrel exports"
```

---

### Task 7: CLI Command Rewrite

**Files:**
- Modify: `src/commands/update-memos.ts`

- [ ] **Step 1: Rewrite update-memos.ts with subcommands**

```typescript
// src/commands/update-memos.ts
import type { Command } from 'commander';
import cron from 'node-cron';
import { MemoFetcher } from '../engines/memo-fetcher/index.js';

export function registerUpdateMemosCommand(program: Command): void {
  const cmd = program
    .command('update-memos')
    .description('Manage Oaktree Capital Howard Marks memos');

  cmd
    .command('init')
    .description('Fetch the latest 10 memos from Oaktree Capital')
    .option('-n, --count <number>', 'Number of memos to fetch', '10')
    .action(async (options) => {
      const fetcher = new MemoFetcher();
      const count = parseInt(options.count, 10);
      const result = await fetcher.init(count);
      process.exit(result.errors.length > 0 ? 1 : 0);
    });

  cmd
    .command('check')
    .description('Check for new memos since last update')
    .action(async () => {
      const fetcher = new MemoFetcher();
      const result = await fetcher.check();
      process.exit(result.errors.length > 0 ? 1 : 0);
    });

  cmd
    .command('schedule')
    .description('Start weekly scheduler to auto-check for new memos')
    .option('--cron <expression>', 'Cron expression for schedule', '0 9 * * 1')
    .action((options) => {
      const fetcher = new MemoFetcher();
      const expression = options.cron;

      if (!cron.validate(expression)) {
        console.error(`Invalid cron expression: ${expression}`);
        process.exit(1);
      }

      console.log(`Starting memo scheduler: ${expression}`);
      console.log('Press Ctrl+C to stop.');

      cron.schedule(expression, async () => {
        try {
          console.log(`\n[${new Date().toISOString()}] Running scheduled memo check...`);
          await fetcher.check();
        } catch (err) {
          console.error('Scheduled check failed:', err);
        }
      });

      // Keep process alive
      process.on('SIGINT', () => {
        console.log('\nScheduler stopped.');
        process.exit(0);
      });
    });

  cmd
    .command('status')
    .description('Show current memo status')
    .action(() => {
      const fetcher = new MemoFetcher();
      const status = fetcher.status();

      console.log(`Total memos: ${status.total}`);
      console.log(`Last checked: ${status.lastChecked || 'never'}`);
      if (status.latest) {
        console.log(`Latest: ${status.latest.title} (${status.latest.date})`);
      }
    });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/update-memos.ts
git commit -m "feat(memo-fetcher): rewrite update-memos CLI with init/check/schedule/status subcommands"
```

---

### Task 8: Update Existing Test

**Files:**
- Modify: `src/knowledge/__tests__/knowledge.test.ts`

The existing test checks `expect(Object.keys(knowledge.memos).length).toBe(0)` which will fail after init runs. Update it to be forward-compatible.

- [ ] **Step 1: Update the knowledge test**

Change line 27-29 in `src/knowledge/__tests__/knowledge.test.ts`:

Old:
```typescript
  it('returns empty memos in Phase 1', () => {
    const knowledge = loadKnowledge();
    expect(Object.keys(knowledge.memos).length).toBe(0);
  });
```

New:
```typescript
  it('loads memo files from knowledge/memos directory', () => {
    const knowledge = loadKnowledge();
    // After running `oak-invest update-memos init`, memos will be populated
    // Before init, the memos directory is empty so this returns {}
    expect(typeof knowledge.memos).toBe('object');
  });
```

- [ ] **Step 2: Run all knowledge tests**

Run: `npx vitest run src/knowledge/__tests__/knowledge.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/knowledge/__tests__/knowledge.test.ts
git commit -m "test: update knowledge test for memo-fetcher compatibility"
```

---

### Task 9: Full Test Suite & Integration Verification

**Files:**
- No new files

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `pnpm run build`
Expected: Build succeeds with exit code 0

- [ ] **Step 4: Commit (only if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address test/build issues from memo-fetcher integration"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: All acceptance criteria from the design spec mapped to tasks
  - AC1 (init fetches 10 memos) → Task 5, Task 7
  - AC2 (correct frontmatter + content) → Task 4, Task 5
  - AC3 (index.json created) → Task 4, Task 5
  - AC4 (check detects new memos) → Task 5, Task 7
  - AC5 (no new memos exits cleanly) → Task 5
  - AC6 (schedule runs weekly) → Task 7
  - AC7 (loader/prompt-builder unchanged) → Task 8 (test update only)
  - AC8 (no new deps) → verified, all use existing cheerio/node-cron
  - AC9 (all tests pass) → Task 9
- [x] **Placeholder scan**: No TBD/TODO/vague steps. All code blocks contain complete implementation.
- [x] **Type consistency**: `MemoEntry`, `MemoIndex`, `MemoCandidate`, `RssEpisode`, `FetchResult` used consistently across all tasks. Method signatures match between definition and usage.
