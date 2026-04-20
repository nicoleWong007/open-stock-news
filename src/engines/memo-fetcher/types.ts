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
