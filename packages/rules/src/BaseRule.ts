import type { AIFinding, AIProvider, Severity } from '@a11y-ai/core/types';
import type { ElementSnapshot } from '@a11y-ai/core/types';

import type { Rule, RuleContext, RuleResult, ViolationCategory } from './types.js';

import { PromptBuilder } from './prompts/PromptBuilder.js';
import { extractJsonMaybe, safeJsonParse } from './utils.js';

/**
 * Base class for implementing rules with shared helpers:
 * - Prompt construction
 * - Structured JSON parsing with fallbacks
 * - Batch evaluation utilities
 */
export abstract class BaseRule implements Rule {
  /** Stable rule identifier. */
  readonly id: string;

  /** Category for grouping results. */
  readonly category: ViolationCategory;

  /** Short human-readable description. */
  readonly description: string;

  /** Default severity for results. */
  readonly severity: Severity;

  /** Whether this rule typically requires AI calls to be useful. */
  readonly requiresAI: boolean;

  /** Whether this rule supports vision-capable checks. */
  readonly supportsVision: boolean;

  /** Display hint for cost per run. */
  readonly estimatedCost?: string;

  /** Default batch size for AI calls. */
  protected readonly defaultBatchSize: number;

  protected constructor(options: {
    id: string;
    category: ViolationCategory;
    description: string;
    severity?: Severity;
    defaultBatchSize?: number;
    requiresAI?: boolean;
    supportsVision?: boolean;
    estimatedCost?: string;
  }) {
    this.id = options.id;
    this.category = options.category;
    this.description = options.description;
    this.severity = options.severity ?? 'moderate';
    this.defaultBatchSize = options.defaultBatchSize ?? 10;
    this.requiresAI = options.requiresAI ?? false;
    this.supportsVision = options.supportsVision ?? false;
    this.estimatedCost = options.estimatedCost;
  }

  /**
   * Each rule must implement its own evaluation logic.
   */
  abstract evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]>;

  /**
   * Template method for prompt construction.
   *
   * Rules can override this if they need a different layout.
   */
  protected buildPrompt(options: {
    system?: string;
    instruction: string;
    elements: ElementSnapshot[];
    outputSchema: unknown;
    extraContext?: Record<string, unknown>;
  }): string {
    const builder = new PromptBuilder()
      .system(options.system ?? '')
      .context(options.elements)
      .instruction(options.instruction)
      .outputFormat(options.outputSchema);

    if (options.extraContext) {
      builder.extra(options.extraContext);
    }

    return builder.build();
  }

  /**
   * Parse a structured JSON response with a permissive fallback strategy.
   *
   * Expected shapes:
   * - `{ findings: [...] }`
   * - `{ issues: [...] }`
   * - `[...]` (array of finding-like objects)
   */
  protected parseAIResponse(raw: string): AIFinding[] {
    const text = extractJsonMaybe(raw);
    const parsed = safeJsonParse(text);

    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object'
        ? (Array.isArray((parsed as { findings?: unknown }).findings) &&
            (parsed as { findings: unknown[] }).findings) ||
          (Array.isArray((parsed as { issues?: unknown }).issues) &&
            (parsed as { issues: unknown[] }).issues) ||
          []
        : [];

    return list.filter((x) => x && typeof x === 'object').map((x) => x as AIFinding);
  }

  /**
   * Helper to evaluate many elements in batches, producing a flattened result list.
   */
  protected async evaluateInBatches<T, R>(
    items: readonly T[],
    batchSize: number,
    fn: (batch: T[]) => Promise<R[]>,
  ): Promise<R[]> {
    const out: R[] = [];
    const size = Math.max(1, batchSize);

    for (let i = 0; i < items.length; i += size) {
      const batch = items.slice(i, i + size);

      const results = await fn(batch);
      out.push(...results);
    }

    return out;
  }

  /**
   * Helper to create a RuleResult with common fields pre-filled.
   */
  protected makeResult(
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
