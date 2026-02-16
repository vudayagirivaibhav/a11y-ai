import type { AuditResult } from 'a11y-ai';

export interface ScoreComparison {
  previousScore: number;
  currentScore: number;
  delta: number;
  direction: 'improved' | 'regressed' | 'unchanged';
}

export function compareWith(previous: AuditResult, current: AuditResult): ScoreComparison {
  const previousScore = previous.summary.score;
  const currentScore = current.summary.score;
  const delta = currentScore - previousScore;
  const direction = delta === 0 ? 'unchanged' : delta > 0 ? 'improved' : 'regressed';
  return { previousScore, currentScore, delta, direction };
}

