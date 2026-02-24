import { describe, expect, it } from 'vitest';

import type { AIAnalysisResult, AIProvider, ExtractionResult } from '@a11y-ai/core/types';

import { RuleRegistry } from './RuleRegistry.js';
import { runRules } from './aggregator.js';

import type { Rule, RuleContext, RuleResult } from './types.js';

const extraction: ExtractionResult = {
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
  rawHTML: '<html></html>',
};

const provider: AIProvider = {
  async analyze(): Promise<AIAnalysisResult> {
    return { findings: [], raw: '{}', latencyMs: 1, attempts: 1 };
  },
};

describe('runRules', () => {
  it('runs rules and collects results even when one rule fails', async () => {
    const registry = RuleRegistry.create();

    const okRule: Rule = {
      id: 'test/ok',
      category: 'structure',
      description: 'ok',
      severity: 'minor',
      async evaluate(_ctx: RuleContext): Promise<RuleResult[]> {
        return [
          {
            ruleId: 'test/ok',
            category: 'structure',
            severity: 'minor',
            element: {
              selector: '#x',
              html: '<div id="x"></div>',
              tagName: 'div',
              attributes: { id: 'x' },
              textContent: '',
            },
            message: 'ok',
            suggestion: 'ok',
            confidence: 1,
            source: 'static',
          },
        ];
      },
    };

    const badRule: Rule = {
      id: 'test/bad',
      category: 'structure',
      description: 'bad',
      severity: 'minor',
      async evaluate(): Promise<RuleResult[]> {
        throw new Error('boom');
      },
    };

    registry.register(okRule);
    registry.register(badRule);

    const result = await runRules({ extraction, provider, registry, config: { parallelism: 2 } });

    expect(result.results.length).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]?.ruleId).toBe('test/bad');
  });
});
