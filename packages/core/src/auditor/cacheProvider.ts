/**
 * AI response caching layer for the auditor.
 *
 * Caches complete AI analysis results (findings, raw response, token usage)
 * to avoid redundant API calls for identical prompts. This is particularly
 * valuable during development and for repeated audits of similar content.
 *
 * @module cacheProvider
 */
import type { AIAnalysisResult, AIProvider, RuleContext } from '../types/provider.js';
import type { CacheAdapter } from '../types/cache.js';

import { sha256Hex } from '../utils/hash.js';

/**
 * Structure stored in the cache.
 * Includes all data needed to reconstruct an AIAnalysisResult.
 */
interface CachedAIResult {
  findings: AIAnalysisResult['findings'];
  raw: string;
  usage?: AIAnalysisResult['usage'];
}

/**
 * Serialize an AI result for cache storage.
 */
function serializeResult(result: AIAnalysisResult): string {
  const cached: CachedAIResult = {
    findings: result.findings,
    raw: result.raw,
    usage: result.usage,
  };
  return JSON.stringify(cached);
}

/**
 * Deserialize a cached AI result.
 * Returns null if the cached data is invalid or corrupted.
 */
function deserializeResult(cached: string): AIAnalysisResult | null {
  try {
    const parsed = JSON.parse(cached) as CachedAIResult;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.raw !== 'string') return null;
    return {
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      raw: parsed.raw,
      latencyMs: 0,
      attempts: 0,
      usage: parsed.usage,
    };
  } catch {
    return null;
  }
}

/**
 * Wrap an AIProvider with a cache layer keyed by:
 * - rule id
 * - element selector (if present)
 * - prompt text
 *
 * The cached value includes the full AIAnalysisResult (findings + raw + usage).
 */
export function withAiResponseCache(options: {
  provider: AIProvider;
  cache: CacheAdapter;
  ttlMs: number;
  onCacheHit?: () => void;
  onCacheMiss?: () => void;
}): AIProvider {
  const { provider, cache, ttlMs } = options;

  return {
    async analyze(prompt: string, context: RuleContext): Promise<AIAnalysisResult> {
      const selector = context.element?.selector ?? '';
      const key = sha256Hex([context.ruleId, selector, prompt].join('\n---\n'));

      const cached = await cache.get(key);
      if (cached !== undefined) {
        const deserialized = deserializeResult(cached);
        if (deserialized) {
          options.onCacheHit?.();
          return deserialized;
        }
      }

      options.onCacheMiss?.();
      const result = await provider.analyze(prompt, context);
      await cache.set(key, serializeResult(result), ttlMs);
      return result;
    },
  };
}
