import type { AIProvider, ElementSnapshot } from '@a11y-ai/core/types';
import { type RGBA, calculateContrastRatio, parseColor } from '@a11y-ai/core/utils';

import { BaseRule } from '../../BaseRule.js';
import { ContrastAIResponseSchema } from '../../schemas.js';
import type { RuleContext, RuleResult } from '../../types.js';

function parsePx(value: string): number | null {
  const m = value.trim().match(/^([0-9.]+)px$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function isEffectivelyVisible(el: ElementSnapshot): boolean {
  const s = el.computedStyle;
  if (!s) return true;
  if (s.display === 'none') return false;
  if (s.visibility === 'hidden') return false;
  const opacity = Number(s.opacity);
  if (Number.isFinite(opacity) && opacity <= 0) return false;
  return true;
}

function isBold(fontWeight: string | undefined): boolean {
  if (!fontWeight) return false;
  const weight = Number(fontWeight);
  if (Number.isFinite(weight)) return weight >= 700;
  return fontWeight === 'bold' || fontWeight === 'bolder';
}

function contrastRequirement(
  fontSizePx: number,
  fontWeight: string | undefined,
  standard: 'AA' | 'AAA',
): number {
  const bold = isBold(fontWeight);
  const isLarge = fontSizePx >= 18 || (bold && fontSizePx >= 14);
  if (standard === 'AAA') return isLarge ? 4.5 : 7;
  return isLarge ? 3 : 4.5;
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function suggestTextColor(bg: { r: number; g: number; b: number }): string {
  // Simple luminance heuristic: prefer white on dark backgrounds and black on light.
  const luminance = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
  return luminance < 128 ? '#ffffff' : '#000000';
}

/**
 * Contrast rule with static checks and AI analysis for complex backgrounds.
 *
 * Static checks compute contrast from extracted computed styles.
 * AI analysis handles gradients, images, and transparency.
 */
export class ContrastRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/contrast-analysis',
      category: 'contrast',
      description: 'Checks text color contrast against computed background colors.',
      severity: 'moderate',
      requiresAI: true,
      estimatedCost: '1 request per batch of complex elements',
    });
  }

  async evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const standard = String(settings?.standard ?? 'AA').toUpperCase() === 'AAA' ? 'AAA' : 'AA';
    const aiEnabled = settings?.aiEnabled !== false;

    const candidates: ElementSnapshot[] = [
      ...context.extraction.headings,
      ...context.extraction.links,
      ...context.extraction.ariaElements,
    ].filter((e) => e.textContent.trim().length > 0);

    const out: RuleResult[] = [];
    const complexElements: ElementSnapshot[] = [];

    for (const el of candidates) {
      if (!isEffectivelyVisible(el)) continue;
      if (!el.computedStyle) continue;

      const fg = parseColor(el.computedStyle.color);
      const bg = parseColor(el.computedStyle.backgroundColor);

      if (!fg || !bg) {
        out.push(
          this.makeResult(el, {
            severity: 'minor',
            source: 'static',
            message: 'Unable to compute contrast due to unsupported color format.',
            suggestion: 'Manually verify contrast, especially if gradients or images are involved.',
            confidence: 0.4,
            context: {
              color: el.computedStyle.color,
              backgroundColor: el.computedStyle.backgroundColor,
            },
          }),
        );
        continue;
      }

      if (bg.a === 0) {
        const resolvedBg = this.resolveParentBackground(el, context);
        if (resolvedBg) {
          const fontSizePx = parsePx(el.computedStyle.fontSize) ?? 16;
          const fontWeight = el.computedStyle.fontWeight;
          const required = contrastRequirement(fontSizePx, fontWeight, standard);
          const ratio = calculateContrastRatio(fg, resolvedBg);

          if (ratio < required) {
            out.push(
              this.makeResult(el, {
                severity: ratio < required / 2 ? 'serious' : 'moderate',
                source: 'static',
                message: `Text contrast is too low (${ratio.toFixed(2)}:1 against resolved parent background, requires ≥ ${required}:1).`,
                suggestion: `Adjust the text or background color to meet WCAG ${standard}.`,
                confidence: 0.65,
                context: {
                  ratio,
                  required,
                  resolvedFromParent: true,
                  color: el.computedStyle.color,
                  backgroundColor: el.computedStyle.backgroundColor,
                },
              }),
            );
          }
          continue;
        }

        complexElements.push(el);
        continue;
      }

      const fontSizePx = parsePx(el.computedStyle.fontSize) ?? 16;
      const fontWeight = el.computedStyle.fontWeight;
      const required = contrastRequirement(fontSizePx, fontWeight, standard);
      const ratio = calculateContrastRatio(fg, bg);

      if (ratio >= required) continue;

      const suggested = suggestTextColor(bg);

      out.push(
        this.makeResult(el, {
          severity: ratio < required / 2 ? 'serious' : 'moderate',
          source: 'static',
          message: `Text contrast is too low (${ratio.toFixed(2)}:1, requires ≥ ${required}:1).`,
          suggestion:
            `Adjust the text or background color to meet WCAG ${standard}. ` +
            `A common fix is using ${suggested} on ${rgbToHex(bg.r, bg.g, bg.b)} (verify in UI).`,
          confidence: 0.75,
          context: {
            ratio,
            required,
            color: el.computedStyle.color,
            backgroundColor: el.computedStyle.backgroundColor,
            fontSize: el.computedStyle.fontSize,
            fontWeight: el.computedStyle.fontWeight,
          },
        }),
      );
    }

    if (aiEnabled && complexElements.length > 0) {
      const aiResults = await this.runAIAnalysis(complexElements, context, provider, standard);
      out.push(...aiResults);
    }

    return out;
  }

  private resolveParentBackground(el: ElementSnapshot, context: RuleContext): RGBA | null {
    const allElements = [
      ...context.extraction.headings,
      ...context.extraction.links,
      ...context.extraction.ariaElements,
    ];

    const elementsBySelector = new Map<string, ElementSnapshot>();
    for (const e of allElements) {
      elementsBySelector.set(e.selector, e);
    }

    let parentSelector = el.parentSelector;
    while (parentSelector) {
      const parent = elementsBySelector.get(parentSelector);
      if (!parent?.computedStyle?.backgroundColor) break;

      const bg = parseColor(parent.computedStyle.backgroundColor);
      if (bg && bg.a > 0) {
        return bg;
      }

      parentSelector = parent.parentSelector;
    }

    return null;
  }

  private async runAIAnalysis(
    elements: ElementSnapshot[],
    context: RuleContext,
    provider: AIProvider,
    standard: 'AA' | 'AAA',
  ): Promise<RuleResult[]> {
    const prompt = this.buildContrastAiPrompt(elements, context, standard);
    const analysis = await provider.analyze(prompt, context);
    const parsed = this.parseAIResponseWithSchema(analysis.raw, ContrastAIResponseSchema);

    if (!parsed?.results) return [];

    const out: RuleResult[] = [];
    const elementsBySelector = new Map<string, ElementSnapshot>();
    for (const el of elements) {
      elementsBySelector.set(el.selector, el);
    }

    for (const result of parsed.results) {
      const el = elementsBySelector.get(result.element);
      if (!el) continue;

      if (result.wcagLevel === 'fail-AA') {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'ai',
            message: `AI analysis: contrast may fail WCAG ${standard}.`,
            suggestion: result.suggestion,
            confidence: result.confidence,
            context: {
              foreground: result.foreground,
              background: result.background,
              estimatedRatio: result.estimatedRatio,
              latencyMs: analysis.latencyMs,
              attempts: analysis.attempts,
            },
          }),
        );
      }
    }

    return out;
  }

  private buildContrastAiPrompt(
    elements: ElementSnapshot[],
    context: RuleContext,
    standard: 'AA' | 'AAA',
  ): string {
    const elementData = elements.slice(0, 20).map((el) => ({
      selector: el.selector,
      textContent: el.textContent.slice(0, 100),
      color: el.computedStyle?.color,
      backgroundColor: el.computedStyle?.backgroundColor,
      fontSize: el.computedStyle?.fontSize,
      fontWeight: el.computedStyle?.fontWeight,
      surroundingText: el.surroundingText?.slice(0, 100),
    }));

    const outputSchema = {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              element: { type: 'string' },
              foreground: { type: 'string' },
              background: { type: 'string' },
              estimatedRatio: { type: 'number' },
              wcagLevel: { type: 'string', enum: ['pass-AAA', 'pass-AA', 'fail-AA'] },
              suggestion: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: [
              'element',
              'foreground',
              'background',
              'wcagLevel',
              'suggestion',
              'confidence',
            ],
          },
        },
      },
      required: ['results'],
    };

    return [
      'You are an accessibility auditor evaluating color contrast.',
      '',
      '# Task',
      `Analyze these elements for WCAG ${standard} contrast compliance.`,
      'These elements have transparent or complex backgrounds that could not be computed statically.',
      'Estimate the effective foreground and background colors and contrast ratio.',
      '',
      '# Page Context',
      `Title: ${context.extraction.pageTitle}`,
      '',
      '# Elements',
      JSON.stringify(elementData, null, 2),
      '',
      '# Output Schema',
      JSON.stringify(outputSchema, null, 2),
      '',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');
  }
}
