import { describe, it, expect } from 'vitest';
import { parseRssXml, extractMemoCandidates } from '../rss-poller.js';

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
