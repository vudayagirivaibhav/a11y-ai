import type { AiProviderConfig } from '../types/config.js';
import type { AxeRunConfig } from '../types/axe.js';
import type { CacheAdapter } from '../types/cache.js';
import type { DOMExtractorOptions } from '../extraction/DOMExtractor.js';

import type { AuditConfig as RulesEngineConfig } from '@a11y-ai/rules';

/**
 * Top-level audit configuration used by the orchestrator.
 *
 * This intentionally composes smaller configs:
 * - AI provider config
 * - extraction options
 * - axe runner config
 * - rules engine config
 * - timeouts + caching
 */
export interface AuditConfig extends RulesEngineConfig {
  /** AI provider configuration used for AI rule evaluation. */
  aiProvider: AiProviderConfig;

  /** DOM extraction options. */
  extraction?: DOMExtractorOptions;

  /** axe-core execution options. */
  axe?: AxeRunConfig;

  /** Overall audit timeout (ms). Default: 5 minutes. */
  overallTimeoutMs?: number;

  /** Cache adapter for AI response caching. Default: in-memory. */
  cache?: CacheAdapter;

  /** Cache TTL for AI responses (ms). Default: 1 hour. */
  cacheTtlMs?: number;

  /**
   * Enable AI response caching.
   *
   * Useful in CI where the same page is audited repeatedly.
   */
  cacheEnabled?: boolean;
}

/**
 * Typed events emitted by the auditor.
 */
export type AuditorEvents =
  | { type: 'start'; target: string }
  | { type: 'axe:complete'; violationCount: number }
  | { type: 'rule:start'; ruleId: string }
  | { type: 'rule:complete'; ruleId: string; resultCount: number }
  | { type: 'complete'; score: number; violationCount: number };

