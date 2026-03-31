import type { AIAnalysisResult, AIProvider, RuleContext } from '../types/provider.js';
import type { CacheAdapter } from '../types/cache.js';

import { sha256Hex } from '../utils/hash.js';

interface CachedAIResult {
  findings: AIAnalysisResult['findings'];
  raw: string;
  usage?: AIAnalysisResult['usage'];
}

function serializeResult(result: AIAnalysisResult): string {
  const cached: CachedAIResult = {
    findings: result.findings,
    raw: result.raw,
    usage: result.usage,
  };
  return JSON.stringify(cached);
}

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
