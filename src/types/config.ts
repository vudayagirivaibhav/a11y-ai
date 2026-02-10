import type * as axe from 'axe-core';

import type { AiHandler } from './ai.js';

/**
 * Names of the AI-augmented checks that `a11y-ai` can run.
 *
 * These are intentionally stable string literals so consumers can:
 * - filter which AI rules to run (include/exclude)
 * - aggregate results by rule name
 * - build UI mappings / docs without guessing
 */
export type AiRuleName =
  | 'alt-text-quality'
  | 'link-text-quality'
  | 'contrast-analysis'
  | 'form-label-relevance';

/**
 * Optional rule filtering for AI checks.
 *
 * If both `include` and `exclude` are provided, `exclude` wins for overlaps.
 */
export type RuleFilter = {
  include?: AiRuleName[];
  exclude?: AiRuleName[];
};

/**
 * Configuration for the AI provider used to analyze accessibility context.
 *
 * Most providers use `apiKey` + `model` (+ optional `baseUrl`).
 * If `provider` is `custom`, pass `customHandler` and ignore other fields.
 */
export type AiProviderConfig = {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  customHandler?: AiHandler;
};

/**
 * Top-level configuration for running an audit.
 *
 * Provide either:
 * - `url` to have the auditor load a remote page, or
 * - `html` to audit a static HTML string.
 *
 * Future phases will add the runner that actually loads pages and invokes axe.
 */
export interface A11yAiConfig {
  /** Page URL to load and audit. Prefer this for real-world audits. */
  url?: string;

  /** Static HTML to audit (no navigation). Useful for unit tests and snapshots. */
  html?: string;

  /** Options passed through to `axe.run()` when executing rule-based checks. */
  axeOptions?: axe.RunOptions;

  /** AI provider configuration (required). */
  aiProvider: AiProviderConfig;

  /** Optional filter for which AI rules to run. */
  rules?: RuleFilter;

  /** Max number of concurrent AI calls (and/or page tasks, depending on runner). */
  concurrency?: number;

  /** Audit timeout in milliseconds. */
  timeout?: number;

  /** Optional viewport size for page rendering (in CSS pixels). */
  viewport?: { width: number; height: number };

  /**
   * Optional directory to write screenshots into (if the runner captures them).
   * Useful for debugging contrast and visual issues.
   */
  screenshotDir?: string;
}
