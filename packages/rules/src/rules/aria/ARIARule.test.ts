import { describe, expect, it } from 'vitest';

import type {
  AIAnalysisResult,
  AIProvider,
  ElementSnapshot,
  ExtractionResult,
} from '@a11y-ai/core/types';

import { ARIARule } from './ARIARule.js';

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

function extraction(ariaElements: ElementSnapshot[], rawHTML: string): ExtractionResult {
  return {
    url: 'https://example.com',
    images: [],
    links: [],
    forms: [],
    headings: [],
    ariaElements,
    pageTitle: 'Example',
    pageLanguage: 'en',
    metaDescription: null,
    documentOutline: [],
    rawHTML,
  };
}

describe('ARIARule', () => {
  it('flags invalid aria attributes', async () => {
    const rule = new ARIARule();
    const extractionResult = extraction(
      [el('#x', 'div', { 'aria-not-real': '1' })],
      '<html></html>',
    );

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extractionResult.url ?? 'about:blank',
      ruleId: rule.id,
      extraction: extractionResult,
      config: {},
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.some((r) => r.message.toLowerCase().includes('invalid aria attribute'))).toBe(
      true,
    );
  });

  it('flags aria-labelledby pointing to missing ids', async () => {
    const rule = new ARIARule();
    const extractionResult = extraction(
      [el('#x', 'div', { role: 'button', 'aria-labelledby': 'missing' })],
      '<div />',
    );

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extractionResult.url ?? 'about:blank',
      ruleId: rule.id,
      extraction: extractionResult,
      config: {},
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.some((r) => r.message.includes('aria-labelledby references missing'))).toBe(
      true,
    );
  });
});
