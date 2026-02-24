import type {
  AIAnalysisResult,
  AIProvider,
  FormElement,
  FormFieldElement,
} from '@a11y-ai/core/types';

import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';

function normalizeText(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHiddenField(field: FormFieldElement): boolean {
  return (field.type ?? '').toLowerCase() === 'hidden';
}

function hasAccessibleLabel(field: FormFieldElement): boolean {
  return Boolean(
    normalizeText(field.labelText).length > 0 ||
    normalizeText(field.ariaLabel).length > 0 ||
    normalizeText(field.ariaLabelledBy).length > 0 ||
    normalizeText(field.title).length > 0,
  );
}

function countIds(html: string): Map<string, number> {
  const map = new Map<string, number>();
  const re = /\bid=["']([^"']+)["']/g;
  for (;;) {
    const m = re.exec(html);
    if (!m) break;
    const id = m[1]!.trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

/**
 * AI-powered form label relevance and association rule.
 *
 * Static checks catch missing/broken label associations and obvious issues.
 * Optional AI checks evaluate whether labels are clear and appropriate.
 */
export class FormLabelRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/form-label-relevance',
      category: 'form-labels',
      description: 'Checks that form fields have associated, relevant labels.',
      severity: 'serious',
      defaultBatchSize: 5,
      requiresAI: true,
      estimatedCost: '1 request per ~5 forms',
    });
  }

  async evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    const forms = context.extraction.forms;
    const out: RuleResult[] = [];

    const idCounts = countIds(context.extraction.rawHTML);

    for (const form of forms) {
      out.push(...this.evaluateStaticForm(form, idCounts));
    }

    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const aiEnabled = settings?.aiEnabled !== false;
    if (!aiEnabled) return out;

    const aiForms = forms.filter((f) => !out.some((r) => r.element.selector === f.selector));
    if (aiForms.length === 0) return out;

    const batchSize = context.config.rules?.[this.id]?.batchSize ?? this.defaultBatchSize;
    const aiResults = await this.evaluateInBatches(aiForms, batchSize, async (batch) => {
      const prompt = this.buildFormPrompt(batch, context);
      const analysis = await provider.analyze(prompt, context);
      return this.parseFormResponse(analysis, batch);
    });

    out.push(...aiResults);
    return out;
  }

  private evaluateStaticForm(form: FormElement, idCounts: Map<string, number>): RuleResult[] {
    const out: RuleResult[] = [];

    for (const field of form.fields) {
      if (isHiddenField(field)) continue;

      const id = field.id ?? null;
      if (id && (idCounts.get(id) ?? 0) > 1) {
        out.push(
          this.makeResult(field, {
            severity: 'serious',
            source: 'static',
            message: 'Duplicate id attribute detected on form fields.',
            suggestion: 'Ensure every form control uses a unique id.',
            confidence: 0.9,
            context: { id },
          }),
        );
      }

      if (!hasAccessibleLabel(field)) {
        out.push(
          this.makeResult(field, {
            severity: 'serious',
            source: 'static',
            message: 'Form field is missing an accessible label.',
            suggestion:
              'Add a <label> associated via for/id, or provide aria-label/aria-labelledby. Avoid using placeholder as the only label.',
            confidence: 1,
            context: { name: field.name, type: field.type, id },
          }),
        );
      }
    }

    // Radio/checkbox groups: encourage fieldset/legend when multiple options share a name.
    const grouped = new Map<string, FormFieldElement[]>();
    for (const field of form.fields) {
      const t = (field.type ?? '').toLowerCase();
      if (t !== 'radio' && t !== 'checkbox') continue;
      const name = field.name ?? '';
      if (!name) continue;
      const list = grouped.get(name) ?? [];
      list.push(field);
      grouped.set(name, list);
    }

    const hasFieldset = /<fieldset\b/i.test(form.html);
    const hasLegend = /<legend\b/i.test(form.html);
    for (const [name, fields] of grouped) {
      if (fields.length < 2) continue;
      if (hasFieldset && hasLegend) continue;
      out.push(
        this.makeResult(fields[0]!, {
          severity: 'moderate',
          source: 'static',
          message: 'Radio/checkbox group may be missing a fieldset/legend.',
          suggestion: 'Wrap related options in a <fieldset> and provide a descriptive <legend>.',
          confidence: 0.65,
          context: { groupName: name, optionCount: fields.length },
        }),
      );
    }

    return out;
  }

  private buildFormPrompt(forms: FormElement[], context: RuleContext): string {
    const outputSchema = {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              element: { type: 'string' },
              label: { type: 'string' },
              quality: { type: 'string', enum: ['good', 'vague', 'misleading', 'missing'] },
              issues: { type: 'array', items: { type: 'string' } },
              suggestedLabel: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['element', 'label', 'quality', 'issues', 'suggestedLabel', 'confidence'],
          },
        },
      },
      required: ['results'],
    };

    const instruction = [
      'Evaluate the clarity and relevance of form field labels.',
      'Flag placeholder-as-label patterns, vague labels, and misleading labels.',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');

    const payload = forms.flatMap((form) =>
      form.fields
        .filter((f) => !isHiddenField(f))
        .map((f) => ({
          selector: f.selector,
          type: f.type ?? '',
          name: f.name ?? '',
          id: f.id ?? '',
          labelText: f.labelText ?? '',
          ariaLabel: f.ariaLabel ?? '',
          ariaLabelledBy: f.ariaLabelledBy ?? '',
          placeholder: f.placeholder ?? '',
          required: f.required,
          autocomplete: f.autocomplete ?? '',
        })),
    );

    return [
      'You are an accessibility auditor.',
      '',
      '# instruction',
      instruction,
      '',
      '# fields',
      JSON.stringify({ pageTitle: context.extraction.pageTitle, fields: payload }),
      '',
      '# outputSchema',
      JSON.stringify(outputSchema),
    ].join('\n');
  }

  private parseFormResponse(analysis: AIAnalysisResult, batch: FormElement[]): RuleResult[] {
    const parsed = safeJsonParse(extractJsonMaybe(analysis.raw));
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { results?: unknown }).results)
        ? ((parsed as { results: unknown[] }).results as unknown[])
        : [];

    const bySelector = new Map<string, FormFieldElement>();
    for (const form of batch) {
      for (const field of form.fields) bySelector.set(field.selector, field);
    }

    const out: RuleResult[] = [];

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const selector = typeof obj.element === 'string' ? obj.element : '';
      const field = bySelector.get(selector);
      if (!field) continue;

      const quality = typeof obj.quality === 'string' ? obj.quality : 'good';
      if (quality === 'good') continue;

      const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0.6;
      const issues = Array.isArray(obj.issues)
        ? obj.issues.filter((x) => typeof x === 'string')
        : [];
      const suggestedLabel = typeof obj.suggestedLabel === 'string' ? obj.suggestedLabel : '';
      const label =
        typeof obj.label === 'string'
          ? obj.label
          : normalizeText(field.labelText) || normalizeText(field.ariaLabel);

      out.push(
        this.makeResult(field, {
          severity:
            quality === 'missing' ? 'serious' : quality === 'misleading' ? 'serious' : 'moderate',
          source: 'ai',
          message:
            quality === 'missing'
              ? 'Field label appears missing.'
              : quality === 'misleading'
                ? 'Field label may be misleading.'
                : 'Field label may be too vague.',
          suggestion: suggestedLabel || 'Revise the label to describe what the field expects.',
          confidence,
          context: { issues, label, latencyMs: analysis.latencyMs, attempts: analysis.attempts },
        }),
      );
    }

    return out;
  }

  private makeResult(
    element: FormFieldElement,
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
