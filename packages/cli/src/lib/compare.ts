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
}

/**
 * Compare two `AuditResult` objects by their summary score.
 */
export function compareWith(previous: AuditResult, current: AuditResult): ScoreComparison {
  const previousScore = previous.summary.score;
  const currentScore = current.summary.score;
  const delta = currentScore - previousScore;
  const direction = delta === 0 ? 'unchanged' : delta > 0 ? 'improved' : 'regressed';
  return { previousScore, currentScore, delta, direction };
}
