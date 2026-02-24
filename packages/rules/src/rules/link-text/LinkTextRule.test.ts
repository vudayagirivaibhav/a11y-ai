import { describe, expect, it } from 'vitest';

import type {
  AIAnalysisResult,
  AIProvider,
  ExtractionResult,
  LinkElement,
} from '@a11y-ai/core/types';

import { LinkTextRule } from './LinkTextRule.js';

import type { RuleContext } from '../../types.js';

function baseExtraction(links: LinkElement[], rawHTML = '<html></html>'): ExtractionResult {
  return {
    url: 'https://example.com',
    images: [],
    links,
    forms: [],
    headings: [],
    ariaElements: [],
    pageTitle: 'Example',
    pageLanguage: 'en',
    metaDescription: null,
    documentOutline: [],
    rawHTML,
  };
}

function link(partial: Partial<LinkElement> & Pick<LinkElement, 'selector'>): LinkElement {
  return {
    selector: partial.selector,
    href: partial.href ?? null,
    html: partial.html ?? `<a href="${partial.href ?? '#'}">${partial.textContent ?? ''}</a>`,
    tagName: 'a',
    attributes: partial.attributes ?? {},
    textContent: partial.textContent ?? '',
    computedStyle: partial.computedStyle,
    boundingBox: partial.boundingBox,
  };
}

describe('LinkTextRule', () => {
  it('flags empty links', async () => {
    const rule = new LinkTextRule();
    const extraction = baseExtraction([link({ selector: '#a', href: '/x', textContent: '' })]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id,
      extraction,
      config: {},
    };
    const results = await rule.evaluate(ctx, provider);
    expect(results.some((r) => r.message.toLowerCase().includes('no accessible text'))).toBe(true);
  });

  it('flags generic link text', async () => {
    const rule = new LinkTextRule();
    const extraction = baseExtraction([
      link({ selector: '#a', href: '/x', textContent: 'Click here' }),
    ]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id,
      extraction,
      config: {},
    };
    const results = await rule.evaluate(ctx, provider);
    expect(results.some((r) => r.message.toLowerCase().includes('generic'))).toBe(true);
  });

  it('flags duplicate link text for different destinations', async () => {
    const rule = new LinkTextRule();
    const extraction = baseExtraction([
      link({ selector: '#a1', href: '/one', textContent: 'Docs' }),
      link({ selector: '#a2', href: '/two', textContent: 'Docs' }),
    ]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id,
      extraction,
      config: {},
    };
    const results = await rule.evaluate(ctx, provider);
    expect(results.filter((r) => r.message.toLowerCase().includes('multiple links')).length).toBe(
      2,
    );
  });
});
