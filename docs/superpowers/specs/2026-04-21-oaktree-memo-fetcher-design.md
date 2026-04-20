# Oaktree Memo Auto-Fetcher Design

## Problem

The `oak-invest` CLI project needs to automatically fetch Howard Marks' memos from Oaktree Capital. Currently:
- `knowledge/memos/` is empty
- `update-memos` command is a stub that prints "Phase 2"
- `knowledge/loader.ts` can already read `.md` files from `knowledge/memos/`
- `prompt-builder.ts` injects memos as "Recent Oaktree Memos" into the AI system prompt

## Solution

Use ART19 podcast RSS feed as a lightweight change-detection mechanism, then scrape the full memo text from Oaktree's website.

### Why This Approach

- Oaktree's website has **no RSS feed** for written memos
- The site is Sitefinity CMS with AJAX-loaded content (`loadInsights`), making direct scraping fragile
- ART19 podcast RSS (`https://rss.art19.com/the-memo-by-howard-marks`) is a standard XML feed updated in tandem with new memos
- Each RSS episode description contains a direct link to `oaktreecapital.com/insights/memo/{slug}`
- Individual memo pages serve full text content in static HTML (no JS rendering needed)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  update-memos command                │
├─────────────┬──────────────┬────────────────────────┤
│  init       │  check       │  scheduler             │
│  (初始化10条) │  (检查更新)    │  (node-cron每周触发)    │
└──────┬──────┴──────┬───────┴──────────┬─────────────┘
       │             │                  │
       ▼             ▼                  ▼
┌─────────────────────────────────────────────────────┐
│            MemoFetcher (核心类)                       │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ RssPoller       │  │ HtmlScraper              │  │
│  │ fetch ART19 RSS │  │ fetch oaktreecapital.com  │  │
│  │ parse episodes  │  │ parse with cheerio        │  │
│  │ extract slugs   │  │ convert HTML to Markdown  │  │
│  └─────────────────┘  └──────────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ MemoStore       │  │ MemoIndex                 │  │
│  │ read/write .md  │  │ read/write index.json     │  │
│  └─────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## File Structure

```
src/
  engines/
    memo-fetcher/
      rss-poller.ts        # ART19 RSS fetch + parse
      html-scraper.ts      # Oaktree HTML scrape -> Markdown
      memo-store.ts        # Local .md file I/O + index.json
      memo-fetcher.ts      # Orchestration: rss + scraper + store
      types.ts             # Type definitions
      __tests__/
        rss-poller.test.ts
        html-scraper.test.ts
        memo-store.test.ts
        memo-fetcher.test.ts
  commands/
    update-memos.ts        # Rewrite: init / check / start-scheduler

knowledge/
  memos/
    index.json             # Memo metadata index
    ai-hurtles-ahead.md    # Fetched memo content
    is-it-a-bubble.md
    ...
```

## Data Model

```typescript
// types.ts

interface MemoEntry {
  slug: string;              // "ai-hurtles-ahead"
  title: string;             // "AI Hurtles Ahead"
  date: string;              // "2026-02-26" (ISO date from pubDate)
  url: string;               // "https://www.oaktreecapital.com/insights/memo/ai-hurtles-ahead"
  rssGuid: string;           // ART19 episode GUID (for dedup)
  fetchedAt: string;         // ISO timestamp when fetched
}

interface MemoIndex {
  lastChecked: string;       // ISO timestamp of last RSS check
  memos: MemoEntry[];        // Fetched memos sorted by date descending
}
```

## Core Flows

### Init (初始化)

```
oak-invest update-memos init
```

1. Fetch `https://rss.art19.com/the-memo-by-howard-marks`
2. Parse XML, extract all `<item>` elements
3. Filter: keep only episodes whose description contains `oaktreecapital.com/insights/memo/` (excludes specials like "30 Years of Oaktree", "Behind the Memo" episodes)
4. Extract memo slug from the URL in description (regex: `/insights/memo/([^"<\s]+)`)
5. Take first 10 filtered episodes
6. For each slug, fetch `https://www.oaktreecapital.com/insights/memo/{slug}`
7. Use cheerio to extract content from `.article-content` or similar selector
8. Convert HTML to Markdown (see HTML-to-Markdown section)
9. Save to `knowledge/memos/{slug}.md` with frontmatter header:
   ```
   ---
   title: "AI Hurtles Ahead"
   date: "2026-02-26"
   url: "https://www.oaktreecapital.com/insights/memo/ai-hurtles-ahead"
   ---

   [memo content in markdown]
   ```
10. Update `knowledge/memos/index.json` with all fetched entries
11. Rate limit: 2-second delay between each page fetch

### Check (更新检查)

```
oak-invest update-memos check
```

1. Fetch RSS
2. Load `knowledge/memos/index.json`
3. Build set of known `rssGuid` values
4. Parse RSS episodes, filter for memo-type episodes
5. Find episodes with `rssGuid` not in known set
6. For each new episode:
   a. Extract slug
   b. Fetch HTML page
   c. Convert to Markdown
   d. Save `.md` file
   e. Add entry to index
7. Update `lastChecked` in index.json
8. Print summary: "Found N new memos: [titles]"

### Scheduler (定时调度)

```
oak-invest update-memos schedule
```

1. Use `node-cron` (already installed) with weekly schedule: `0 9 * * 1` (every Monday 9am)
2. On each tick, run the check flow
3. Log results to console
4. Keep process alive with the cron running

## RSS Parsing Details

**Feed URL**: `https://rss.art19.com/the-memo-by-howard-marks`

**Episode structure (relevant fields)**:
```xml
<item>
  <title>AI Hurtles Ahead</title>
  <description><![CDATA[...read the memo <a href="https://oaktreecapital.com/insights/memo/ai-hurtles-ahead">here</a>...]]></description>
  <guid isPermaLink="false">gid://art19-episode-locator/V0/acikbIG5u...</guid>
  <pubDate>Thu, 26 Feb 2026 05:00:00 -0000</pubDate>
</item>
```

**Memo detection**: Episode description contains `oaktreecapital.com/insights/memo/` in an anchor tag. Episodes without this link are specials (fireside chats, interviews, "Behind the Memo" discussions).

**Slug extraction**: Regex `oaktreecapital\.com/insights/memo/([^"<\s]+)` from description/content:encoded.

**No additional dependencies needed** — use native `DOMParser` or a lightweight XML parser. The project already has Node.js 20+ which includes DOMParser.

## HTML to Markdown Conversion

Use cheerio (already installed) to extract and convert.

**Content selector**: The memo text is in a `.article-content` container on the page. The selector needs testing but the page structure shows content directly in the page body after the title area.

**Conversion rules**:
| HTML | Markdown |
|------|----------|
| `<p>` | Paragraph (double newline) |
| `<h2>` | `## ` |
| `<h3>` | `### ` |
| `<h4>` | `#### ` |
| `<strong>`, `<b>` | `**text**` |
| `<em>`, `<i>` | `*text*` |
| `<a href="url">text</a>` | `[text](url)` |
| `<blockquote>` | `> ` |
| `<ul><li>` | `- ` |
| `<ol><li>` | `1. ` |
| `<br>` | newline |
| `<sup>` | Keep as text |

**No Turndown or similar library** — manual conversion with cheerio keeps dependencies zero and gives control over edge cases in Oaktree's HTML structure.

## Error Handling

- **RSS fetch failure**: Log error, exit gracefully. Do not modify any existing data. Next run retries.
- **Individual memo fetch failure**: Skip that memo, log the error, continue with others. Record the failed attempt.
- **Rate limiting**: 2-second delay between page fetches to avoid being blocked.
- **Timeout**: 30 seconds per page fetch.
- **Duplicate protection**: Use `rssGuid` as the unique key. Never re-fetch a memo whose guid exists in index.json.
- **Concurrent safety**: Sequential processing only. No parallel fetches.

## CLI Interface

```bash
# Initialize: fetch latest 10 memos
oak-invest update-memos init

# Check for new memos (one-shot)
oak-invest update-memos check

# Start weekly scheduler (long-running process)
oak-invest update-memos schedule

# Show current memo status
oak-invest update-memos status
```

## Integration Points

- `knowledge/loader.ts` already reads all `.md` files from `knowledge/memos/` — no changes needed
- `knowledge/prompt-builder.ts` already includes memos in system prompt — no changes needed
- The `update-memos` command in `src/commands/update-memos.ts` gets rewritten from stub to full implementation
- New `src/engines/memo-fetcher/` module under the already-existing (but empty) `src/engines/` directory

## Acceptance Criteria

1. `oak-invest update-memos init` fetches exactly 10 recent memos, saves as `.md` files in `knowledge/memos/`
2. Each `.md` file has correct frontmatter (title, date, url) and readable Markdown content
3. `knowledge/memos/index.json` is created with 10 entries
4. `oak-invest update-memos check` detects new memos since last check and fetches them
5. Running `check` when no new memos exist exits cleanly with "No new memos"
6. `oak-invest update-memos schedule` starts a weekly cron that runs check automatically
7. Existing `knowledge/loader.ts` and `prompt-builder.ts` work without modifications
8. No new npm dependencies required (cheerio + node-cron already installed)
9. All tests pass: unit tests for rss-poller, html-scraper, memo-store, memo-fetcher
