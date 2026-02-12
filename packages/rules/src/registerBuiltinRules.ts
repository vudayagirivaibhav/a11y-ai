import type { RuleRegistry } from './RuleRegistry.js';

import { AltTextRule } from './rules/alt-text/AltTextRule.js';

/**
 * Register all built-in rules into a registry.
 *
 * Later prompts will expand this list as more rules are implemented.
 */
export function registerBuiltinRules(registry: RuleRegistry): void {
  registry.register(new AltTextRule());
}

