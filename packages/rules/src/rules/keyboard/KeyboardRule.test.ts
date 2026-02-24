import { describe, expect, it } from 'vitest';

import type {
  AIAnalysisResult,
  AIProvider,
  ElementSnapshot,
  ExtractionResult,
} from '@a11y-ai/core/types';

import { KeyboardRule } from './KeyboardRule.js';

import type { RuleContext } from '../../types.js';

function el(
  selector: string,
  tagName: string,
  attributes: Record<string, string>,
): ElementSnapshot {
  return {
    selector,
    html: `<${tagName}></${tagName}>`,
    tagName,
    attributes,
    textContent: '',
  };
}

function extraction(elements: ElementSnapshot[]): ExtractionResult {
  return {
    url: 'https://example.com',
    images: [],
    links: [],
    forms: [],
    headings: [],
    ariaElements: elements,
    pageTitle: 'Example',
    pageLanguage: 'en',
    metaDescription: null,
    documentOutline: [],
    rawHTML: '<html></html>',
  };
}

describe('KeyboardRule', () => {
  it('flags positive tabindex', async () => {
    const rule = new KeyboardRule();
    const extractionResult = extraction([el('#x', 'div', { tabindex: '5', role: 'button' })]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extractionResult.url ?? 'about:blank',
      ruleId: rule.id,
      extraction: extractionResult,
      config: {},
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.some((r) => r.message.toLowerCase().includes('positive tabindex'))).toBe(true);
  });

  it('flags onclick on non-interactive element', async () => {
    const rule = new KeyboardRule();
    const extractionResult = extraction([el('#x', 'div', { onclick: 'doThing()' })]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extractionResult.url ?? 'about:blank',
      ruleId: rule.id,
      extraction: extractionResult,
      config: {},
    };

    const results = await rule.evaluate(ctx, provider);
    expect(
      results.some((r) =>
        r.message.toLowerCase().includes('non-interactive element has a click handler'),
      ),
    ).toBe(true);
  });
});
