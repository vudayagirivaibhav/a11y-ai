import type { AxeResults } from 'axe-core';

import type { AxeRunConfig, AxeViolation } from '../types/axe.js';

import { normalizeAxeResults } from './normalize.js';

/**
 * Thin wrapper around axe-core with:
 * - jsdom support for HTML strings
 * - page injection support for playwright/puppeteer
 * - normalized output format
 */
export class AxeRunner {
  /**
   * Run axe-core against a raw HTML string using jsdom.
   */
  async run(html: string, config: AxeRunConfig = {}): Promise<AxeViolation[]> {
    const results = await runAxeInJSDOM(html, config);
    return normalizeAxeResults(results);
  }

  /**
   * Run axe-core against a live browser page (playwright or puppeteer).
   *
   * The page must support:
   * - `addScriptTag({ content })`
   * - `evaluate(fn, arg)`
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async runOnPage(page: any, config: AxeRunConfig = {}): Promise<AxeViolation[]> {
    const axe = await import('axe-core');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    await page.addScriptTag({ content: axe.source });

    const options = buildAxeRunOptions(config);
    const context = buildAxeRunContext(config);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    const results = (await page.evaluate(
      async ({ context, options }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (!w.axe) throw new Error('axe not found on page');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return await w.axe.run(context ?? document, options);
      },
      { context, options },
    )) as AxeResults;

    return normalizeAxeResults(results);
  }
}

async function runAxeInJSDOM(html: string, config: AxeRunConfig): Promise<AxeResults> {
  let JSDOM: typeof import('jsdom').JSDOM;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch (error) {
    throw new Error(
      'jsdom is required to run axe-core against HTML strings. Install it as a dependency (e.g., `pnpm add jsdom`).',
      { cause: error },
    );
  }
  const axe = await import('axe-core');

  const dom = new JSDOM(html, { url: 'https://example.com' });
  const { window } = dom;

  // Inject axe into the jsdom window.
  window.eval(axe.source);

  const options = buildAxeRunOptions(config);
  const context = buildAxeRunContext(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.axe) throw new Error('axe not initialized in jsdom');

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return (await w.axe.run(context ?? window.document, options)) as AxeResults;
}

function buildAxeRunOptions(config: AxeRunConfig) {
  const options: Record<string, unknown> = {};

  if (config.standard) {
    options.runOnly = { type: 'tag', values: [config.standard] };
  }

  if (config.rules) {
    options.rules = config.rules;
  }

  if (typeof config.timeout === 'number') {
    options.timeout = config.timeout;
  }

  return options;
}

function buildAxeRunContext(config: AxeRunConfig) {
  const include = (config.include ?? []).filter(Boolean).map((s) => [s]);
  const exclude = (config.exclude ?? []).filter(Boolean).map((s) => [s]);

  if (include.length === 0 && exclude.length === 0) return null;
  return { include: include.length ? include : undefined, exclude: exclude.length ? exclude : undefined };
}
