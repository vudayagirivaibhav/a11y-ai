import type { RuleInfo } from './types.js';

import { RuleRegistry } from './RuleRegistry.js';

/**
 * Return metadata for currently registered rules.
 *
 * If `registry` is omitted, the global singleton registry is used.
 */
export function getRuleMetadata(registry: RuleRegistry = RuleRegistry.getInstance()): RuleInfo[] {
  return registry.getAll().map((rule) => ({
    id: rule.id,
    category: rule.category,
    description: rule.description,
    requiresAI: rule.requiresAI ?? false,
    estimatedCost: rule.estimatedCost,
  }));
}
