import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DOMExtractor } from './DOMExtractor.js';
import { buildRuleContext } from './context.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '__fixtures__', 'basic.html');

describe('buildRuleContext', () => {
  it('builds a trimmed RuleContext with prioritized sections', async () => {
    const html = readFileSync(fixturePath, 'utf8');
    const extractor = new DOMExtractor({ html }, { maxRawHtmlLength: 50_000 });
    const extraction = await extractor.extractAll();

    const focus = extraction.images[0]!;
    const ctx = buildRuleContext(extraction, {
      ruleId: 'alt-text-quality',
      element: focus,
      activeRules: ['alt-text-quality', 'link-text-quality'],
      maxTokens: 200,
    });

    expect(ctx.url).toBe('about:blank');
    expect(ctx.ruleId).toBe('alt-text-quality');
    expect(ctx.element?.tagName).toBe('img');
    expect(ctx.html?.includes('# Images')).toBe(true);
    expect(ctx.html?.includes('# Links')).toBe(true);
    expect((ctx.html ?? '').length).toBeLessThanOrEqual(200 * 4 + 2);
  });
});

