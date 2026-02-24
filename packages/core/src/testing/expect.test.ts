import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { auditHTML } from '../api.js';
import { expect as a11yExpect } from './expect.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', 'extraction', '__fixtures__', 'basic.html');

describe('@a11y-ai/core/testing', () => {
  it('provides assertion helpers', async () => {
    const html = readFileSync(fixturePath, 'utf8');
    const result = await auditHTML(html, {
      preset: 'quick',
      provider: {
        name: 'custom',
        handler: async () => ({ content: JSON.stringify({ results: [] }) }),
      },
    });

    a11yExpect(result).toPassAccessibility({ min: 0 });

    expect(() => a11yExpect(result).toHaveNoViolations('critical')).toThrow();
    expect(() => a11yExpect(result).toHaveNoCategoryIssues('non-existent-category')).not.toThrow();
  });
});
