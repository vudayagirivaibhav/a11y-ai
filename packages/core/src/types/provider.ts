import type { AiResponse } from './ai.js';
import type { AiRuleName } from './config.js';
import type { ElementInfo } from './results.js';

/**
 * Canonical severity levels used by AI findings.
 *
 * These align with common accessibility severity conventions and are also
 * compatible with axe-core severity-like groupings.
 */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Additional context about the rule invocation, useful for:
 * - prompt construction
 * - debugging and tracing
 * - future rule expansions (e.g., multi-element / page-level rules)
 */
export interface RuleContext {
  /** The audited page URL. */
  url: string;

  /**
   * Rule identifier currently being analyzed.
   *
   * Use built-in names where possible, but custom values are allowed.
   */
  ruleId: AiRuleName;

  /**
   * The element the rule is evaluating (when applicable).
   * Some rules may be page-level and omit this.
   */
  element?: ElementInfo;

  /** Optional HTML snapshot (full page or relevant fragment). */
  html?: string;

  /** Optional screenshot paths for vision-capable checks (e.g., contrast). */
  screenshotPaths?: string[];

  /** Free-form extension point for future rule needs. */
  metadata?: Record<string, unknown>;
}

/**
 * A single normalized AI finding.
 *
 * This is the AI counterpart to axe-core violations: model-detected issues that
 * are hard to express as deterministic rules (e.g., "link text isn't meaningful").
 */
export interface AIFinding {
  /** Identifier of the rule that produced this finding. */
  ruleId: AiRuleName;

  /** Severity classification used for summaries and CI gating. */
  severity: Severity;

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
 * Normalized output from an AI provider call.
 *
 * `raw` is preserved for auditing/debugging and to help improve parsers.
 */
export interface AIAnalysisResult {
  /** Normalized findings extracted from the provider output. */
  findings: AIFinding[];

  /** Raw provider string output (typically JSON text). */
  raw: string;

  /** End-to-end latency for the provider call (including retries). */
  latencyMs: number;

  /** How many attempts were made before success/failure. */
  attempts: number;

  /** Optional provider usage information (token counts), when available. */
  usage?: AiResponse['usage'];
}

/**
 * Provider interface used by the auditing pipeline.
 *
 * Implementations should accept a prompt + context and return a normalized
 * structured result.
 */
export interface AIProvider {
  analyze(prompt: string, context: RuleContext): Promise<AIAnalysisResult>;

  /**
   * Optional vision-capable analysis method.
   *
   * Providers that support multimodal models can implement this to evaluate an
   * image against a prompt (e.g., comparing an `<img>`'s alt text to its
   * visual content).
   *
   * If a provider does not support vision, it should throw a
   * `VisionNotSupportedError`.
   */
  analyzeImage?(imageData: Buffer | string, prompt: string, context: RuleContext): Promise<AIAnalysisResult>;
}
