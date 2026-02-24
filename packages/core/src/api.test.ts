import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { a11yAI, auditAxeOnly, auditHTML } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'extraction', '__fixtures__', 'basic.html');

describe('Programmatic API', () => {
  it('audits HTML via one-liner API', async () => {
    const html = readFileSync(fixturePath, 'utf8');
    const result = await auditHTML(html, {
      preset: 'quick',
      provider: {
        name: 'custom',
        handler: async () => ({ content: JSON.stringify({ results: [] }) }),
      },
    });

    expect(result.url).toBe('about:blank');
    expect(result.extraction.images.length).toBeGreaterThan(0);
    expect(result.summary.score).toBeGreaterThanOrEqual(0);
  });

  it('audits HTML via builder API', async () => {
    const html = readFileSync(fixturePath, 'utf8');
    const result = await a11yAI()
      .html(html)
      .preset('quick')
      .provider('custom', { handler: async () => ({ content: JSON.stringify({ results: [] }) }) })
      .run();

    expect(result.summary.score).toBeGreaterThanOrEqual(0);
  });

  it('runs axe-only audit without provider config', async () => {
    const html = readFileSync(fixturePath, 'utf8');
    const violations = await auditAxeOnly(html);
    expect(Array.isArray(violations)).toBe(true);
  });
});
