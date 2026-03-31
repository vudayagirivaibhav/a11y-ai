import type { AIProvider, ElementSnapshot } from '@a11y-ai/core/types';

import { BaseRule } from '../../BaseRule.js';
import { KeyboardResponseSchema } from '../../schemas.js';
import type { RuleContext, RuleResult } from '../../types.js';
import { type TabEntry, buildTabOrder } from './tabOrder.js';

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
 * Keyboard accessibility rule with static checks and AI analysis.
 *
 * Static checks detect common issues from markup.
 * AI analysis evaluates tab order logic and potential focus traps.
 */
export class KeyboardRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/keyboard-navigation',
      category: 'structure',
      description:
        'Checks common keyboard navigation issues (tabindex, click handlers, focus styles).',
      severity: 'moderate',
      requiresAI: true,
      estimatedCost: '1 request per page',
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

    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const aiEnabled = settings?.aiEnabled !== false;

    if (aiEnabled && candidates.length > 0) {
      const tabOrder = buildTabOrder(candidates);
      const aiResults = await this.runAIAnalysis(candidates, tabOrder, context, _provider);
      out.push(...aiResults);
    }

    return out;
  }

  private async runAIAnalysis(
    candidates: ElementSnapshot[],
    tabOrder: TabEntry[],
    context: RuleContext,
    provider: AIProvider,
  ): Promise<RuleResult[]> {
    const prompt = this.buildKeyboardPrompt(candidates, tabOrder, context);
    const analysis = await provider.analyze(prompt, context);
    const parsed = this.parseAIResponseWithSchema(analysis.raw, KeyboardResponseSchema);

    if (!parsed?.issues || parsed.issues.length === 0) {
      return [];
    }

    const anchor: ElementSnapshot = {
      selector: 'page',
      html: '',
      tagName: 'page',
      attributes: {},
      textContent: '',
    };

    return [
      this.makeResult(anchor, {
        severity: 'moderate',
        source: 'ai',
        message: 'Potential keyboard navigation issues detected.',
        suggestion: parsed.issues.join(' '),
        confidence: parsed.confidence ?? 0.6,
        context: {
          issues: parsed.issues,
          unreachable: parsed.unreachable,
          traps: parsed.traps,
          latencyMs: analysis.latencyMs,
          attempts: analysis.attempts,
        },
      }),
    ];
  }

  private buildKeyboardPrompt(
    elements: ElementSnapshot[],
    tabOrder: TabEntry[],
    context: RuleContext,
  ): string {
    const elementData = elements.slice(0, 50).map((el) => ({
      selector: el.selector,
      tagName: el.tagName,
      role: el.attributes.role ?? null,
      tabindex: el.attributes.tabindex ?? el.attributes.tabIndex ?? null,
      hasOnclick: !!(el.attributes.onclick || el.attributes.onClick),
      hasKeyHandler: !!(
        el.attributes.onkeydown ||
        el.attributes.onkeypress ||
        el.attributes.onkeyup
      ),
      landmark: el.landmark ?? null,
      textContent: el.textContent.slice(0, 50),
    }));

    const tabOrderData = tabOrder.slice(0, 50).map((t) => ({
      order: t.order,
      selector: t.selector,
      tagName: t.tagName,
      tabIndex: t.tabIndex,
    }));

    const outputSchema = {
      type: 'object',
      properties: {
        issues: { type: 'array', items: { type: 'string' } },
        unreachable: { type: 'array', items: { type: 'string' } },
        traps: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number' },
      },
      required: ['issues', 'confidence'],
    };

    return [
      'You are an accessibility auditor evaluating keyboard navigation.',
      '',
      '# Task',
      'Analyze the tab order and interactive elements for keyboard accessibility issues.',
      'Look for:',
      '- Logical issues with the tab order (e.g., important elements appearing late)',
      '- Elements that may be unreachable via keyboard',
      '- Potential focus traps (elements that trap keyboard focus)',
      '- Missing keyboard handlers on custom interactive elements',
      '',
      '# Page Context',
      `Title: ${context.extraction.pageTitle}`,
      '',
      '# Interactive Elements',
      JSON.stringify(elementData, null, 2),
      '',
      '# Computed Tab Order',
      JSON.stringify(tabOrderData, null, 2),
      '',
      '# Output Schema',
      JSON.stringify(outputSchema, null, 2),
      '',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');
  }
}
