import type { AxeResults } from 'axe-core';

import type { AxeViolation, ViolationSeverity } from '../types/axe.js';

/**
 * Map axe "impact" to our normalized severity.
 */
export function impactToSeverity(impact: unknown): ViolationSeverity {
  if (impact === 'critical') return 'critical';
  if (impact === 'serious') return 'serious';
  if (impact === 'moderate') return 'moderate';
  if (impact === 'minor') return 'minor';
  return 'moderate';
}

/**
 * Normalize raw axe-core results into per-element `AxeViolation`s.
 *
 * - One output row per (violation id + element selector)
 * - Best-effort deduplication
 * - Category derived from `cat.*` tags when present
 */
export function normalizeAxeResults(results: AxeResults): AxeViolation[] {
  const out: AxeViolation[] = [];
  const seen = new Set<string>();

  for (const v of results.violations ?? []) {
    const category = (v.tags ?? []).find((t) => t.startsWith('cat.')) ?? undefined;
    const severity = impactToSeverity(v.impact);

    for (const node of v.nodes ?? []) {
      const selector = Array.isArray(node.target) ? node.target.join(', ') : String(node.target ?? '');
      const key = `${v.id}::${selector}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        id: v.id,
        severity,
        help: v.help,
        helpUrl: v.helpUrl,
        description: v.description,
        selector,
        html: node.html ?? '',
        failureSummary: node.failureSummary ?? undefined,
        tags: v.tags ?? [],
        category,
      });
    }
  }

  return out;
}

