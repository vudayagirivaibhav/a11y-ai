import type { RunOptions } from 'axe-core';

/**
 * Supported audit standards/tags for axe-core.
 *
 * These map to axe-core "tags" used in `runOnly`.
 */
export type AxeStandard =
  | 'wcag2a'
  | 'wcag2aa'
  | 'wcag2aaa'
  | 'wcag21a'
  | 'wcag21aa'
  | 'section508';

/**
 * Configuration for running axe-core.
 */
export interface AxeRunConfig {
  /**
   * Which standard/tag set to run.
   *
   * If omitted, axe's default rules apply.
   */
  standard?: AxeStandard;

  /**
   * Rule enable/disable overrides.
   *
   * This is passed through to axe as `rules`.
   */
  rules?: RunOptions['rules'];

  /**
   * CSS selectors to include (scope).
   *
   * Each selector is treated as an include region.
   */
  include?: string[];

  /**
   * CSS selectors to exclude (scope).
   *
   * Each selector is treated as an exclude region.
   */
  exclude?: string[];

  /**
   * Per-run timeout (ms) enforced by axe-core.
   */
  timeout?: number;
}

/**
 * Severity levels used for normalized violations.
 */
export type ViolationSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * A single normalized axe-core violation tied to a specific element.
 */
export interface AxeViolation {
  /** axe rule id (e.g., `image-alt`, `color-contrast`). */
  id: string;

  /** Normalized severity. */
  severity: ViolationSeverity;

  /** Human-readable help text. */
  help: string;

  /** Link to axe documentation for this rule. */
  helpUrl: string;

  /** Description of the rule. */
  description: string;

  /** Element selector for the violating node (best-effort). */
  selector: string;

  /** Node HTML snippet. */
  html: string;

  /** Optional summary of why the node failed. */
  failureSummary?: string;

  /** Tags associated with the violation (standards, categories). */
  tags: string[];

  /**
   * Category tag (best-effort), derived from tags like `cat.*`.
   *
   * Useful for grouping violations in reports.
   */
  category?: string;
}

