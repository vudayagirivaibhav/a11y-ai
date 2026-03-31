import type { AuditResult } from '@a11y-ai/core';

/**
 * Comparison between two audit runs.
 */
export interface ScoreComparison {
  /** Score from the previous report. */
  previousScore: number;

  /** Score from the current report. */
  currentScore: number;

  /** `currentScore - previousScore`. */
  delta: number;

  /** High-level direction derived from `delta`. */
  direction: 'improved' | 'regressed' | 'unchanged';

  /** Change in total violation count (negative = fewer violations = improvement). */
  violationsDelta: number;
}

/**
 * Compare two `AuditResult` objects by their summary score and violation counts.
 */
export function compareWith(
  previous: Partial<AuditResult>,
  current: Partial<AuditResult>,
): ScoreComparison {
  const previousScore = previous.summary?.score ?? 0;
  const currentScore = current.summary?.score ?? 0;
  const delta = currentScore - previousScore;
  const direction = delta === 0 ? 'unchanged' : delta > 0 ? 'improved' : 'regressed';

  const previousViolations = previous.mergedViolations?.length ?? 0;
  const currentViolations = current.mergedViolations?.length ?? 0;
  const violationsDelta = currentViolations - previousViolations;

  return { previousScore, currentScore, delta, direction, violationsDelta };
}
