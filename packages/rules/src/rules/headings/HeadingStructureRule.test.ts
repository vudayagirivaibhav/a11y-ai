import { describe, expect, it } from 'vitest';

import type {
  AIAnalysisResult,
  AIProvider,
  ElementSnapshot,
  ExtractionResult,
} from '@a11y-ai/core/types';

import { HeadingStructureRule } from './HeadingStructureRule.js';

import type { RuleContext } from '../../types.js';

function heading(selector: string, tagName: string, textContent: string): ElementSnapshot {
  return {
    selector,
    html: `<${tagName}>${textContent}</${tagName}>`,
    tagName,
    attributes: {},
    textContent,
  };
}

function extraction(headings: ElementSnapshot[]): ExtractionResult {
  return {
    url: 'https://example.com',
    images: [],
    links: [],
    forms: [],
    headings,
    ariaElements: [],
    pageTitle: 'Example',
    pageLanguage: 'en',
    metaDescription: null,
    documentOutline: [],
    rawHTML: '<html></html>',
  };
}

describe('HeadingStructureRule', () => {
  it('flags missing h1', async () => {
    const rule = new HeadingStructureRule();
    const extractionResult = extraction([heading('#h2', 'h2', 'Section')]);

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
    expect(results.some((r) => r.context?.reason === 'missing-h1')).toBe(true);
  });

  it('flags skipped heading levels', async () => {
    const rule = new HeadingStructureRule();
    const extractionResult = extraction([heading('#h2', 'h2', 'A'), heading('#h4', 'h4', 'B')]);

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
    expect(results.some((r) => r.context?.reason === 'skipped-level')).toBe(true);
  });
});
