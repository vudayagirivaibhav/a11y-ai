import { describe, expect, it } from 'vitest';

import { filterSitemapUrls, parseSitemapXml } from './sitemap.js';

describe('sitemap parsing', () => {
  it('parses a urlset sitemap', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2026-02-01</lastmod></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;

    const parsed = parseSitemapXml(xml);
    expect(parsed.kind).toBe('urlset');
    if (parsed.kind === 'urlset') {
      expect(parsed.urls).toHaveLength(2);
      expect(parsed.urls[0]!.loc).toContain('https://example.com/');
    }
  });

  it('filters sitemap URLs via include/exclude globs', () => {
    const urls = [
      { loc: 'https://example.com/' },
      { loc: 'https://example.com/blog/one' },
      { loc: 'https://example.com/admin' },
    ];

    const filtered = filterSitemapUrls(urls, {
      include: ['https://example.com/**'],
      exclude: ['**/admin'],
    });
    expect(filtered.map((u) => u.loc)).toEqual([
      'https://example.com/',
      'https://example.com/blog/one',
    ]);
  });
});
