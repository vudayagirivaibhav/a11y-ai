import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AxeRunner } from './AxeRunner.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '__fixtures__', 'violations.html');

describe('AxeRunner (jsdom)', () => {
  it('detects common accessibility violations', async () => {
    const html = readFileSync(fixturePath, 'utf8');
    const runner = new AxeRunner();
    const violations = await runner.run(html);

    const ids = new Set(violations.map((v) => v.id));
    expect(ids.has('image-alt')).toBe(true);
    expect(ids.has('link-name')).toBe(true);
    expect(ids.has('label')).toBe(true);
  });
});

