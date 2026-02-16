import type { AxeViolation } from '../types/axe.js';
import type { Violation } from '../types/violation.js';
import type { RuleResult } from '@a11y-ai/rules';
import type { ViolationSeverity } from '../types/axe.js';

const severityRank: Record<ViolationSeverity, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

const ruleToAxeIdHints: Record<string, readonly string[]> = {
  'ai/alt-text-quality': ['image-alt', 'input-image-alt', 'object-alt', 'area-alt'],
  'ai/link-text-quality': ['link-name'],
  'ai/contrast-analysis': ['color-contrast'],
  'ai/form-label-relevance': [
    'label',
    'select-name',
    'textarea-name',
    'input-button-name',
    'aria-input-field-name',
  ],
};

/**
 * Merge normalized axe violations with rule results into a unified list.
 *
 * Dedup heuristic:
 * - same selector
 * - rule id maps to axe rule id (best-effort)
 */
export function mergeAxeAndRuleResults(options: {
  axeViolations: AxeViolation[];
  ruleResults: RuleResult[];
}): Violation[] {
  const merged: Violation[] = [];
  const usedAxe = new Set<number>();

  for (const rr of options.ruleResults) {
    const selector = rr.element?.selector ?? '';
    const hints = ruleToAxeIdHints[rr.ruleId] ?? [];

    const axeIndex = options.axeViolations.findIndex((v, idx) => {
      if (usedAxe.has(idx)) return false;
      if (v.selector !== selector) return false;
      return hints.includes(v.id);
    });

    if (axeIndex >= 0) {
      const axe = options.axeViolations[axeIndex]!;
      usedAxe.add(axeIndex);
      merged.push({
        category: rr.category,
        selector,
        severity: worstSeverity(axe.severity, rr.severity),
        source: 'both',
        message: rr.message || axe.help,
        suggestion: rr.suggestion || axe.failureSummary,
        confidence: rr.confidence,
        axe,
        rule: rr,
      });
    } else {
      merged.push({
        category: rr.category,
        selector,
        severity: rr.severity,
        source: 'ai',
        message: rr.message,
        suggestion: rr.suggestion,
        confidence: rr.confidence,
        rule: rr,
      });
    }
  }

  options.axeViolations.forEach((axe, idx) => {
    if (usedAxe.has(idx)) return;
    merged.push({
      category: axe.category ?? axe.id,
      selector: axe.selector,
      severity: axe.severity,
      source: 'axe',
      message: axe.help,
      suggestion: axe.failureSummary,
      confidence: 1,
      axe,
    });
  });

  merged.sort((a, b) => {
    const sev = severityRank[b.severity] - severityRank[a.severity];
    if (sev !== 0) return sev;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  return merged;
}

function worstSeverity(a: ViolationSeverity, b: ViolationSeverity): ViolationSeverity {
  return severityRank[a] >= severityRank[b] ? a : b;
}

