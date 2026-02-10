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
  /** Identifier of the rule that produced this issue. */
  rule: AiRuleName;

  /** Severity classification used for summaries and CI gating. */
  severity: 'critical' | 'serious' | 'moderate' | 'minor';

  /** Element information (best-effort) for pinpointing the issue. */
  element: ElementInfo;

  /** Human-readable description of the issue. */
  message: string;

  /** Actionable remediation guidance. */
  suggestion: string;

  /** Confidence score in range 0..1. */
  confidence: number;

  /** Optional structured metadata for debugging or UIs. */
  context?: Record<string, unknown>;
}

/**
 * Summary fields intended for quick reporting / badges / CI gating.
 */
export type AuditSummary = {
  /** Total number of issues across axe + AI (as defined by the runner). */
  totalIssues: number;

  /** Issue counts keyed by severity string. */
  bySeverity: Record<string, number>;

  /** Issue counts keyed by rule identifier. */
  byRule: Record<string, number>;

  /** Normalized score, typically 0..100 (the scoring algorithm is runner-defined). */
  score: number;
};

/**
 * Metadata about the run for debugging and reproducibility.
 */
export type AuditMetadata = {
  /** Total audit duration in milliseconds. */
  duration: number;

  /** Provider identifier (e.g., "openai", "anthropic"). */
  aiProvider: string;

  /** Provider model identifier (e.g., "gpt-4o-mini"). */
  model: string;

  /** axe-core version used for rule-based auditing. */
  axeVersion: string;

  /** a11y-ai package version used to produce the result. */
  a11yAiVersion: string;
};

/**
 * The top-level result returned by `a11y-ai`.
 *
 * `timestamp` should be an ISO 8601 string (e.g., new Date().toISOString()).
 */
export interface A11yAiResult {
  /** Audited page URL (or a synthetic identifier when auditing raw HTML). */
  url: string;

  /** ISO 8601 timestamp when the audit completed. */
  timestamp: string;

  /** Raw axe-core results for deterministic rule-based checks. */
  axeResults: AxeResults;

  /** AI-derived issues produced by AI rules (alt text, link text, etc.). */
  aiResults: AiIssue[];

  /** Quick summary for reporting / CI gating. */
  summary: AuditSummary;

  /** Metadata useful for debugging and reproducibility. */
  metadata: AuditMetadata;
}
