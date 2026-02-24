import { describe, expect, it } from 'vitest';

import type { AIAnalysisResult, AIProvider, ExtractionResult } from '@a11y-ai/core/types';

import { LanguageRule } from './LanguageRule.js';

import type { RuleContext } from '../../types.js';

function extraction(pageLanguage: string | null, rawHTML: string): ExtractionResult {
  return {
    url: 'https://example.com',
    images: [],
    links: [],
    forms: [],
    headings: [],
    ariaElements: [],
    pageTitle: 'Example',
    pageLanguage,
    metaDescription: null,
    documentOutline: [],
    rawHTML,
  };
}

describe('LanguageRule', () => {
  it('flags missing lang', async () => {
    const rule = new LanguageRule();
    const extractionResult = extraction(null, '<html><body>Hello</body></html>');

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return {
          findings: [],
          raw: '{"issues":[],"suggestions":[],"confidence":0.5}',
          latencyMs: 1,
          attempts: 1,
        };
      },
    };

    const ctx: RuleContext = {
      url: extractionResult.url ?? 'about:blank',
      ruleId: rule.id,
      extraction: extractionResult,
      config: {},
    };
    const results = await rule.evaluate(ctx, provider);
    expect(results.some((r) => r.context?.reason === 'missing-lang')).toBe(true);
  });

  it('flags invalid lang', async () => {
    const rule = new LanguageRule();
    const extractionResult = extraction('en_US', '<html lang="en_US"><body>Hello</body></html>');

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return {
          findings: [],
          raw: '{"issues":[],"suggestions":[],"confidence":0.5}',
          latencyMs: 1,
          attempts: 1,
        };
      },
    };

    const ctx: RuleContext = {
      url: extractionResult.url ?? 'about:blank',
      ruleId: rule.id,
      extraction: extractionResult,
      config: {},
    };
    const results = await rule.evaluate(ctx, provider);
    expect(results.some((r) => r.context?.reason === 'invalid-lang')).toBe(true);
  });
});
