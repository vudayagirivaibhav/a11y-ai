import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { A11yAuditor } from './A11yAuditor.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', 'extraction', '__fixtures__', 'basic.html');

describe('A11yAuditor (integration)', () => {
  it('runs the full pipeline on fixture HTML and emits progress events', async () => {
    const html = readFileSync(fixturePath, 'utf8');

    const events: string[] = [];
    const auditor = new A11yAuditor({
      aiProvider: {
        provider: 'custom',
        customHandler: async () => ({
          // For AltTextRule: return "good" for any images in the batch.
          content: JSON.stringify({
            results: [],
          }),
        }),
      },
      parallelism: 2,
      ruleTimeoutMs: 10_000,
      overallTimeoutMs: 60_000,
      cacheEnabled: false,
    });

    auditor.on('start', () => events.push('start'));
    auditor.on('axe:complete', () => events.push('axe:complete'));
    auditor.on('rule:start', () => events.push('rule:start'));
    auditor.on('rule:complete', () => events.push('rule:complete'));
    auditor.on('complete', () => events.push('complete'));

    const result = await auditor.auditHTML(html);

    expect(result.extraction.images.length).toBeGreaterThan(0);
    expect(Array.isArray(result.axeViolations)).toBe(true);
    expect(result.ruleResults.length).toBeGreaterThanOrEqual(0);
    expect(result.mergedViolations.length).toBeGreaterThan(0);
    expect(result.summary.score).toBeGreaterThanOrEqual(0);
    expect(result.metadata.schemaVersion).toBe('1.0');

    expect(events[0]).toBe('start');
    expect(events).toContain('axe:complete');
    expect(events).toContain('rule:start');
    expect(events).toContain('rule:complete');
    expect(events[events.length - 1]).toBe('complete');
  });
});
