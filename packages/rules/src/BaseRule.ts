import type { AIProvider, AIFinding, Severity } from 'a11y-ai';
import type { ElementSnapshot } from 'a11y-ai';

import type { Rule, RuleContext, RuleResult, ViolationCategory } from './types.js';

import { PromptBuilder } from './prompts/PromptBuilder.js';

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

  /** Default batch size for AI calls. */
  protected readonly defaultBatchSize: number;

  protected constructor(options: {
    id: string;
    category: ViolationCategory;
    description: string;
    severity?: Severity;
    defaultBatchSize?: number;
  }) {
    this.id = options.id;
    this.category = options.category;
    this.description = options.description;
    this.severity = options.severity ?? 'moderate';
    this.defaultBatchSize = options.defaultBatchSize ?? 10;
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
        ? (Array.isArray((parsed as { findings?: unknown }).findings) && (parsed as { findings: unknown[] }).findings) ||
          (Array.isArray((parsed as { issues?: unknown }).issues) && (parsed as { issues: unknown[] }).issues) ||
          []
        : [];

    return list
      .filter((x) => x && typeof x === 'object')
      .map((x) => x as AIFinding);
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
      // eslint-disable-next-line no-await-in-loop
      const results = await fn(batch);
      out.push(...results);
    }

    return out;
  }
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

