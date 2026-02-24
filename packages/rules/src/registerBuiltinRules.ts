import type { RuleRegistry } from './RuleRegistry.js';

import { AltTextRule } from './rules/alt-text/AltTextRule.js';
import { LinkTextRule } from './rules/link-text/LinkTextRule.js';
import { ContrastRule } from './rules/contrast/ContrastRule.js';
import { FormLabelRule } from './rules/form-labels/FormLabelRule.js';
import { HeadingStructureRule } from './rules/headings/HeadingStructureRule.js';
import { ARIARule } from './rules/aria/ARIARule.js';
import { KeyboardRule } from './rules/keyboard/KeyboardRule.js';
import { LanguageRule } from './rules/language/LanguageRule.js';
import { MediaRule } from './rules/media/MediaRule.js';

/**
 * Register all built-in rules into a registry.
 *
 * Later prompts will expand this list as more rules are implemented.
 */
export function registerBuiltinRules(registry: RuleRegistry): void {
  registry.register(new AltTextRule());
  registry.register(new LinkTextRule());
  registry.register(new ContrastRule());
  registry.register(new FormLabelRule());
  registry.register(new HeadingStructureRule());
  registry.register(new ARIARule());
  registry.register(new KeyboardRule());
  registry.register(new LanguageRule());
  registry.register(new MediaRule());
}
