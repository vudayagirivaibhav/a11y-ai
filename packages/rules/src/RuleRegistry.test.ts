import { describe, expect, it } from 'vitest';

import { RuleRegistry } from './RuleRegistry.js';

describe('RuleRegistry', () => {
  it('registers and retrieves rules by id and category', () => {
    const registry = RuleRegistry.create();

    registry.register({
      id: 'test/r1',
      category: 'alt-text',
      description: 'r1',
      severity: 'minor',
      async evaluate() {
        return [];
      },
    });

    registry.register({
      id: 'test/r2',
      category: 'alt-text',
      description: 'r2',
      severity: 'minor',
      async evaluate() {
        return [];
      },
    });

    expect(registry.get('test/r1')?.id).toBe('test/r1');
    expect(registry.getByCategory('alt-text').length).toBe(2);
    expect(registry.getAll().length).toBe(2);
  });

  it('filters enabled rules via AuditConfig', () => {
    const registry = RuleRegistry.create();
    registry.register({
      id: 'test/enabled',
      category: 'structure',
      description: 'enabled',
      severity: 'minor',
      async evaluate() {
        return [];
      },
    });
    registry.register({
      id: 'test/disabled',
      category: 'structure',
      description: 'disabled',
      severity: 'minor',
      async evaluate() {
        return [];
      },
    });

    const enabled = registry.enabledRules({
      rules: {
        'test/disabled': { enabled: false },
      },
    });

    expect(enabled.map((r) => r.id)).toEqual(['test/enabled']);
  });
});

