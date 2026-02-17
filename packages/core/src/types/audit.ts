import type { AxeViolation, ViolationSeverity } from './axe.js';
import type { ExtractionResult } from './extraction.js';
import type { RuleResult } from '@a11y-ai/rules/types';
import type { Violation } from './violation.js';

/**
 * WCAG compliance summary (best-effort).
 *
 * Full WCAG criterion mapping will be added in later prompts. For now, this is a
 * structured placeholder that report generators can rely on.
 */
export interface WcagComplianceSummary {
  /** Reported compliance level. */
  level: 'A' | 'AA' | 'AAA' | 'none';

  /** WCAG criteria that appear to be satisfied (best-effort). */
  passedCriteria: string[];

  /** WCAG criteria that appear to be violated (best-effort). */
  failedCriteria: string[];
}

/**
 * Per-category scoring breakdown.
 */
export interface CategoryScoreSummary {
  /** Category score in range 0..100. */
  score: number;

  /** Letter grade for the category. */
  grade: string;

  /** Number of violations in this category. */
  violationCount: number;

  /** A representative issue summary for quick scanning. */
  topIssue: string;
}

/**
 * Full scoring summary for an audit.
 */
export interface AuditSummary {
  /** Overall score (0..100). */
  score: number;

  /** Overall grade (A..F). */
  grade: string;

  /** Category breakdown keyed by category id. */
  categories: Record<string, CategoryScoreSummary>;

  /** Total merged violations. */
  totalViolations: number;

  /** Violations counted by severity. */
  bySeverity: Record<ViolationSeverity, number>;

  /** Total extracted elements analyzed (best-effort). */
  elementsAnalyzed: number;

  /** Number of AI provider calls made (after caching). */
  aiCalls: number;

  /** Best-effort token estimate across all AI prompts (if tracked). */
  estimatedTokens: number;

  /** End-to-end audit duration in milliseconds. */
  auditDurationMs: number;

  /** WCAG compliance summary (best-effort). */
  wcagCompliance: WcagComplianceSummary;
}

/**
 * Metadata captured during the audit pipeline execution.
 */
export interface AuditMetadata {
  /** Schema version for report stability. */
  schemaVersion: '1.0';

  /** ISO timestamp when the audit started. */
  startedAt: string;

  /** ISO timestamp when the audit completed. */
  completedAt: string;

  /** axe-core version used. */
  axeVersion: string;

  /** a11y-ai version used. */
  a11yAiVersion: string;

  /** Provider id (e.g., openai/anthropic/ollama/custom/mock). */
  aiProvider: string;

  /** Provider model id (when known). */
  model: string;

  /** Total duration in ms. */
  durationMs: number;

  /** Rule ids that were executed. */
  rulesExecuted: string[];

  /** Rule ids that failed. */
  rulesFailed: string[];
}

/**
 * Final output returned by the orchestrator.
 */
export interface AuditResult {
  /** Target URL if available, otherwise a synthetic identifier. */
  url: string;

  /** ISO timestamp when the audit completed. */
  timestamp: string;

  /** DOM extraction output (snapshots + metadata). */
  extraction: ExtractionResult;

  /** Normalized axe violations. */
  axeViolations: AxeViolation[];

  /** Raw rule results from the rules engine. */
  ruleResults: RuleResult[];

  /** Merged and deduplicated violations. */
  mergedViolations: Violation[];

  /** Scoring summary. */
  summary: AuditSummary;

  /** Execution metadata. */
  metadata: AuditMetadata;

  /** Captured errors (per-rule, provider, etc). */
  errors: Array<{ stage: string; message: string; cause?: unknown }>;
}
