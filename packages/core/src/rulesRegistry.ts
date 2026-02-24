import {
  RuleRegistry,
  getRuleMetadata as getRuleMetadataFromRules,
  registerBuiltinRules,
} from '@a11y-ai/rules';
import type { Rule, RuleInfo } from '@a11y-ai/rules';

let initialized = false;

/**
 * Get the global rules registry used by the auditor.
 *
 * Built-in rules are registered on first access.
 */
export function getGlobalRuleRegistry(): RuleRegistry {
  const registry = RuleRegistry.getInstance();
  if (!initialized) {
    registerBuiltinRules(registry);
    initialized = true;
  }
  return registry;
}

/**
 * Register a custom rule globally.
 */
export function registerRule(rule: Rule): void {
  getGlobalRuleRegistry().register(rule);
}

/**
 * Return metadata for all registered rules.
 */
export function getRuleMetadata(): RuleInfo[] {
  return getRuleMetadataFromRules(getGlobalRuleRegistry());
}
