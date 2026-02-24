import type { AuditResult } from './audit.js';
import type { Violation } from './violation.js';

/**
 * A single page audit outcome within a batch run.
 *
 * A batch run is best-effort: one failing page should not prevent other pages
 * from being audited.
 */
export interface BatchPageResult {
  /** The input target provided to the batch auditor (URL/HTML identifier). */
  target: string;

  /** The audited page URL when available. */
  url?: string;

  /** Audit result when the page completed successfully. */
  result?: AuditResult;

  /** Error information when the page failed. */
  error?: { message: string; cause?: unknown };

  /** Duration for this page audit in milliseconds. */
  durationMs: number;
}

/**
 * Aggregate batch summary intended for dashboards and CI gating.
 */
export interface BatchAuditSummary {
  /** Number of pages attempted. */
  totalPages: number;

  /** Number of pages that completed successfully. */
  succeeded: number;

  /** Number of pages that failed. */
  failed: number;

  /** Average score across successful pages (0..100). */
  averageScore: number;

  /** Lowest scoring pages (up to a small fixed list). */
  worstPages: Array<{ target: string; score: number }>;

  /**
   * Most common merged violations across the site.
   *
   * Key is derived from either the rule id (AI) or axe rule id.
   */
  mostCommonIssues: Array<{
    key: string;
    countPages: number;
    countTotal: number;
    example: Violation;
  }>;

  /**
   * Issues that appear on more than half of audited pages.
   *
   * This is a quick heuristic for "site-wide" problems.
   */
  siteWideIssues: Array<{ key: string; countPages: number; example: Violation }>;
}

/**
 * Final output returned by `BatchAuditor`.
 */
export interface BatchAuditResult {
  /** ISO timestamp when the batch started. */
  startedAt: string;

  /** ISO timestamp when the batch completed. */
  completedAt: string;

  /** Per-page results in completion order. */
  pages: BatchPageResult[];

  /** Aggregate summary across pages. */
  summary: BatchAuditSummary;
}
