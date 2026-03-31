/**
 * Rules API endpoint.
 *
 * Returns metadata about all available accessibility rules,
 * useful for the rule explorer UI.
 */
import { NextResponse } from 'next/server';

import { RuleRegistry, registerBuiltinRules } from '@a11y-ai/rules';

export const runtime = 'nodejs';

export interface RuleInfo {
  id: string;
  category: string;
  description: string;
  severity: string;
  requiresAI: boolean;
  supportsVision: boolean;
  estimatedCost?: string;
}

export async function GET(): Promise<Response> {
  const registry = RuleRegistry.create();
  registerBuiltinRules(registry);

  const rules: RuleInfo[] = registry.getAll().map((rule) => ({
    id: rule.id,
    category: rule.category,
    description: rule.description,
    severity: rule.severity,
    requiresAI: rule.requiresAI ?? false,
    supportsVision: rule.supportsVision ?? false,
    estimatedCost: rule.estimatedCost,
  }));

  return NextResponse.json({ rules, count: rules.length });
}
