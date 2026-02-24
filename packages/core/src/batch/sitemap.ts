/**
 * A single URL entry discovered from a sitemap.
 */
export interface SitemapUrlEntry {
  /** The discovered page URL. */
  loc: string;

  /** Optional ISO-ish last modified timestamp. */
  lastmod?: string;
}

/**
 * Options used when filtering discovered URLs.
 */
export interface SitemapFilterOptions {
  /** Maximum number of pages to return after filtering/sorting. */
  maxPages?: number;

  /** Include patterns (glob-like). If provided, only matches are kept. */
  include?: string[];

  /** Exclude patterns (glob-like). Matches are removed. */
  exclude?: string[];
}

/**
 * Parse a sitemap XML string into URL entries.
 *
 * Supports both:
 * - `<urlset>` (sitemap URLs)
 * - `<sitemapindex>` (index of sitemaps)
 *
 * This parser is intentionally lightweight (regex-based) to avoid adding a
 * heavy XML dependency for the early project phases.
 */
export function parseSitemapXml(
  xml: string,
): { kind: 'urlset'; urls: SitemapUrlEntry[] } | { kind: 'index'; sitemaps: SitemapUrlEntry[] } {
  const text = xml.trim();

  const isIndex = /<\s*sitemapindex\b/i.test(text);
  const isUrlset = /<\s*urlset\b/i.test(text);

  if (isIndex) {
    const sitemaps = extractLocLastmod(text, 'sitemap');
    return { kind: 'index', sitemaps };
  }

  if (isUrlset) {
    const urls = extractLocLastmod(text, 'url');
    return { kind: 'urlset', urls };
  }

  // Fall back: try treating as urlset.
  const urls = extractLocLastmod(text, 'url');
  return { kind: 'urlset', urls };
}

/**
 * Filter + sort discovered URLs for auditing.
 *
 * Sorting: prefer entries with `lastmod` (newest first), then stable by URL.
 */
export function filterSitemapUrls(
  urls: SitemapUrlEntry[],
  options: SitemapFilterOptions = {},
): SitemapUrlEntry[] {
  const include = (options.include ?? []).filter(Boolean);
  const exclude = (options.exclude ?? []).filter(Boolean);

  let out = urls.slice();

  if (include.length > 0) {
    out = out.filter((u) => include.some((p) => globMatch(p, u.loc)));
  }

  if (exclude.length > 0) {
    out = out.filter((u) => !exclude.some((p) => globMatch(p, u.loc)));
  }

  out.sort((a, b) => {
    const ad = a.lastmod ? Date.parse(a.lastmod) : NaN;
    const bd = b.lastmod ? Date.parse(b.lastmod) : NaN;
    const aHas = Number.isFinite(ad);
    const bHas = Number.isFinite(bd);
    if (aHas && bHas && ad !== bd) return bd - ad;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.loc.localeCompare(b.loc);
  });

  const maxPages =
    typeof options.maxPages === 'number' && options.maxPages > 0
      ? Math.floor(options.maxPages)
      : undefined;
  return maxPages ? out.slice(0, maxPages) : out;
}

function extractLocLastmod(xml: string, tagName: string): SitemapUrlEntry[] {
  const entries: SitemapUrlEntry[] = [];
  const re = new RegExp(`<\\s*${tagName}\\b[\\s\\S]*?<\\s*\\/\\s*${tagName}\\s*>`, 'gi');
  const locRe = /<\s*loc\s*>([\s\S]*?)<\s*\/\s*loc\s*>/i;
  const lastmodRe = /<\s*lastmod\s*>([\s\S]*?)<\s*\/\s*lastmod\s*>/i;

  const matches = xml.match(re) ?? [];
  for (const block of matches) {
    const locMatch = block.match(locRe);
    if (!locMatch?.[1]) continue;
    const loc = decodeXml(locMatch[1].trim());
    const lastmodMatch = block.match(lastmodRe);
    const lastmod = lastmodMatch?.[1] ? decodeXml(lastmodMatch[1].trim()) : undefined;
    entries.push({ loc, lastmod });
  }

  return entries;
}

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Very small glob matcher supporting `*` and `**`.
 *
 * - `*` matches any characters except `/`
 * - `**` matches any characters including `/`
 */
function globMatch(pattern: string, value: string): boolean {
  const re = globToRegExp(pattern);
  return re.test(value);
}

function globToRegExp(pattern: string): RegExp {
  let out = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;

    if (ch === '*') {
      const next = pattern[i + 1];
      if (next === '*') {
        out += '.*';
        i += 1;
      } else {
        out += '[^/]*';
      }
      continue;
    }

    // Escape regex special chars.
    if (/[.+^${}()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  out += '$';
  return new RegExp(out, 'i');
}
