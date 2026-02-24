import type { AIProvider, ElementSnapshot } from '@a11y-ai/core/types';
import { calculateContrastRatio, parseColor } from '@a11y-ai/core/utils';

import { BaseRule } from '../../BaseRule.js';
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

function contrastRequirement(fontSizePx: number, standard: 'AA' | 'AAA'): number {
  // Large text: >=18px regular (we don't currently detect bold reliably).
  const isLarge = fontSizePx >= 18;
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
 * Contrast rule (computed style based).
 *
 * This is a best-effort check based on extracted computed styles. For complex
 * backgrounds (gradients, images, transparency), we surface a "manual review"
 * finding instead of guessing.
 */
export class ContrastRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/contrast-analysis',
      category: 'contrast',
      description: 'Checks text color contrast against computed background colors (best-effort).',
      severity: 'moderate',
      requiresAI: false,
      estimatedCost: '0 (static)',
    });
  }

  async evaluate(context: RuleContext, _provider: AIProvider): Promise<RuleResult[]> {
    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const standard = String(settings?.standard ?? 'AA').toUpperCase() === 'AAA' ? 'AAA' : 'AA';

    const candidates: ElementSnapshot[] = [
      ...context.extraction.headings,
      ...context.extraction.links,
      ...context.extraction.ariaElements,
    ].filter((e) => e.textContent.trim().length > 0);

    const out: RuleResult[] = [];

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
        out.push(
          this.makeResult(el, {
            severity: 'minor',
            source: 'static',
            message:
              'Background color is transparent; contrast may depend on parent/background images.',
            suggestion:
              'Manually verify contrast where transparency or background images are used.',
            confidence: 0.45,
            context: {
              color: el.computedStyle.color,
              backgroundColor: el.computedStyle.backgroundColor,
            },
          }),
        );
        continue;
      }

      const fontSizePx = parsePx(el.computedStyle.fontSize) ?? 16;
      const required = contrastRequirement(fontSizePx, standard);
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
          },
        }),
      );
    }

    return out;
  }

  private makeResult(
    element: ElementSnapshot,
    options: Omit<RuleResult, 'ruleId' | 'category' | 'element'> & {
      context?: Record<string, unknown>;
    },
  ): RuleResult {
    return {
      ruleId: this.id,
      category: this.category,
      element,
      severity: options.severity,
      message: options.message,
      suggestion: options.suggestion,
      confidence: options.confidence,
      source: options.source,
      context: options.context,
    };
  }
}
