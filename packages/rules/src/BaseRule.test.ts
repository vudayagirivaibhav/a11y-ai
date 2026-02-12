import { describe, expect, it } from 'vitest';

import type { AIAnalysisResult, AIProvider } from 'a11y-ai';

import { BaseRule } from './BaseRule.js';

import type { RuleContext, RuleResult } from './types.js';

describe('BaseRule', () => {
  it('builds a structured prompt containing elements and output schema', () => {
    class TestRule extends BaseRule {
      constructor() {
        super({
          id: 'test/rule',
          category: 'structure',
          description: 'test',
        });
      }

      async evaluate(): Promise<RuleResult[]> {
        return [];
      }

      public buildForTest() {
        return this.buildPrompt({
          instruction: 'Return findings.',
          elements: [
            {
              selector: '#a',
              html: '<img id="a" alt="x" />',
              tagName: 'img',
              attributes: { id: 'a', alt: 'x' },
              textContent: '',
            },
          ],
          outputSchema: { type: 'object', properties: { findings: { type: 'array' } } },
        });
      }
    }

    const rule = new TestRule();
    const prompt = rule.buildForTest();

    expect(prompt).toContain('"elements"');
    expect(prompt).toContain('#a');
    expect(prompt).toContain('"output"');
    expect(prompt).toContain('"findings"');
  });

  it('parses JSON response with fenced code blocks', () => {
    class TestRule extends BaseRule {
      constructor() {
        super({ id: 'test/rule', category: 'structure', description: 'test' });
      }
      async evaluate(): Promise<RuleResult[]> {
        return [];
      }
      public parse(raw: string) {
        return this.parseAIResponse(raw);
      }
    }

    const rule = new TestRule();
    const findings = rule.parse('```json\n{"findings":[{"ruleId":"x"}]}\n```');
    expect(findings.length).toBe(1);
    expect((findings[0] as { ruleId: string }).ruleId).toBe('x');
  });
});

// Ensure we can typecheck contexts without pulling in heavy fixtures.
const _provider: AIProvider = {
  async analyze(): Promise<AIAnalysisResult> {
    return { findings: [], raw: '{}', latencyMs: 0, attempts: 1 };
  },
};

const _context: RuleContext = {
  url: 'https://example.com',
  ruleId: 'test/rule' as unknown as RuleContext['ruleId'],
  extraction: {
    url: 'https://example.com',
    images: [],
    links: [],
    forms: [],
    headings: [],
    ariaElements: [],
    pageTitle: '',
    pageLanguage: null,
    metaDescription: null,
    documentOutline: [],
    rawHTML: '',
  },
  config: {},
};

