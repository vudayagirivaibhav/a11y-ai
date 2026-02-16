import type { AuditSummary } from '../types/audit.js';
import type { ExtractionResult } from '../types/extraction.js';
import type { Violation } from '../types/violation.js';
import type { ViolationSeverity } from '../types/axe.js';

/**
 * Input to the scoring engine.
 */
export interface ScoreInput {
  /** Unified, merged violations list. */
  mergedViolations: Violation[];

  /** Extraction output for element counts / heuristics. */
  extraction: ExtractionResult;

  /** Number of AI calls used during the audit. */
  aiCalls: number;

  /** Audit start timestamp (ms since epoch). */
  startedAt: number;
}

const severityPenalty: Record<ViolationSeverity, number> = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 1,
};

/**
 * Accessibility scoring engine.
 *
 * This is intentionally deterministic and explainable:
 * - Start at 100
 * - Deduct points per violation based on severity, confidence, and importance
 * - Apply diminishing returns for repeated issues within the same category
 */
export class AccessibilityScorer {
  score(input: ScoreInput): AuditSummary {
    const startedAt = input.startedAt;
    const duration = Math.max(0, Date.now() - startedAt);

    const bySeverity: Record<ViolationSeverity, number> = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
    };

    const perCategoryCounts: Record<string, number> = {};
    const perCategoryPenalty: Record<string, number> = {};
    const perCategoryTopIssue: Record<string, string> = {};

    let totalPenalty = 0;
    let estimatedTokens = 0;

    for (const v of input.mergedViolations) {
      bySeverity[v.severity] += 1;
      const category = v.category ?? 'uncategorized';
      perCategoryCounts[category] = (perCategoryCounts[category] ?? 0) + 1;

      const base = severityPenalty[v.severity];
      const confidence = clamp01(v.confidence ?? 1);
      const importance = estimateImportance(v);
      const diminishing = diminishingFactor(perCategoryCounts[category]!);

      const penalty = base * confidence * importance * diminishing;
      totalPenalty += penalty;
      perCategoryPenalty[category] = (perCategoryPenalty[category] ?? 0) + penalty;

      if (!perCategoryTopIssue[category]) {
        perCategoryTopIssue[category] = v.message;
      }

      // Best-effort token estimate: use message/suggestion size as proxy.
      estimatedTokens += Math.ceil((v.message.length + (v.suggestion?.length ?? 0)) / 4);
    }

    const score = clamp0to100(Math.round(100 - totalPenalty));
    const grade = toGrade(score);

    const categories: AuditSummary['categories'] = {};
    for (const [category, count] of Object.entries(perCategoryCounts)) {
      const catPenalty = perCategoryPenalty[category] ?? 0;
      const catScore = clamp0to100(Math.round(100 - catPenalty));
      categories[category] = {
        score: catScore,
        grade: toGrade(catScore),
        violationCount: count,
        topIssue: perCategoryTopIssue[category] ?? '',
      };
    }

    const elementsAnalyzed =
      input.extraction.images.length +
      input.extraction.links.length +
      input.extraction.forms.reduce((sum, f) => sum + f.fields.length, 0) +
      input.extraction.headings.length +
      input.extraction.ariaElements.length;

    return {
      score,
      grade,
      categories,
      totalViolations: input.mergedViolations.length,
      bySeverity,
      elementsAnalyzed,
      aiCalls: input.aiCalls,
      estimatedTokens,
      auditDurationMs: duration,
      wcagCompliance: {
        level: 'none',
        passedCriteria: [],
        failedCriteria: [],
      },
    };
  }
}

function toGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clamp0to100(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Apply diminishing returns per category:
 * - first 9 issues have full impact
 * - issues 10+ have reduced impact (half)
 */
function diminishingFactor(categoryCount: number): number {
  return categoryCount <= 9 ? 1 : 0.5;
}

/**
 * Best-effort importance weighting.
 *
 * This is intentionally heuristic. Later prompts can refine this using:
 * - landmark regions
 * - viewport position
 * - semantic roles
 */
function estimateImportance(v: Violation): number {
  const sel = v.selector.toLowerCase();
  if (sel.includes('footer')) return 0.7;
  if (sel.includes('nav') || sel.includes('header')) return 1.2;

  const html = v.axe?.html?.toLowerCase() ?? v.rule?.element.html?.toLowerCase() ?? '';
  if (html.includes('<input') || html.includes('<select') || html.includes('<textarea')) return 1.5;
  if (html.includes('<button')) return 1.3;

  return 1;
}

