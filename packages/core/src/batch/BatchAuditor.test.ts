import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BatchAuditor } from './BatchAuditor.js';
import { toAuditConfig } from '../api.js';

const here = dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(join(here, '__fixtures__', name), 'utf8');
}

describe('BatchAuditor', () => {
  it('audits multiple targets and produces an aggregate summary', async () => {
    const config = toAuditConfig({
      preset: 'quick',
      provider: {
        name: 'custom',
        handler: async () => ({ content: JSON.stringify({ findings: [] }) }),
      },
    });

    const batch = new BatchAuditor(config);
    const result = await batch.audit([
      fixture('page1.html'),
      fixture('page2.html'),
      fixture('page3.html'),
    ]);

    expect(result.pages).toHaveLength(3);
    expect(result.summary.totalPages).toBe(3);
    expect(result.summary.succeeded).toBeGreaterThan(0);
    expect(result.summary.averageScore).toBeGreaterThanOrEqual(0);
    expect(result.summary.averageScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.summary.mostCommonIssues)).toBe(true);
  });
});
