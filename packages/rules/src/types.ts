import type { AIProvider, RuleContext as CoreRuleContext, Severity } from '@a11y-ai/core/types';
import type { ElementSnapshot, ExtractionResult } from '@a11y-ai/core/types';

/**
 * High-level categories for grouping rule results.
 *
 * This is intentionally open-ended to allow custom/community rules to define
 * new categories without needing a core release.
 */
export type ViolationCategory =
  | 'alt-text'
  | 'link-text'
  | 'contrast'
  | 'form-labels'
  | 'structure'
  | 'aria'
  | (string & {});

/**
 * Configuration for the rules engine.
 *
 * This type will be expanded in later prompts (presets, vision, per-rule config).
 */
export interface AuditConfig {
  /**
   * Enable vision-capable checks when the selected provider supports them.
   *
   * Defaults to `false` to avoid unexpected costs.
   */
  vision?: boolean;

  /**
   * Maximum number of images to send to a vision model per audit.
   *
   * Vision calls can be expensive; this cap provides a predictable upper bound.
   */
  maxVisionImages?: number;

  /**
   * Per-rule configuration map. Keys are rule ids.
   *
   * If a rule has `{ enabled: false }`, it will be skipped.
   */
  rules?: Record<
    string,
    {
      /** Whether this rule should run. Defaults to `true` when omitted. */
      enabled?: boolean;

      /**
       * Whether this rule should use vision (if available).
       *
       * If omitted, the rule falls back to the top-level `vision` flag.
       */
      vision?: boolean;

      /** Optional batch size override (for rules that support batching). */
      batchSize?: number;

      /** Optional rule-specific settings. */
      settings?: Record<string, unknown>;
    }
  >;

  /** Maximum number of rules to run concurrently. */
  parallelism?: number;

  /** Per-rule timeout in milliseconds. */
  ruleTimeoutMs?: number;
}

/**
 * Rules-engine context passed to each rule.
 *
 * Extends the provider-facing `RuleContext` with extracted DOM snapshots and
 * the active audit configuration.
 */
export interface RuleContext extends CoreRuleContext {
  /** Full extraction output for the audited page. */
  extraction: ExtractionResult;

  /** Current audit configuration (for per-rule settings). */
  config: AuditConfig;
}

/**
 * Result emitted by a rule.
 */
export interface RuleResult {
  /** Rule identifier (e.g., `ai/alt-text-quality`). */
  ruleId: string;

  /** Category grouping used in reports. */
  category: ViolationCategory;

  /** Severity for sorting and CI gating. */
  severity: Severity;

  /** The element this result refers to. */
  element: ElementSnapshot;

  /** Human-readable description of the issue. */
  message: string;

  /** Actionable remediation guidance. */
  suggestion: string;

  /** Confidence score in range 0..1. */
  confidence: number;

  /** Whether this came from deterministic heuristics or from AI output. */
  source: 'static' | 'ai';

  /** Optional structured metadata for debugging or UIs. */
  context?: Record<string, unknown>;
}

/**
 * Interface all rules must implement.
 */
export interface Rule {
  /** Stable identifier for registration, filtering, and config keys. */
  id: string;

  /** Category for grouping in reports. */
  category: ViolationCategory;

  /** Short human-readable description of what this rule checks. */
  description: string;

  /** Default severity used when a rule does not specify one per-result. */
  severity: Severity;

  /**
   * Whether this rule typically requires AI calls to be useful.
   *
   * Many rules also have a static "cheap" mode; this flag is used for metadata
   * and presets (it is not a hard requirement).
   */
  requiresAI?: boolean;

  /**
   * Whether this rule can use vision-capable provider APIs.
   */
  supportsVision?: boolean;

  /**
   * Best-effort display hint for the expected cost per run.
   *
   * This is intentionally a string so providers can describe cost in their own
   * terms (tokens, requests, etc).
   */
  estimatedCost?: string;

  /**
   * Evaluate the rule against a page context.
   *
   * Rules may produce multiple results (one per element, or multiple per element).
   */
  evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]>;
}

/**
 * Metadata describing a registered rule.
 */
export interface RuleInfo {
  /** Rule id. */
  id: string;

  /** Category grouping. */
  category: ViolationCategory;

  /** Rule description. */
  description: string;

  /** Whether the rule requires AI calls to be useful. */
  requiresAI: boolean;

  /** Best-effort cost estimate for a typical run (string for display). */
  estimatedCost?: string;
}

/**
 * Output from running a set of rules.
 */
export interface RuleRunResult {
  /** All successful rule results. */
  results: RuleResult[];

  /** Rule ids that failed and their errors. */
  errors: Array<{ ruleId: string; error: unknown }>;
}
