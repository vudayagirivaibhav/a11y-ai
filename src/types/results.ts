import type { AxeResults } from 'axe-core';

import type { AiRuleName } from './config.js';

/**
 * Minimal representation of the DOM element that an issue relates to.
 *
 * `selector` is intended to be a stable, queryable selector (best-effort).
 * `html` is the element's outerHTML (or a trimmed version provided by the runner).
 */
export type ElementInfo = {
  /** Best-effort CSS selector that identifies the element in the document. */
  selector: string;

  /** Serialized HTML for the target element (typically outerHTML). */
  html: string;

  /** Uppercased/lowercased tag name as returned by the runner (e.g., "img", "a"). */
  tagName: string;

  /** Element attributes captured at audit time. */
  attributes: Record<string, string>;
};

/**
 * A single AI-detected issue. These are complementary to axe-core violations.
 *
 * `confidence` is a 0..1 score representing how confident the model is
 * (or how confident the system is in the model's output).
 */
export interface AiIssue {
  rule: AiRuleName;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element: ElementInfo;
  message: string;
  suggestion: string;
  confidence: number;
  context?: Record<string, unknown>;
}

/**
 * Summary fields intended for quick reporting / badges / CI gating.
 */
export type AuditSummary = {
  totalIssues: number;
  bySeverity: Record<string, number>;
  byRule: Record<string, number>;
  score: number;
};

/**
 * Metadata about the run for debugging and reproducibility.
 */
export type AuditMetadata = {
  /** Total audit duration in milliseconds. */
  duration: number;
  aiProvider: string;
  model: string;
  axeVersion: string;
  a11yAiVersion: string;
};

/**
 * The top-level result returned by `a11y-ai`.
 *
 * `timestamp` should be an ISO 8601 string (e.g., new Date().toISOString()).
 */
export interface A11yAiResult {
  url: string;
  timestamp: string;
  axeResults: AxeResults;
  aiResults: AiIssue[];
  summary: AuditSummary;
  metadata: AuditMetadata;
}
