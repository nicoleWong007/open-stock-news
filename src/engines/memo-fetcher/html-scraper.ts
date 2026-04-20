import * as cheerio from 'cheerio';

const SELECTORS = [
  '.article-content',
  '.memo-content',
  '.insights-3col-wrapper .article-content',
];

const BASE_URL = 'https://www.oaktreecapital.com';

export function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html);

  function getText(el: cheerio.Cheerio<any>): string {
    const parts: string[] = [];

    el.contents().each((_i: number, node: any) => {
      const $node = $(node);

      if (node.type === 'text') {
        const text = $node.text();
        if (text) parts.push(text);
        return;
      }

      if (node.type !== 'tag') return;

      const tag = (node as any).tagName?.toLowerCase();

      switch (tag) {
        case 'strong':
        case 'b':
          parts.push(`**${getText($node)}**`);
          break;
        case 'em':
        case 'i':
          parts.push(`*${getText($node)}*`);
          break;
        case 'a': {
          const href = $node.attr('href') ?? '';
          parts.push(`[${getText($node)}](${href})`);
          break;
        }
        case 'br':
          parts.push('\n');
          break;
        default:
          parts.push(getText($node));
          break;
      }
    });

    return parts.join('');
  }

  function convertBlock(el: any): string {
    if (el.type === 'text') {
      const text = $(el).text().trim();
      return text;
    }

    if (el.type !== 'tag') return '';

    const $el = $(el);
    const tag = (el as any).tagName?.toLowerCase();

    switch (tag) {
      case 'p':
        return getText($el).trim();
      case 'h2':
        return `## ${getText($el).trim()}`;
      case 'h3':
        return `### ${getText($el).trim()}`;
      case 'h4':
        return `#### ${getText($el).trim()}`;
      case 'blockquote': {
        const inner = convertChildren($el).trim();
        return inner.split('\n').map((l: string) => `> ${l}`).join('\n');
      }
      case 'ul': {
        const items: string[] = [];
        $el.children('li').each((_li: number, li: any) => {
          items.push(`- ${getText($(li)).trim()}`);
        });
        return items.join('\n');
      }
      case 'ol': {
        const items: string[] = [];
        let idx = 1;
        $el.children('li').each((_li: number, li: any) => {
          items.push(`${idx++}. ${getText($(li)).trim()}`);
        });
        return items.join('\n');
      }
      default:
        return convertChildren($el).trim();
    }
  }

  function convertChildren(parent: cheerio.Cheerio<any>): string {
    const blocks: string[] = [];
    parent.contents().each((_i: number, child: any) => {
      const result = convertBlock(child);
      if (result.trim()) blocks.push(result.trim());
    });
    return blocks.join('\n\n');
  }

  const body = $('body');
  const blocks: string[] = [];
  body.contents().each((_i: number, child: any) => {
    const result = convertBlock(child);
    if (result.trim()) blocks.push(result.trim());
  });

  let result = blocks.join('\n\n');
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

export function extractMemoContent(pageHtml: string): string {
  const $ = cheerio.load(pageHtml);

  for (const selector of SELECTORS) {
    const $el = $(selector);
    if ($el.length > 0) {
      return htmlToMarkdown($el.html() ?? '');
    }
  }

  return '';
}

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
