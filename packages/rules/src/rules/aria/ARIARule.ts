import type { AIAnalysisResult, AIProvider, ElementSnapshot } from '@a11y-ai/core/types';

import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';

const VALID_ARIA_ATTRIBUTES = new Set([
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-hidden',
  'aria-expanded',
  'aria-controls',
  'aria-checked',
  'aria-selected',
  'aria-current',
  'aria-haspopup',
  'aria-pressed',
  'aria-live',
  'aria-busy',
  'aria-modal',
  'aria-required',
  'aria-invalid',
  'aria-valuenow',
  'aria-valuemin',
  'aria-valuemax',
  'aria-valuetext',
  'aria-level',
  'aria-orientation',
  'aria-activedescendant',
]);

const ABSTRACT_ROLES = new Set([
  'command',
  'composite',
  'input',
  'landmark',
  'range',
  'roletype',
  'section',
  'sectionhead',
  'select',
  'structure',
  'widget',
  'window',
]);

const ROLE_REQUIRED_PROPS: Record<string, string[]> = {
  slider: ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
  spinbutton: ['aria-valuenow'],
  combobox: ['aria-expanded'],
  tab: ['aria-selected'],
  switch: ['aria-checked'],
  checkbox: ['aria-checked'],
  radio: ['aria-checked'],
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isFocusable(el: ElementSnapshot): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a' && typeof el.attributes.href === 'string' && el.attributes.href.trim().length > 0)
    return true;
  if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') return true;

  const tabIndexRaw = el.attributes.tabindex ?? el.attributes.tabIndex;
  if (typeof tabIndexRaw === 'string') {
    const n = Number(tabIndexRaw);
    if (Number.isFinite(n) && n >= 0) return true;
  }
  return false;
}

function hasIdInHtml(html: string, id: string): boolean {
  return new RegExp(`\\bid=["']${escapeRegExp(id)}["']`).test(html);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTrueFalse(value: string): boolean {
  const v = value.toLowerCase();
  return v === 'true' || v === 'false';
}

function implicitRole(el: ElementSnapshot): string | null {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button') return 'button';
  if (tag === 'a' && typeof el.attributes.href === 'string' && el.attributes.href.trim().length > 0)
    return 'link';
  if (tag === 'nav') return 'navigation';
  if (tag === 'main') return 'main';
  if (tag === 'header') return 'banner';
  if (tag === 'footer') return 'contentinfo';
  return null;
}

/**
 * ARIA attribute validation rule.
 *
 * This is a best-effort validator focused on common mistakes.
 */
export class ARIARule extends BaseRule {
  constructor() {
    super({
      id: 'ai/aria-validation',
      category: 'aria',
      description: 'Validates common ARIA attribute and role misuse patterns.',
      severity: 'moderate',
      defaultBatchSize: 10,
      requiresAI: true,
      estimatedCost: '1 request per ~10 elements (optional)',
    });
  }

  async evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    const elements = context.extraction.ariaElements;
    const out: RuleResult[] = [];

    for (const el of elements) {
      out.push(...this.evaluateStatic(el, context.extraction.rawHTML));
    }

    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const aiEnabled = settings?.aiEnabled !== false;
    if (!aiEnabled) return out;

    const aiCandidates = elements.filter(
      (e) => e.attributes.role && !out.some((r) => r.element.selector === e.selector),
    );
    if (aiCandidates.length === 0) return out;

    const batchSize = context.config.rules?.[this.id]?.batchSize ?? this.defaultBatchSize;
    const aiResults = await this.evaluateInBatches(aiCandidates, batchSize, async (batch) => {
      const prompt = this.buildAiPrompt(batch, context);
      const analysis = await provider.analyze(prompt, context);
      return this.parseAiResponse(analysis, batch);
    });

    out.push(...aiResults);
    return out;
  }

  private evaluateStatic(el: ElementSnapshot, rawHTML: string): RuleResult[] {
    const out: RuleResult[] = [];
    const attrs = el.attributes;

    // Invalid aria-* attributes
    for (const [name, value] of Object.entries(attrs)) {
      if (!name.startsWith('aria-')) continue;
      if (!VALID_ARIA_ATTRIBUTES.has(name)) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: `Invalid ARIA attribute: ${name}.`,
            suggestion:
              'Remove the invalid ARIA attribute or replace it with a valid aria-* attribute.',
            confidence: 0.8,
            context: { attribute: name, value },
          }),
        );
      }
    }

    // Invalid common values
    if (typeof attrs['aria-hidden'] === 'string' && !isTrueFalse(attrs['aria-hidden'])) {
      out.push(
        this.makeResult(el, {
          severity: 'moderate',
          source: 'static',
          message: 'aria-hidden must be "true" or "false".',
          suggestion: 'Use aria-hidden="true" or aria-hidden="false".',
          confidence: 0.9,
          context: { value: attrs['aria-hidden'] },
        }),
      );
    }

    if (typeof attrs['aria-expanded'] === 'string' && !isTrueFalse(attrs['aria-expanded'])) {
      out.push(
        this.makeResult(el, {
          severity: 'moderate',
          source: 'static',
          message: 'aria-expanded must be "true" or "false".',
          suggestion: 'Use aria-expanded="true" or aria-expanded="false".',
          confidence: 0.85,
          context: { value: attrs['aria-expanded'] },
        }),
      );
    }

    // Conflicting ARIA: aria-hidden=true on focusable element
    if ((attrs['aria-hidden'] ?? '').toLowerCase() === 'true' && isFocusable(el)) {
      out.push(
        this.makeResult(el, {
          severity: 'serious',
          source: 'static',
          message:
            'Focusable element is hidden from assistive technologies via aria-hidden="true".',
          suggestion:
            'Remove aria-hidden from focusable elements, or make the element non-focusable.',
          confidence: 0.9,
          context: { reason: 'aria-hidden-on-focusable' },
        }),
      );
    }

    // Abstract roles
    const role = normalizeText(attrs.role ?? '').toLowerCase();
    if (role && ABSTRACT_ROLES.has(role)) {
      out.push(
        this.makeResult(el, {
          severity: 'serious',
          source: 'static',
          message: `Abstract ARIA role used directly: "${role}".`,
          suggestion: 'Use a concrete ARIA role or prefer a native HTML element.',
          confidence: 0.85,
          context: { role },
        }),
      );
    }

    // Redundant role
    const implicit = implicitRole(el);
    if (role && implicit && role === implicit) {
      out.push(
        this.makeResult(el, {
          severity: 'minor',
          source: 'static',
          message: `Redundant role="${role}" on a native <${el.tagName.toLowerCase()}> element.`,
          suggestion: 'Remove the redundant role attribute.',
          confidence: 0.75,
          context: { role },
        }),
      );
    }

    // Missing required ARIA props for certain roles
    if (role && ROLE_REQUIRED_PROPS[role]) {
      const missing = ROLE_REQUIRED_PROPS[role]!.filter((p) => !(p in attrs));
      if (missing.length > 0) {
        out.push(
          this.makeResult(el, {
            severity: 'serious',
            source: 'static',
            message: `Role "${role}" is missing required ARIA attributes: ${missing.join(', ')}.`,
            suggestion: 'Add the required aria-* attributes or use a native element instead.',
            confidence: 0.8,
            context: { role, missing },
          }),
        );
      }
    }

    // aria-labelledby / aria-describedby targets
    for (const key of ['aria-labelledby', 'aria-describedby'] as const) {
      const value = attrs[key];
      if (typeof value !== 'string' || value.trim().length === 0) continue;
      const ids = value
        .split(/\s+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const missing = ids.filter((id) => !hasIdInHtml(rawHTML, id));
      if (missing.length > 0) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: `${key} references missing ids: ${missing.join(', ')}.`,
            suggestion: 'Ensure referenced ids exist on the page, or update the ARIA reference.',
            confidence: 0.8,
            context: { key, missing },
          }),
        );
      }
    }

    return out;
  }

  private buildAiPrompt(batch: ElementSnapshot[], context: RuleContext): string {
    const outputSchema = {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              element: { type: 'string' },
              issues: { type: 'array', items: { type: 'string' } },
              recommendation: { type: 'string', enum: ['keep', 'simplify', 'fix'] },
              suggestedMarkup: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['element', 'issues', 'recommendation', 'suggestedMarkup', 'confidence'],
          },
        },
      },
      required: ['results'],
    };

    const instruction = [
      'Evaluate ARIA usage for custom widgets.',
      'Prefer native HTML when possible ("first rule of ARIA").',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');

    const elements = batch.map((e) => ({
      selector: e.selector,
      tagName: e.tagName,
      attributes: e.attributes,
      html: e.html,
    }));

    return [
      'You are an accessibility auditor.',
      '',
      '# instruction',
      instruction,
      '',
      '# elements',
      JSON.stringify({ pageTitle: context.extraction.pageTitle, elements }),
      '',
      '# outputSchema',
      JSON.stringify(outputSchema),
    ].join('\n');
  }

  private parseAiResponse(analysis: AIAnalysisResult, batch: ElementSnapshot[]): RuleResult[] {
    const parsed = safeJsonParse(extractJsonMaybe(analysis.raw));
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { results?: unknown }).results)
        ? ((parsed as { results: unknown[] }).results as unknown[])
        : [];

    const bySelector = new Map<string, ElementSnapshot>();
    for (const el of batch) bySelector.set(el.selector, el);

    const out: RuleResult[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const selector = typeof obj.element === 'string' ? obj.element : '';
      const el = bySelector.get(selector);
      if (!el) continue;

      const issues = Array.isArray(obj.issues)
        ? obj.issues.filter((x) => typeof x === 'string')
        : [];
      if (issues.length === 0) continue;

      const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0.55;
      const recommendation = typeof obj.recommendation === 'string' ? obj.recommendation : 'fix';
      const suggestedMarkup = typeof obj.suggestedMarkup === 'string' ? obj.suggestedMarkup : '';

      out.push(
        this.makeResult(el, {
          severity: recommendation === 'simplify' ? 'moderate' : 'serious',
          source: 'ai',
          message: 'ARIA usage may need adjustment.',
          suggestion: suggestedMarkup || issues.join(' '),
          confidence,
          context: {
            issues,
            recommendation,
            latencyMs: analysis.latencyMs,
            attempts: analysis.attempts,
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

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function extractJsonMaybe(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
