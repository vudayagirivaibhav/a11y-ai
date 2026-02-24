import { describe, expect, it } from 'vitest';

import type { AIAnalysisResult, AIProvider, ExtractionResult } from '@a11y-ai/core/types';

import { MediaRule } from './MediaRule.js';

import type { RuleContext } from '../../types.js';

function extraction(rawHTML: string): ExtractionResult {
  return {
    url: 'https://example.com',
    images: [],
    links: [],
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

describe('MediaRule', () => {
  it('flags video without captions track', async () => {
    const rule = new MediaRule();
    const extractionResult = extraction('<video controls></video>');

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
    expect(results.some((r) => r.message.toLowerCase().includes('captions'))).toBe(true);
  });
});
