import type { RssEpisode, MemoCandidate } from './types.js';

const RSS_FEED_URL = 'https://rss.art19.com/the-memo-by-howard-marks';
const MEMO_URL_PATTERN = /oaktreecapital\.com\/insights\/memo\/([^"<\s]+)/;

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

function parsePubDate(pubDate: string): string {
  const date = new Date(pubDate);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

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
