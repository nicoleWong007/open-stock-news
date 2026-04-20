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
    expect(md).toBe('Line one\nLine two');
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
