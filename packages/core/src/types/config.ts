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
export const BUILTIN_AI_RULES = [
  'alt-text-quality',
  'link-text-quality',
  'contrast-analysis',
  'form-label-relevance',
] as const;

/**
 * Rule name identifier for AI checks.
 *
 * Includes known built-ins (for autocomplete) but remains open to custom/3rd-party
 * rule names so we can expand without breaking existing consumers.
 */
export type AiRuleName = (typeof BUILTIN_AI_RULES)[number] | (string & {});

/**
 * Optional rule filtering for AI checks.
 *
 * If both `include` and `exclude` are provided, `exclude` wins for overlaps.
 */
export type RuleFilter = {
  /** Explicit allow-list of AI rule names to run. */
  include?: AiRuleName[];

  /** Explicit deny-list of AI rule names to skip. */
  exclude?: AiRuleName[];
};

/**
 * Configuration for the AI provider used to analyze accessibility context.
 *
 * Most providers use `apiKey` + `model` (+ optional `baseUrl`).
 * If `provider` is `custom`, pass `customHandler` and ignore other fields.
 */
export type AiProviderConfig = {
  /** Which provider implementation to use. */
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';

  /** Provider API key (if required). */
  apiKey?: string;

  /** Provider model identifier (e.g., "gpt-4o-mini"). */
  model?: string;

  /** Base URL override for self-hosted / proxy setups. */
  baseUrl?: string;

  /**
   * Custom handler for advanced integrations.
   *
   * When `provider: "custom"`, the runtime should call this handler instead of
   * using a built-in SDK / HTTP adapter.
   */
  customHandler?: AiHandler;

  /**
   * Per-request timeout for provider calls in milliseconds.
   *
   * Defaults are defined by the provider layer (typically 30s).
   */
  timeoutMs?: number;

  /**
   * Requests-per-minute rate limit for the provider client.
   *
   * This is a client-side limiter to avoid accidental bursts; it does not
   * replace provider-side limits.
   */
  rpm?: number;

  /**
   * Maximum number of attempts for a single AI call (including the first).
   *
   * Defaults are defined by the provider layer (typically 3).
   */
  maxRetries?: number;

  /**
   * Optional system prompt that is prepended to every provider call.
   *
   * This is useful to enforce a consistent JSON output format across requests.
   */
  systemPrompt?: string;
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
  viewport?: ViewportSize;

  /**
   * Optional directory to write screenshots into (if the runner captures them).
   * Useful for debugging contrast and visual issues.
   */
  screenshotDir?: string;
}

/**
 * Viewport dimensions for rendering a page during an audit.
 */
export interface ViewportSize {
  /** Viewport width in CSS pixels. */
  width: number;

  /** Viewport height in CSS pixels. */
  height: number;
}
