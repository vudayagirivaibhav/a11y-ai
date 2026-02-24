import { describe, expect, it } from 'vitest';

import type {
  AIAnalysisResult,
  AIProvider,
  ExtractionResult,
  ImageElement,
} from '@a11y-ai/core/types';

import { AltTextRule } from './AltTextRule.js';

import type { RuleContext } from '../../types.js';

function baseExtraction(images: ImageElement[]): ExtractionResult {
  return {
    url: 'https://example.com',
    images,
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
}

function img(
  partial: Partial<ImageElement> & Pick<ImageElement, 'selector' | 'src'>,
): ImageElement {
  return {
    selector: partial.selector,
    src: partial.src,
    alt: partial.alt ?? null,
    hasAlt: partial.hasAlt ?? partial.alt !== null,
    html: partial.html ?? `<img src="${partial.src}">`,
    tagName: 'img',
    attributes: partial.attributes ?? {},
    textContent: '',
    computedStyle: partial.computedStyle,
    boundingBox: partial.boundingBox,
  };
}

describe('AltTextRule', () => {
  it('flags missing alt attribute', async () => {
    const rule = new AltTextRule();
    const extraction = baseExtraction([
      img({ selector: '#missing', src: '/a.png', alt: null, hasAlt: false }),
    ]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id as unknown as RuleContext['ruleId'],
      extraction,
      config: {},
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.length).toBe(1);
    expect(results[0]?.source).toBe('static');
    expect(results[0]?.message).toContain('missing');
  });

  it('does not flag empty alt when likely decorative', async () => {
    const rule = new AltTextRule();
    const extraction = baseExtraction([
      img({
        selector: '#decor',
        src: '/spacer.png',
        alt: '',
        hasAlt: true,
        attributes: { 'aria-hidden': 'true' },
      }),
    ]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id as unknown as RuleContext['ruleId'],
      extraction,
      config: {},
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.length).toBe(0);
  });

  it('flags empty alt when not decorative', async () => {
    const rule = new AltTextRule();
    const extraction = baseExtraction([
      img({
        selector: '#hero',
        src: '/product.png',
        alt: '',
        hasAlt: true,
        boundingBox: { x: 0, y: 0, width: 200, height: 200 },
      }),
    ]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id as unknown as RuleContext['ruleId'],
      extraction,
      config: {},
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.length).toBe(1);
    expect(results[0]?.context?.reason).toBe('empty-alt-not-decorative');
  });

  it('batches AI calls (default batch size 10)', async () => {
    const rule = new AltTextRule();

    const images = Array.from({ length: 12 }, (_, i) =>
      img({
        selector: `#img${i}`,
        src: `/img${i}.png`,
        alt: `Alt ${i}`,
        hasAlt: true,
      }),
    );

    const extraction = baseExtraction(images);

    const provider: AIProvider & { calls: number } = {
      calls: 0,
      async analyze(prompt): Promise<AIAnalysisResult> {
        this.calls++;
        const json = prompt.split('\n\n# tokenEstimate:')[0]!;
        const payload = JSON.parse(json) as { elements: Array<{ selector: string }> };
        const selectors = payload.elements.map((e) => e.selector);

        return {
          findings: [],
          raw: JSON.stringify({
            results: selectors.map((selector) => ({
              element: selector,
              currentAlt: 'Alt',
              quality: 'needs-improvement',
              issues: ['too generic'],
              suggestedAlt: 'Better alt',
              confidence: 0.7,
            })),
          }),
          latencyMs: 1,
          attempts: 1,
        };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id as unknown as RuleContext['ruleId'],
      extraction,
      config: {},
    };

    const results = await rule.evaluate(ctx, provider);
    expect(provider.calls).toBe(2);
    expect(results.filter((r) => r.source === 'ai').length).toBe(12);
  });

  it('runs vision analysis when enabled and provider supports it', async () => {
    const rule = new AltTextRule();
    const dataUrl = 'data:image/png;base64,YQ=='; // 1 byte

    const extraction = baseExtraction([
      img({
        selector: '#v1',
        src: dataUrl,
        alt: 'image.png', // triggers suspicious static finding => becomes a vision candidate
        hasAlt: true,
      }),
    ]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
      async analyzeImage(): Promise<AIAnalysisResult> {
        return {
          findings: [],
          raw: JSON.stringify({
            element: '#v1',
            imageDescription: 'A logo',
            altTextAccuracy: 'inaccurate',
            suggestedAlt: 'Company logo',
            confidence: 0.9,
          }),
          latencyMs: 2,
          attempts: 1,
        };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id as unknown as RuleContext['ruleId'],
      extraction,
      config: { vision: true, maxVisionImages: 5 },
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.some((r) => r.context?.vision === true)).toBe(true);
  });

  it('does not fail when vision is enabled but provider does not support it', async () => {
    const rule = new AltTextRule();
    const dataUrl = 'data:image/png;base64,YQ==';

    const extraction = baseExtraction([
      img({
        selector: '#v2',
        src: dataUrl,
        alt: 'image.png',
        hasAlt: true,
      }),
    ]);

    const provider: AIProvider = {
      async analyze(): Promise<AIAnalysisResult> {
        return { findings: [], raw: '{"results":[]}', latencyMs: 1, attempts: 1 };
      },
    };

    const ctx: RuleContext = {
      url: extraction.url ?? 'about:blank',
      ruleId: rule.id as unknown as RuleContext['ruleId'],
      extraction,
      config: { vision: true },
    };

    const results = await rule.evaluate(ctx, provider);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.context?.vision === true)).toBe(false);
  });
});
