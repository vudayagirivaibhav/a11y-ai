import type { AxeResults, ElementContext, RunOptions } from 'axe-core';

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

    await page.addScriptTag({ content: axe.source });

    const options = buildAxeRunOptions(config);
    const context = buildAxeRunContext(config);

    const results = (await page.evaluate(
      async ({ context, options }: { context: unknown; options: unknown }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (!w.axe) throw new Error('axe not found on page');
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

  // `runScripts: "dangerously"` is required so we can inject/execute `axe.source`.
  const dom = new JSDOM(html, { url: 'https://example.com', runScripts: 'dangerously' });
  const { window } = dom;

  // axe-core may probe canvas APIs; jsdom throws unless `canvas` is installed.
  // Stubbing prevents noisy "Not implemented" errors without impacting most rules.
  if (window.HTMLCanvasElement?.prototype) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.HTMLCanvasElement.prototype as any).getContext = (): null => null;
  }

  // Inject axe into the jsdom window.
  window.eval(axe.source);

  const options = buildAxeRunOptions(config);
  const context = buildAxeRunContext(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.axe) throw new Error('axe not initialized in jsdom');

  return (await w.axe.run(context ?? window.document, options)) as AxeResults;
}

type AxeRunOptions = RunOptions & { timeout?: number };

function buildAxeRunOptions(config: AxeRunConfig): AxeRunOptions {
  const options: AxeRunOptions = {};

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

function buildAxeRunContext(config: AxeRunConfig): ElementContext | null {
  const include = (config.include ?? []).filter(Boolean).map((s) => [s]);
  const exclude = (config.exclude ?? []).filter(Boolean).map((s) => [s]);

  if (include.length === 0 && exclude.length === 0) return null;
  if (include.length === 0) return { exclude };
  if (exclude.length === 0) return { include };
  return { include, exclude };
}
