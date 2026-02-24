import type { AuditResult } from '../types/audit.js';
import type { ViolationSeverity } from '../types/axe.js';

/**
 * Minimal assertion helpers for test suites and CI checks.
 *
 * This intentionally does not depend on Jest/Vitest globals.
 * It returns an object with assertion methods and throws on failure.
 */
export function expect(result: AuditResult) {
  return {
    toPassAccessibility(options: { min?: number } = {}) {
      const min = options.min ?? 70;
      if (result.summary.score < min) {
        throw new Error(
          `Accessibility score ${result.summary.score} is below threshold ${min}. Violations: ${result.mergedViolations.length}`,
        );
      }
    },

    toHaveNoViolations(severity?: ViolationSeverity) {
      const list = severity
        ? result.mergedViolations.filter((v) => v.severity === severity)
        : result.mergedViolations;
      if (list.length > 0) {
        const top = list
          .slice(0, 5)
          .map((v) => `${v.severity} ${v.category ?? ''} ${v.selector}: ${v.message}`)
          .join('\n');
        throw new Error(
          `Expected no violations${severity ? ` of severity ${severity}` : ''}, but found ${list.length}.\n${top}`,
        );
      }
    },

    toHaveNoCategoryIssues(category: string) {
      const list = result.mergedViolations.filter((v) => (v.category ?? '') === category);
      if (list.length > 0) {
        const top = list
          .slice(0, 5)
          .map((v) => `${v.severity} ${v.selector}: ${v.message}`)
          .join('\n');
        throw new Error(
          `Expected no violations in category "${category}", but found ${list.length}.\n${top}`,
        );
      }
    },
  };
}
