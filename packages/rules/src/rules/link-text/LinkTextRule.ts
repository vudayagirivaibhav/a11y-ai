import type { AIAnalysisResult, AIProvider, LinkElement } from '@a11y-ai/core/types';

import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';

const GENERIC_LINK_TEXT = new Set([
  'click here',
  'read more',
  'learn more',
  'here',
  'link',
  'this',
  'more',
  'details',
  'continue',
]);

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function looksLikeUrlText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^https?:\/\//.test(t) || /^www\./.test(t);
}

function isExternalHref(pageUrl: string, href: string): boolean {
  try {
    const base = new URL(pageUrl);
    const u = new URL(href, base);
    return u.origin !== base.origin;
  } catch {
    return false;
  }
}

function isSkipLink(href: string | null): boolean {
  if (!href) return false;
  const lower = href.toLowerCase();
  return lower === '#main-content' || lower === '#skip-nav' || lower.startsWith('#skip');
}

function isTelOrMailto(href: string | null): boolean {
  if (!href) return false;
  const lower = href.toLowerCase();
  return lower.startsWith('tel:') || lower.startsWith('mailto:');
}

function isValidTelOrMailto(href: string): boolean {
  const lower = href.toLowerCase();
  if (lower.startsWith('tel:')) return /^tel:\+?[0-9(). -]{3,}$/.test(lower);
  if (lower.startsWith('mailto:')) return /^mailto:[^@]+@[^@]+\.[^@]+/.test(lower);
  return true;
}

/**
 * AI-powered link text quality rule.
 *
 * Static checks catch the obvious "empty / generic / URL-as-text" issues.
 * Optional AI checks evaluate whether link text makes sense out of context.
 */
export class LinkTextRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/link-text-quality',
      category: 'link-text',
      description: 'Checks that link text is meaningful and descriptive.',
      severity: 'moderate',
      defaultBatchSize: 15,
      requiresAI: true,
      estimatedCost: '1 request per ~15 links',
    });
  }

  async evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    const links = context.extraction.links;
    const out: RuleResult[] = [];

    const duplicates = this.findDuplicateLinkText(links);

    for (const link of links) {
      out.push(...this.evaluateStatic(link, context, duplicates));
    }

    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const aiEnabled = settings?.aiEnabled !== false;
    if (!aiEnabled) return out;

    const aiCandidates = links.filter((l) => !out.some((r) => r.element.selector === l.selector));
    if (aiCandidates.length === 0) return out;

    const batchSize = context.config.rules?.[this.id]?.batchSize ?? this.defaultBatchSize;
    const aiResults = await this.evaluateInBatches(aiCandidates, batchSize, async (batch) => {
      const prompt = this.buildLinkPrompt(batch, context);
      const analysis = await provider.analyze(prompt, context);
      return this.parseLinkResponse(analysis, batch);
    });

    out.push(...aiResults);
    return out;
  }

  private findDuplicateLinkText(links: LinkElement[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const link of links) {
      const text = normalizeText(link.textContent);
      if (!text) continue;
      const key = text.toLowerCase();
      const href = (link.href ?? '').trim();
      if (!href) continue;
      const set = map.get(key) ?? new Set<string>();
      set.add(href);
      map.set(key, set);
    }
    return map;
  }

  private evaluateStatic(
    link: LinkElement,
    context: RuleContext,
    duplicates: Map<string, Set<string>>,
  ): RuleResult[] {
    const href = (link.href ?? '').trim() || null;
    const text = normalizeText(link.textContent ?? '');
    const ariaLabel = normalizeText(link.attributes['aria-label'] ?? '');

    // Skip-links: we still validate target existence, but don’t require descriptive text.
    if (isSkipLink(href)) {
      if (href && href.startsWith('#')) {
        const id = href.slice(1);
        if (!new RegExp(`id=["']${escapeRegExp(id)}["']`).test(context.extraction.rawHTML)) {
          return [
            this.makeResult(link, {
              severity: 'moderate',
              source: 'static',
              message: 'Skip link target does not exist on the page.',
              suggestion: `Ensure an element with id="${id}" exists.`,
              confidence: 0.8,
              context: { href },
            }),
          ];
        }
      }
      return [];
    }

    if (isTelOrMailto(href) && href && !isValidTelOrMailto(href)) {
      return [
        this.makeResult(link, {
          severity: 'minor',
          source: 'static',
          message: 'tel/mailto link format looks invalid.',
          suggestion: 'Fix the link format so it can be activated reliably.',
          confidence: 0.7,
          context: { href },
        }),
      ];
    }

    // Empty link content
    if (!text && !ariaLabel) {
      return [
        this.makeResult(link, {
          severity: 'serious',
          source: 'static',
          message: 'Link has no accessible text (empty text and no aria-label).',
          suggestion: 'Add meaningful link text, or provide aria-label/aria-labelledby.',
          confidence: 1,
          context: { href },
        }),
      ];
    }

    const effectiveText = (text || ariaLabel).toLowerCase();
    if (GENERIC_LINK_TEXT.has(effectiveText)) {
      return [
        this.makeResult(link, {
          severity: 'moderate',
          source: 'static',
          message: 'Link text is too generic.',
          suggestion:
            'Use link text that describes the destination or action (e.g., “View pricing plans”).',
          confidence: 0.9,
          context: { currentText: text || ariaLabel, href },
        }),
      ];
    }

    if (looksLikeUrlText(text || ariaLabel)) {
      return [
        this.makeResult(link, {
          severity: 'minor',
          source: 'static',
          message: 'Link text is a raw URL.',
          suggestion: 'Use human-readable link text and keep the URL in the href.',
          confidence: 0.8,
          context: { currentText: text || ariaLabel, href },
        }),
      ];
    }

    // Duplicate text pointing to different destinations.
    if (text) {
      const key = text.toLowerCase();
      const set = duplicates.get(key);
      if (set && set.size > 1) {
        return [
          this.makeResult(link, {
            severity: 'moderate',
            source: 'static',
            message: 'Multiple links share the same text but go to different destinations.',
            suggestion:
              'Make link text more specific so each link is distinguishable out of context.',
            confidence: 0.75,
            context: { currentText: text, distinctHrefs: Array.from(set) },
          }),
        ];
      }
    }

    // External link indication (best-effort).
    if (href && isExternalHref(context.url, href)) {
      const hasExternalHint = /\bexternal\b/i.test(text) || /\bexternal\b/i.test(ariaLabel);
      if (!hasExternalHint) {
        return [
          this.makeResult(link, {
            severity: 'minor',
            source: 'static',
            message: 'External link is not indicated as external.',
            suggestion: 'Consider indicating external navigation in link text or accessible label.',
            confidence: 0.55,
            context: { href },
          }),
        ];
      }
    }

    // Anchor links: ensure target exists.
    if (href && href.startsWith('#') && href.length > 1) {
      const id = href.slice(1);
      if (!new RegExp(`id=["']${escapeRegExp(id)}["']`).test(context.extraction.rawHTML)) {
        return [
          this.makeResult(link, {
            severity: 'moderate',
            source: 'static',
            message: 'Anchor link target does not exist on the page.',
            suggestion: `Ensure an element with id="${id}" exists.`,
            confidence: 0.75,
            context: { href },
          }),
        ];
      }
    }

    return [];
  }

  private buildLinkPrompt(links: LinkElement[], context: RuleContext): string {
    const outputSchema = {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              element: { type: 'string' },
              currentText: { type: 'string' },
              quality: { type: 'string', enum: ['good', 'vague', 'misleading'] },
              issues: { type: 'array', items: { type: 'string' } },
              suggestedText: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: [
              'element',
              'currentText',
              'quality',
              'issues',
              'suggestedText',
              'confidence',
            ],
          },
        },
      },
      required: ['results'],
    };

    const instruction = [
      'Evaluate whether each link text makes sense out of context.',
      'Prefer specific, descriptive text that indicates the destination or action.',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');

    const elements = links.map((l) => ({
      selector: l.selector,
      text: normalizeText(l.textContent),
      href: l.href ?? '',
      ariaLabel: l.attributes['aria-label'] ?? '',
      pageTitle: context.extraction.pageTitle,
    }));

    return [
      'You are an accessibility auditor.',
      '',
      '# instruction',
      instruction,
      '',
      '# links',
      JSON.stringify(elements),
      '',
      '# outputSchema',
      JSON.stringify(outputSchema),
    ].join('\n');
  }

  private parseLinkResponse(analysis: AIAnalysisResult, batch: LinkElement[]): RuleResult[] {
    const parsed = safeJsonParse(extractJsonMaybe(analysis.raw));
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { results?: unknown }).results)
        ? ((parsed as { results: unknown[] }).results as unknown[])
        : [];

    const bySelector = new Map<string, LinkElement>();
    for (const link of batch) bySelector.set(link.selector, link);

    const out: RuleResult[] = [];

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const selector = typeof obj.element === 'string' ? obj.element : '';
      const link = bySelector.get(selector);
      if (!link) continue;

      const quality = typeof obj.quality === 'string' ? obj.quality : 'good';
      if (quality === 'good') continue;

      const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0.6;
      const issues = Array.isArray(obj.issues)
        ? obj.issues.filter((x) => typeof x === 'string')
        : [];
      const suggestedText = typeof obj.suggestedText === 'string' ? obj.suggestedText : '';
      const currentText =
        typeof obj.currentText === 'string' ? obj.currentText : normalizeText(link.textContent);

      out.push(
        this.makeResult(link, {
          severity: quality === 'misleading' ? 'serious' : 'moderate',
          source: 'ai',
          message:
            quality === 'misleading'
              ? 'Link text may be misleading.'
              : 'Link text may be too vague.',
          suggestion: suggestedText || 'Revise the link text to be descriptive out of context.',
          confidence,
          context: {
            issues,
            currentText,
            latencyMs: analysis.latencyMs,
            attempts: analysis.attempts,
          },
        }),
      );
    }

    return out;
  }

  private makeResult(
    element: LinkElement,
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
