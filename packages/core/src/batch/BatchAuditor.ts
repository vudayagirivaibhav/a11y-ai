import { EventEmitter } from 'node:events';

import type { AuditConfig } from '../auditor/types.js';
import type { AuditResult } from '../types/audit.js';
import type { BatchAuditResult, BatchAuditSummary, BatchPageResult } from '../types/batch.js';
import type { Violation } from '../types/violation.js';

import { A11yAuditor } from '../auditor/A11yAuditor.js';
import { runWithConcurrency } from './queue.js';
import { type SitemapFilterOptions, filterSitemapUrls, parseSitemapXml } from './sitemap.js';

/**
 * Target input for a batch audit.
 */
export type BatchTarget =
  | string
  | URL
  | {
      /** URL/HTML target (same semantics as `A11yAuditor.audit(...)`). */
      target: string | URL;
      /** Higher numbers run earlier (useful for "important pages first"). */
      priority?: number;
    };

/**
 * Batch auditing engine.
 *
 * This runs multiple page audits with a concurrency limit, reusing:
 * - the same AI provider instance (so rate limiting is shared), and
 * - the same cache adapter (so repeated prompts can be reused across pages).
 */
export class BatchAuditor extends EventEmitter {
  private readonly config: AuditConfig;
  private readonly auditor: A11yAuditor;

  constructor(config: AuditConfig) {
    super();
    this.config = config;
    this.auditor = new A11yAuditor(config);
  }

  /**
   * Audit a list of targets with concurrency control.
   */
  async audit(targets: BatchTarget[]): Promise<BatchAuditResult> {
    const startedAt = new Date().toISOString();

    const normalized = targets
      .map((t, idx) => {
        if (typeof t === 'string' || t instanceof URL) {
          return { target: t, priority: 0, idx };
        }
        return { target: t.target, priority: t.priority ?? 0, idx };
      })
      .sort((a, b) => (b.priority !== a.priority ? b.priority - a.priority : a.idx - b.idx));

    const concurrency = this.config.concurrency ?? 3;
    let completed = 0;

    const sharedBrowser = await createSharedBrowser(this.config).catch(() => null);

    const pages = await runWithConcurrency({
      items: normalized,
      concurrency,
      worker: async (item) => {
        const started = Date.now();
        const targetStr = typeof item.target === 'string' ? item.target : item.target.toString();

        this.emit('page:start', { target: targetStr });

        try {
          const result = await auditOne({
            auditor: this.auditor,
            sharedBrowser,
            target: item.target,
            extractionTimeoutMs: this.config.extraction?.timeoutMs,
            viewport: this.config.extraction?.viewport,
          });
          const page: BatchPageResult = {
            target: targetStr,
            url: result.url,
            result,
            durationMs: Date.now() - started,
          };
          this.emit('page:complete', { target: targetStr, score: result.summary.score });
          return page;
        } catch (error) {
          const page: BatchPageResult = {
            target: targetStr,
            durationMs: Date.now() - started,
            error: {
              message: error instanceof Error ? error.message : 'Batch audit failed',
              cause: error,
            },
          };
          this.emit('page:error', { target: targetStr, error });
          return page;
        }
      },
      onProgress: (info) => {
        completed = info.completed;
        this.emit('progress', {
          completed,
          total: info.total,
          percent: info.total ? completed / info.total : 1,
        });
      },
    });

    await sharedBrowser?.close().catch(() => undefined);

    const completedAt = new Date().toISOString();
    const summary = summarizeBatch(pages);

    return {
      startedAt,
      completedAt,
      pages,
      summary,
    };
  }

  /**
   * Audit a sitemap by URL.
   *
   * This fetches the sitemap XML, expands sitemap indexes, filters URLs, and
   * then audits the resulting page list.
   */
  async auditSitemap(
    sitemapUrl: string,
    options: SitemapFilterOptions = {},
  ): Promise<BatchAuditResult> {
    const discovered = await discoverSitemapUrls(sitemapUrl, options.maxPages ?? 50);
    const filtered = filterSitemapUrls(discovered, options);
    return await this.audit(filtered.map((u) => u.loc));
  }
}

type SharedBrowser = {
  newPage: () => Promise<unknown>;
  goto: (
    page: unknown,
    url: string,
    options?: { timeoutMs?: number; viewport?: { width: number; height: number } },
  ) => Promise<void>;
  closePage: (page: unknown) => Promise<void>;
  close: () => Promise<void>;
};

async function auditOne(options: {
  auditor: A11yAuditor;
  sharedBrowser: SharedBrowser | null;
  target: string | URL;
  extractionTimeoutMs?: number;
  viewport?: { width: number; height: number };
}): Promise<AuditResult> {
  const { auditor, sharedBrowser, target } = options;

  const url = toUrlIfUrlLike(target);
  if (url && sharedBrowser) {
    const page = await sharedBrowser.newPage();
    try {
      await sharedBrowser.goto(page, url, {
        timeoutMs: options.extractionTimeoutMs,
        viewport: options.viewport,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await auditor.auditPage(page as any);
    } finally {
      await sharedBrowser.closePage(page);
    }
  }

  return await auditor.audit(target);
}

function toUrlIfUrlLike(target: string | URL): string | null {
  if (target instanceof URL) return target.toString();
  const trimmed = target.trim();
  if (trimmed.startsWith('<')) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    return null;
  } catch {
    return null;
  }
}

async function createSharedBrowser(config: AuditConfig): Promise<SharedBrowser | null> {
  const browserPref = config.extraction?.browser ?? 'auto';
  const wants =
    browserPref === 'playwright' || browserPref === 'puppeteer' || browserPref === 'auto';
  if (!wants) return null;

  // Prefer Playwright when in auto mode.
  if (browserPref === 'auto' || browserPref === 'playwright') {
    const pw = await tryImportPlaywright();
    if (pw) return pw;
    if (browserPref === 'playwright') return null;
  }

  if (browserPref === 'auto' || browserPref === 'puppeteer') {
    const pp = await tryImportPuppeteer();
    if (pp) return pp;
  }

  return null;
}

async function tryImportPlaywright(): Promise<SharedBrowser | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('playwright');

    const chromium = mod.chromium;

    const browser = await chromium.launch();

    return {
      newPage: async () => {
        return await browser.newPage();
      },
      goto: async (page, url, options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = page;
        if (options?.viewport && typeof p?.setViewportSize === 'function') {
          await p.setViewportSize(options.viewport);
        }

        await p.goto(url, { waitUntil: 'networkidle', timeout: options?.timeoutMs ?? 30_000 });
      },
      closePage: async (page) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = page;
        if (typeof p?.close === 'function') {
          await p.close();
        }
      },
      close: async () => {
        await browser.close();
      },
    };
  } catch {
    return null;
  }
}

async function tryImportPuppeteer(): Promise<SharedBrowser | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('puppeteer');
    const puppeteer = mod.default ?? mod;

    const browser = await puppeteer.launch({ headless: true });

    return {
      newPage: async () => {
        return await browser.newPage();
      },
      goto: async (page, url, options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = page;
        if (options?.viewport && typeof p?.setViewport === 'function') {
          await p.setViewport(options.viewport);
        }

        await p.goto(url, { waitUntil: 'networkidle0', timeout: options?.timeoutMs ?? 30_000 });
      },
      closePage: async (page) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = page;
        if (typeof p?.close === 'function') {
          await p.close();
        }
      },
      close: async () => {
        await browser.close();
      },
    };
  } catch {
    return null;
  }
}

async function discoverSitemapUrls(
  sitemapUrl: string,
  maxUrls: number,
): Promise<Array<{ loc: string; lastmod?: string }>> {
  const visited = new Set<string>();
  const out: Array<{ loc: string; lastmod?: string }> = [];

  const queue: string[] = [sitemapUrl];

  while (queue.length > 0 && out.length < maxUrls) {
    const next = queue.shift()!;
    if (visited.has(next)) continue;
    visited.add(next);

    const xml = await fetchText(next);
    const parsed = parseSitemapXml(xml);

    if (parsed.kind === 'index') {
      for (const sm of parsed.sitemaps) {
        if (out.length >= maxUrls) break;
        if (sm.loc) queue.push(sm.loc);
      }
      continue;
    }

    for (const u of parsed.urls) {
      if (out.length >= maxUrls) break;
      out.push(u);
    }
  }

  return out;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: ${url} (${res.status})`);
  }
  return await res.text();
}

function summarizeBatch(pages: BatchPageResult[]): BatchAuditSummary {
  const successful = pages.filter((p) => p.result);
  const failed = pages.length - successful.length;

  const scores = successful.map((p) => p.result!.summary.score);
  const averageScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const worstPages = successful
    .map((p) => ({ target: p.target, score: p.result!.summary.score }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const issueStats = buildIssueStats(successful.map((p) => p.result!.mergedViolations));
  const mostCommonIssues = issueStats.sorted.slice(0, 10).map((s) => ({
    key: s.key,
    countPages: s.pageCount,
    countTotal: s.totalCount,
    example: s.example,
  }));

  const thresholdPages = Math.ceil(successful.length / 2);
  const siteWideIssues = issueStats.sorted
    .filter((s) => s.pageCount >= thresholdPages && successful.length > 0)
    .map((s) => ({ key: s.key, countPages: s.pageCount, example: s.example }));

  return {
    totalPages: pages.length,
    succeeded: successful.length,
    failed,
    averageScore,
    worstPages,
    mostCommonIssues,
    siteWideIssues,
  };
}

function buildIssueStats(pagesViolations: Violation[][]): {
  sorted: Array<{ key: string; pageCount: number; totalCount: number; example: Violation }>;
} {
  const perKeyTotal: Record<string, number> = {};
  const perKeyPages: Record<string, number> = {};
  const perKeyExample: Record<string, Violation> = {};

  for (const violations of pagesViolations) {
    const seenThisPage = new Set<string>();
    for (const v of violations) {
      const key = issueKey(v);
      perKeyTotal[key] = (perKeyTotal[key] ?? 0) + 1;
      if (!perKeyExample[key]) perKeyExample[key] = v;
      if (!seenThisPage.has(key)) {
        perKeyPages[key] = (perKeyPages[key] ?? 0) + 1;
        seenThisPage.add(key);
      }
    }
  }

  const sorted = Object.keys(perKeyTotal)
    .map((key) => ({
      key,
      pageCount: perKeyPages[key] ?? 0,
      totalCount: perKeyTotal[key] ?? 0,
      example: perKeyExample[key]!,
    }))
    .sort((a, b) => b.pageCount - a.pageCount || b.totalCount - a.totalCount);

  return { sorted };
}

function issueKey(v: Violation): string {
  if (v.rule?.ruleId) return `ai:${v.rule.ruleId}`;
  if (v.axe?.id) return `axe:${v.axe.id}`;
  return `msg:${v.message}`;
}
