import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchRssEpisodes, extractMemoCandidates } from './rss-poller.js';
import { fetchMemoHtml } from './html-scraper.js';
import { MemoStore } from './memo-store.js';
import type { MemoEntry, FetchResult } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getDefaultMemosDir(): string {
  return path.resolve(__dirname, '..', '..', '..', 'knowledge', 'memos');
}

export class MemoFetcher {
  private store: MemoStore;

  constructor(
    memosDir: string = getDefaultMemosDir(),
    private readonly delayMs: number = 2000,
  ) {
    this.store = new MemoStore(memosDir);
  }

  async init(limit: number = 10): Promise<FetchResult> {
    const result: FetchResult = { fetched: [], skipped: [], errors: [] };

    console.log('Fetching RSS feed...');
    const episodes = await fetchRssEpisodes();
    const candidates = extractMemoCandidates(episodes);
    const toFetch = candidates.slice(0, limit);

    console.log(`Found ${candidates.length} memo candidates, fetching ${toFetch.length}...`);

    for (let i = 0; i < toFetch.length; i++) {
      const candidate = toFetch[i];
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

        const index = this.store.loadIndex();
        index.memos.push(entry);
        index.memos.sort((a, b) => b.date.localeCompare(a.date));
        index.lastChecked = new Date().toISOString();
        this.store.saveIndex(index);

        result.fetched.push(candidate.slug);
        console.log(`  ✓ Saved: ${candidate.title}`);

        if (i < toFetch.length - 1) {
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

  async check(): Promise<FetchResult> {
    const result: FetchResult = { fetched: [], skipped: [], errors: [] };

    console.log('Checking for new memos...');
    const episodes = await fetchRssEpisodes();
    const candidates = extractMemoCandidates(episodes);

    const index = this.store.loadIndex();
    const known = this.store.knownGuids(index);
    const newCandidates = candidates.filter(c => !known.has(c.rssGuid));

    for (let i = 0; i < newCandidates.length; i++) {
      const candidate = newCandidates[i];

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

        if (i < newCandidates.length - 1) {
          await this.delay();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ slug: candidate.slug, error: msg });
        console.error(`  ✗ Failed: ${candidate.title} — ${msg}`);
      }
    }

    const skipped = candidates.filter(c => known.has(c.rssGuid));
    result.skipped = skipped.map(c => c.slug);

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
