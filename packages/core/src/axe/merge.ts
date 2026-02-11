import type { AiIssue } from '../types/results.js';
import type { AxeViolation, ViolationSeverity } from '../types/axe.js';
import type { Violation } from '../types/violation.js';

const severityRank: Record<ViolationSeverity, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

const aiToAxeIdHints: Record<string, readonly string[]> = {
  'alt-text-quality': ['image-alt', 'input-image-alt', 'object-alt', 'area-alt'],
  'link-text-quality': ['link-name'],
  'contrast-analysis': ['color-contrast'],
  'form-label-relevance': [
    'label',
    'select-name',
    'textarea-name',
    'input-button-name',
    'aria-input-field-name',
  ],
};

/**
 * Merge axe-core violations with AI issues into a unified list.
 *
 * Dedup heuristic:
 * - Same selector
 * - AI rule has a known mapping to the axe rule id (best-effort)
 */
export function mergeViolations(axeViolations: AxeViolation[], aiIssues: AiIssue[]): Violation[] {
  const merged: Violation[] = [];
  const usedAxe = new Set<number>();

  for (const ai of aiIssues) {
    const selector = ai.element?.selector ?? '';
    const hints = aiToAxeIdHints[ai.rule] ?? [];

    const axeIndex = axeViolations.findIndex((v, idx) => {
      if (usedAxe.has(idx)) return false;
      if (v.selector !== selector) return false;
      return hints.includes(v.id);
    });

    if (axeIndex >= 0) {
      const axe = axeViolations[axeIndex]!;
      usedAxe.add(axeIndex);

      merged.push({
        selector,
        severity: worstSeverity(axe.severity, ai.severity),
        source: 'both',
        message: ai.message || axe.help,
        suggestion: ai.suggestion,
        confidence: ai.confidence,
        axe,
        ai,
      });
    } else {
      merged.push({
        selector,
        severity: ai.severity,
        source: 'ai',
        message: ai.message,
        suggestion: ai.suggestion,
        confidence: ai.confidence,
        ai,
      });
    }
  }

  axeViolations.forEach((axe, idx) => {
    if (usedAxe.has(idx)) return;
    merged.push({
      selector: axe.selector,
      severity: axe.severity,
      source: 'axe',
      message: axe.help,
      suggestion: axe.failureSummary,
      axe,
      confidence: 1,
    });
  });

  merged.sort((a, b) => {
    const sev = severityRank[b.severity] - severityRank[a.severity];
    if (sev !== 0) return sev;
    const confA = a.confidence ?? 0;
    const confB = b.confidence ?? 0;
    return confB - confA;
  });

  return merged;
}

function worstSeverity(a: ViolationSeverity, b: ViolationSeverity): ViolationSeverity {
  return severityRank[a] >= severityRank[b] ? a : b;
}

