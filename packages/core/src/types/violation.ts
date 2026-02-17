import type { AiIssue } from './results.js';
import type { AxeViolation, ViolationSeverity } from './axe.js';
import type { RuleResult } from '@a11y-ai/rules/types';

/**
 * Indicates where a merged violation came from.
 */
export type ViolationSource = 'axe' | 'ai' | 'both';

/**
 * Unified violation type used when combining axe-core and AI findings.
 */
export interface Violation {
  /** Category used for scoring and reporting. */
  category?: string;

  /** Element selector for the violating node (best-effort). */
  selector: string;

  /** Primary severity used for sorting and gating. */
  severity: ViolationSeverity;

  /** Source attribution for this violation. */
  source: ViolationSource;

  /** Primary message for display. */
  message: string;

  /** Suggested remediation (when available). */
  suggestion?: string;

  /** Confidence score (AI-driven), when available. */
  confidence?: number;

  /** Underlying axe violation details (when applicable). */
  axe?: AxeViolation;

  /** Underlying AI issue details (when applicable). */
  ai?: AiIssue;

  /** Underlying rule result details (when applicable). */
  rule?: RuleResult;
}

/**
 * Convenience alias for violations that include AI/rule sources.
 */
export type AIViolation = Violation & { source: 'ai' | 'both' };
