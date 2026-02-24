import type { AIProvider } from '@a11y-ai/core/types';

import type { Rule, RuleContext, RuleResult, ViolationCategory } from './types.js';

/**
 * Input shape for `createRule(...)`.
 *
 * This mirrors the `Rule` interface but allows a friendlier "object literal"
 * style without having to create a full class that extends `BaseRule`.
 */
export interface CreateRuleInput {
  /** Stable identifier for registration, filtering, and config keys. */
  id: string;

  /** Category used for grouping in reports. */
  category: ViolationCategory;

  /** Short description of what the rule checks. */
  description: string;

  /** Default severity when the rule doesn't specify one per-result. */
  severity?: Rule['severity'];

  /**
   * Whether this rule typically requires AI calls to be useful.
   *
   * This is a metadata hint used by presets and rule listing UIs.
   */
  requiresAI?: boolean;

  /** Whether this rule can use a vision-capable provider API. */
  supportsVision?: boolean;

  /** Display hint for expected cost per run (tokens/requests/etc). */
  estimatedCost?: string;

  /**
   * Rule evaluation function.
   *
   * If your rule is fully static, you can ignore the `provider` argument.
   */
  evaluate: (context: RuleContext, provider: AIProvider) => Promise<RuleResult[]>;
}

/**
 * Shorthand factory for creating simple custom rules.
 *
 * This is intended for plugin-style rules without needing a full class.
 */
export function createRule(input: CreateRuleInput): Rule {
  return {
    id: input.id,
    category: input.category,
    description: input.description,
    severity: input.severity ?? 'moderate',
    requiresAI: input.requiresAI,
    supportsVision: input.supportsVision,
    estimatedCost: input.estimatedCost,
    evaluate: input.evaluate,
  };
}
