import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DOMExtractor } from './DOMExtractor.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '__fixtures__', 'basic.html');

describe('DOMExtractor (html)', () => {
  it('extracts images/links/forms/headings/aria and page metadata', async () => {
    const html = readFileSync(fixturePath, 'utf8');
    const extractor = new DOMExtractor({ html });

    const result = await extractor.extractAll();

    expect(result.url).toBeNull();
    expect(result.pageTitle).toBe('Fixture Page');
    expect(result.pageLanguage).toBe('en');
    expect(result.metaDescription).toContain('fixture page');

    expect(result.images.length).toBe(3);
    expect(result.images.find((i) => i.selector.includes('#logo'))?.alt).toBe('Company logo');
    expect(result.images.find((i) => i.src.includes('missing-alt'))?.hasAlt).toBe(false);

    expect(result.links.length).toBe(3);
    expect(result.links.some((l) => l.textContent === 'Documentation')).toBe(true);

    expect(result.forms.length).toBe(1);
    expect(result.forms[0]?.fields.length).toBeGreaterThan(0);
    expect(result.forms[0]?.fields.find((f) => f.name === 'email')?.labelText).toBe('Email');
    expect(result.forms[0]?.fields.find((f) => f.name === 'unlabeled')?.labelText).toBeNull();
    expect(result.forms[0]?.fields.find((f) => f.name === 'aria')?.ariaLabel).toBe('Search');

    expect(result.headings.length).toBe(3);
    expect(result.documentOutline.length).toBe(1);
    expect(result.documentOutline[0]?.level).toBe(1);
    expect(result.documentOutline[0]?.children[0]?.level).toBe(2);

    expect(result.ariaElements.length).toBeGreaterThan(0);
    expect(result.rawHTML.length).toBeGreaterThan(0);
  });
});

