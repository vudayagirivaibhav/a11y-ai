import { describe, expect, it } from 'vitest';

import type {
  AIAnalysisResult,
  AIProvider,
  ElementSnapshot,
  ExtractionResult,
} from '@a11y-ai/core/types';

import { ContrastRule } from './ContrastRule.js';

import type { RuleContext } from '../../types.js';

function snap(
  selector: string,
  text: string,
  color: string,
  backgroundColor: string,
  fontSize = '16px',
): ElementSnapshot {
  return {
    selector,
    html: `<div>${text}</div>`,
    tagName: 'div',
    attributes: {},
    textContent: text,
    computedStyle: {
      color,
      backgroundColor,
      fontSize,
      display: 'block',
      visibility: 'visible',
      opacity: '1',
    },
  };
}

function baseExtraction(elements: ElementSnapshot[]): ExtractionResult {
  return {
    url: 'https://example.com',
    images: [],
    links: [],
    forms: [],
    headings: elements,
    ariaElements: [],
    pageTitle: 'Example',
    pageLanguage: 'en',
    metaDescription: null,
    documentOutline: [],
    rawHTML: '<html></html>',
  };
}

describe('ContrastRule', () => {
  it('flags low contrast text', async () => {
    const rule = new ContrastRule();
    const extraction = baseExtraction([snap('#t', 'Hello', '#777777', '#ffffff')]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id,
      extraction,
      config: { rules: { [rule.id]: { settings: { standard: 'AA' } } } },
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.length).toBe(1);
    expect(results[0]!.message.toLowerCase()).toContain('contrast');
  });

  it('does not flag high contrast text', async () => {
    const rule = new ContrastRule();
    const extraction = baseExtraction([snap('#t', 'Hello', '#000000', '#ffffff')]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id,
      extraction,
      config: {},
    };
    const results = await rule.evaluate(ctx, provider);
    expect(results.length).toBe(0);
  });
});
