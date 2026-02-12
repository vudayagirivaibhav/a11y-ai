import type { AuditConfig, Rule, ViolationCategory } from './types.js';

/**
 * Singleton registry for rules.
 *
 * Rules are registered once at startup (built-ins + user plugins).
 */
export class RuleRegistry {
  private static instance: RuleRegistry | null = null;
  private readonly rules = new Map<string, Rule>();

  /**
   * Create an isolated registry instance (useful for tests or custom wiring).
   */
  static create(): RuleRegistry {
    return new RuleRegistry();
  }

  /**
   * Get the global singleton instance.
   */
  static getInstance(): RuleRegistry {
    if (!RuleRegistry.instance) {
      RuleRegistry.instance = new RuleRegistry();
    }
    return RuleRegistry.instance;
  }

  private constructor() {}

  /**
   * Register a rule. Throws if a rule with the same id already exists.
   */
  register(rule: Rule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule already registered: ${rule.id}`);
    }
    this.rules.set(rule.id, rule);
  }

  /**
   * Get a rule by id.
   */
  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all rules in a stable registration order.
   */
  getAll(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get all rules for a category.
   */
  getByCategory(category: ViolationCategory): Rule[] {
    return this.getAll().filter((r) => r.category === category);
  }

  /**
   * Filter enabled rules based on an `AuditConfig`.
   *
   * Rules are enabled by default unless explicitly disabled.
   */
  enabledRules(config: AuditConfig): Rule[] {
    const perRule = config.rules ?? {};
    return this.getAll().filter((rule) => {
      const cfg = perRule[rule.id];
      return cfg?.enabled !== false;
    });
  }
}
