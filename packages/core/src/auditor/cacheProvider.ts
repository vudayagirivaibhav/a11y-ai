import type { AIAnalysisResult, AIProvider, RuleContext } from '../types/provider.js';
import type { CacheAdapter } from '../types/cache.js';

import { sha256Hex } from '../utils/hash.js';

/**
 * Wrap an AIProvider with a cache layer keyed by:
 * - rule id
 * - element selector (if present)
 * - prompt text
 *
 * The cached value is the provider's raw response string.
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
        options.onCacheHit?.();
        return {
          findings: [],
          raw: cached,
          latencyMs: 0,
          attempts: 0,
        };
      }

      options.onCacheMiss?.();
      const result = await provider.analyze(prompt, context);
      await cache.set(key, result.raw, ttlMs);
      return result;
    },
  };
}

