import { describe, expect, it } from 'vitest';

import type {
  AIAnalysisResult,
  AIProvider,
  ExtractionResult,
  FormElement,
  FormFieldElement,
} from '@a11y-ai/core/types';

import { FormLabelRule } from './FormLabelRule.js';

import type { RuleContext } from '../../types.js';

function field(
  partial: Partial<FormFieldElement> & Pick<FormFieldElement, 'selector'>,
): FormFieldElement {
  return {
    selector: partial.selector,
    html: partial.html ?? '<input />',
    tagName: partial.tagName ?? 'input',
    attributes: partial.attributes ?? {},
    textContent: '',
    id: partial.id ?? null,
    name: partial.name ?? null,
    type: partial.type ?? 'text',
    placeholder: partial.placeholder ?? null,
    title: partial.title ?? null,
    required: partial.required ?? false,
    autocomplete: partial.autocomplete ?? null,
    labelText: partial.labelText ?? null,
    ariaLabel: partial.ariaLabel ?? null,
    ariaLabelledBy: partial.ariaLabelledBy ?? null,
    computedStyle: partial.computedStyle,
    boundingBox: partial.boundingBox,
  };
}

function form(fields: FormFieldElement[]): FormElement {
  return {
    selector: '#form',
    html: '<form></form>',
    tagName: 'form',
    attributes: {},
    textContent: '',
    fields,
  };
}

function extraction(forms: FormElement[], rawHTML: string): ExtractionResult {
  return {
    url: 'https://example.com',
    images: [],
    links: [],
    forms,
    headings: [],
    ariaElements: [],
    pageTitle: 'Example',
    pageLanguage: 'en',
    metaDescription: null,
    documentOutline: [],
    rawHTML,
  };
}

describe('FormLabelRule', () => {
  it('flags missing accessible label', async () => {
    const rule = new FormLabelRule();
    const extractionResult = extraction(
      [form([field({ selector: '#f1', id: 'x', labelText: null })])],
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
    expect(
      results.some((r) => r.message.toLowerCase().includes('missing an accessible label')),
    ).toBe(true);
  });

  it('flags duplicate ids', async () => {
    const rule = new FormLabelRule();
    const rawHTML = '<input id="dup" /><input id="dup" />';
    const extractionResult = extraction(
      [form([field({ selector: '#f1', id: 'dup', labelText: 'Name' })])],
      rawHTML,
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
    expect(results.some((r) => r.message.toLowerCase().includes('duplicate id'))).toBe(true);
  });
});
