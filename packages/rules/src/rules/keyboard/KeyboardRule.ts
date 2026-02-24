import type { AIProvider, ElementSnapshot } from '@a11y-ai/core/types';

import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';

function isInteractiveNative(tagName: string): boolean {
  const tag = tagName.toLowerCase();
  return (
    tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea'
  );
}

function tabIndexValue(attrs: Record<string, string>): number | null {
  const raw = attrs.tabindex ?? attrs.tabIndex;
  if (typeof raw !== 'string') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function hasClickHandler(attrs: Record<string, string>): boolean {
  return typeof attrs.onclick === 'string' || typeof attrs.onClick === 'string';
}

function hasKeyboardHandler(attrs: Record<string, string>): boolean {
  return (
    typeof attrs.onkeydown === 'string' ||
    typeof attrs.onkeypress === 'string' ||
    typeof attrs.onkeyup === 'string' ||
    typeof attrs.onKeyDown === 'string' ||
    typeof attrs.onKeyPress === 'string' ||
    typeof attrs.onKeyUp === 'string'
  );
}

function hasRole(attrs: Record<string, string>): boolean {
  return typeof attrs.role === 'string' && attrs.role.trim().length > 0;
}

function hasOutlineNone(attrs: Record<string, string>): boolean {
  const style = (attrs.style ?? '').toLowerCase();
  return /\boutline\s*:\s*(none|0)\b/.test(style);
}

function isScrollable(attrs: Record<string, string>): boolean {
  const style = (attrs.style ?? '').toLowerCase();
  return (
    /\boverflow\s*:\s*(auto|scroll)\b/.test(style) ||
    /\boverflow-(x|y)\s*:\s*(auto|scroll)\b/.test(style)
  );
}

/**
 * Keyboard accessibility rule (static, markup-based).
 *
 * This is a best-effort check based on attributes present in HTML.
 */
export class KeyboardRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/keyboard-navigation',
      category: 'structure',
      description:
        'Checks common keyboard navigation issues (tabindex, click handlers, focus styles).',
      severity: 'moderate',
      requiresAI: false,
      estimatedCost: '0 (static)',
    });
  }

  async evaluate(context: RuleContext, _provider: AIProvider): Promise<RuleResult[]> {
    const candidates: ElementSnapshot[] = [
      ...context.extraction.links,
      ...context.extraction.forms.flatMap((f) => f.fields),
      ...context.extraction.ariaElements,
    ];

    const out: RuleResult[] = [];

    for (const el of candidates) {
      const attrs = el.attributes;
      const tabIndex = tabIndexValue(attrs);
      const interactive = isInteractiveNative(el.tagName) || hasRole(attrs) || tabIndex !== null;

      if (tabIndex !== null && tabIndex > 0) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: 'Positive tabindex can disrupt natural tab order.',
            suggestion: 'Avoid tabindex > 0; use DOM order and tabindex="0" only when necessary.',
            confidence: 0.8,
            context: { tabIndex },
          }),
        );
      }

      if (interactive && tabIndex === -1) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: 'Interactive element is removed from the tab order via tabindex="-1".',
            suggestion:
              'Only use tabindex="-1" for managed focus in composite widgets; otherwise keep elements reachable via Tab.',
            confidence: 0.75,
            context: { tabIndex },
          }),
        );
      }

      if (hasClickHandler(attrs) && !interactive) {
        out.push(
          this.makeResult(el, {
            severity: 'serious',
            source: 'static',
            message: 'Non-interactive element has a click handler.',
            suggestion:
              'Use a native interactive element (button/link) or add role, tabindex="0", and keyboard event handlers.',
            confidence: 0.85,
            context: { reason: 'onclick-on-noninteractive' },
          }),
        );
      }

      if (
        hasClickHandler(attrs) &&
        !hasKeyboardHandler(attrs) &&
        !isInteractiveNative(el.tagName)
      ) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: 'Click handler may not be accessible via keyboard.',
            suggestion:
              'Ensure Enter/Space key interactions are supported (or use a native button/link).',
            confidence: 0.7,
            context: { reason: 'onclick-without-keyboard-handler' },
          }),
        );
      }

      if (hasOutlineNone(attrs)) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: 'Focus outline is disabled via inline styles.',
            suggestion:
              'Avoid removing focus outlines; provide an accessible alternative focus indicator.',
            confidence: 0.75,
            context: { reason: 'outline-none' },
          }),
        );
      }

      if (isScrollable(attrs) && tabIndex !== 0) {
        out.push(
          this.makeResult(el, {
            severity: 'minor',
            source: 'static',
            message: 'Scrollable container may not be keyboard-scrollable.',
            suggestion:
              'Consider adding tabindex="0" so keyboard users can focus and scroll the container.',
            confidence: 0.55,
            context: { reason: 'scrollable-without-tabindex0' },
          }),
        );
      }
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
