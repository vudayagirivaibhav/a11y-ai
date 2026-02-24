import type {
  AIAnalysisResult,
  AIProvider,
  ElementSnapshot,
  HeadingNode,
} from '@a11y-ai/core/types';

import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';

function headingLevel(tagName: string): number | null {
  const m = tagName.toLowerCase().match(/^h([1-6])$/);
  if (!m) return null;
  return Number(m[1]);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Heading structure and document outline rule.
 */
export class HeadingStructureRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/heading-structure',
      category: 'structure',
      description: 'Checks heading hierarchy and overall document outline.',
      severity: 'moderate',
      defaultBatchSize: 1,
      requiresAI: true,
      estimatedCost: '1 request per page',
    });
  }

  async evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    const headings = context.extraction.headings;
    const out: RuleResult[] = [];

    const levels = headings
      .map((h) => ({ h, level: headingLevel(h.tagName) }))
      .filter((x): x is { h: ElementSnapshot; level: number } => typeof x.level === 'number');

    const h1s = levels.filter((x) => x.level === 1);
    if (h1s.length === 0) {
      // Page-level issue: attach to the first heading (or synthesize).
      const anchor = headings[0] ?? {
        selector: 'html',
        html: '<html>',
        tagName: 'html',
        attributes: {},
        textContent: '',
      };
      out.push(
        this.makeResult(anchor, {
          severity: 'moderate',
          source: 'static',
          message: 'Page is missing an <h1> heading.',
          suggestion: 'Add a single <h1> that describes the main purpose of the page.',
          confidence: 0.8,
          context: { reason: 'missing-h1' },
        }),
      );
    }

    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const allowMultipleH1 = settings?.allowMultipleH1 === true;
    if (!allowMultipleH1 && h1s.length > 1) {
      for (const item of h1s.slice(1)) {
        out.push(
          this.makeResult(item.h, {
            severity: 'minor',
            source: 'static',
            message: 'Multiple <h1> headings detected.',
            suggestion:
              'Prefer a single <h1> per page unless your app intentionally uses multiple.',
            confidence: 0.7,
            context: { reason: 'multiple-h1' },
          }),
        );
      }
    }

    // Empty headings.
    for (const { h } of levels) {
      if (normalizeText(h.textContent).length === 0) {
        out.push(
          this.makeResult(h, {
            severity: 'moderate',
            source: 'static',
            message: 'Heading has no text content.',
            suggestion: 'Provide descriptive heading text or remove the empty heading.',
            confidence: 0.85,
            context: { reason: 'empty-heading' },
          }),
        );
      }
    }

    // Skipped levels.
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1]!;
      const cur = levels[i]!;
      if (cur.level > prev.level + 1) {
        out.push(
          this.makeResult(cur.h, {
            severity: 'minor',
            source: 'static',
            message: `Heading level is skipped (from h${prev.level} to h${cur.level}).`,
            suggestion: 'Use heading levels in order without skipping levels.',
            confidence: 0.75,
            context: { reason: 'skipped-level', from: prev.level, to: cur.level },
          }),
        );
      }
    }

    const aiEnabled = settings?.aiEnabled !== false;
    if (!aiEnabled) return out;

    if (context.extraction.documentOutline.length === 0) return out;

    const prompt = this.buildOutlinePrompt(context.extraction.documentOutline, context);
    const analysis = await provider.analyze(prompt, context);
    out.push(...this.parseOutlineResponse(analysis, headings[0] ?? null));

    return out;
  }

  private buildOutlinePrompt(outline: HeadingNode[], context: RuleContext): string {
    const outputSchema = {
      type: 'object',
      properties: {
        overallQuality: { type: 'string', enum: ['good', 'needs-improvement', 'poor'] },
        issues: { type: 'array', items: { type: 'string' } },
        suggestedOutline: { type: 'array' },
        confidence: { type: 'number' },
      },
      required: ['overallQuality', 'issues', 'suggestedOutline', 'confidence'],
    };

    const instruction = [
      'Evaluate whether the heading hierarchy creates a logical document outline.',
      'Focus on navigation by headings for screen reader users.',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');

    return [
      'You are an accessibility auditor.',
      '',
      '# instruction',
      instruction,
      '',
      '# page',
      JSON.stringify({ title: context.extraction.pageTitle, outline }),
      '',
      '# outputSchema',
      JSON.stringify(outputSchema),
    ].join('\n');
  }

  private parseOutlineResponse(
    analysis: AIAnalysisResult,
    anchor: ElementSnapshot | null,
  ): RuleResult[] {
    const parsed = safeJsonParse(extractJsonMaybe(analysis.raw));
    if (!parsed || typeof parsed !== 'object') return [];
    const obj = parsed as Record<string, unknown>;
    const overallQuality = typeof obj.overallQuality === 'string' ? obj.overallQuality : 'good';
    if (overallQuality === 'good') return [];

    const issues = Array.isArray(obj.issues) ? obj.issues.filter((x) => typeof x === 'string') : [];
    const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0.55;

    const el =
      anchor ??
      ({
        selector: 'html',
        html: '<html>',
        tagName: 'html',
        attributes: {},
        textContent: '',
      } satisfies ElementSnapshot);

    return [
      this.makeResult(el, {
        severity: overallQuality === 'poor' ? 'serious' : 'moderate',
        source: 'ai',
        message: 'Heading structure could be improved.',
        suggestion:
          issues.length > 0
            ? issues.join(' ')
            : 'Review and adjust the heading hierarchy for clarity.',
        confidence,
        context: { issues, latencyMs: analysis.latencyMs, attempts: analysis.attempts },
      }),
    ];
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
