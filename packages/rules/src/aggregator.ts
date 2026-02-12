import type { AIProvider } from 'a11y-ai';
import type { ExtractionResult } from 'a11y-ai';

import type { AuditConfig, Rule, RuleContext, RuleRunResult, RuleResult } from './types.js';

import { RuleRegistry } from './RuleRegistry.js';

const DEFAULT_RULE_TIMEOUT_MS = 60_000;
const DEFAULT_PARALLELISM = 4;

/**
 * Run all enabled rules and aggregate results.
 *
 * - Rules run concurrently up to `parallelism`
 * - Each rule gets a hard timeout (default 60s)
 * - Errors from one rule do not prevent others from completing
 */
export async function runRules(options: {
  /** Extraction output for the audited page. */
  extraction: ExtractionResult;

  /** Provider used for AI calls (some rules may not call it). */
  provider: AIProvider;

  /** Rules engine configuration. */
  config?: AuditConfig;

  /** Registry to use; defaults to the global singleton. */
  registry?: RuleRegistry;
}): Promise<RuleRunResult> {
  const registry = options.registry ?? RuleRegistry.getInstance();
  const config: AuditConfig = options.config ?? {};

  const rules = registry.enabledRules(config);
  const parallelism = Math.max(1, config.parallelism ?? DEFAULT_PARALLELISM);
  const timeoutMs = Math.max(1, config.ruleTimeoutMs ?? DEFAULT_RULE_TIMEOUT_MS);

  const results: RuleResult[] = [];
  const errors: RuleRunResult['errors'] = [];

  const queue = rules.slice();
  const workers = Array.from({ length: Math.min(parallelism, queue.length) }, () =>
    workerLoop(queue, async (rule) => {
      try {
        const context = makeRuleContext(rule, options.extraction, config);
        const ruleResults = await withTimeout(rule.evaluate(context, options.provider), timeoutMs);
        results.push(...ruleResults);
      } catch (error) {
        errors.push({ ruleId: rule.id, error });
      }
    }),
  );

  await Promise.all(workers);
  return { results, errors };
}

function makeRuleContext(rule: Rule, extraction: ExtractionResult, config: AuditConfig): RuleContext {
  return {
    url: extraction.url ?? 'about:blank',
    ruleId: rule.id as unknown as RuleContext['ruleId'],
    extraction,
    config,
    metadata: {
      category: rule.category,
      description: rule.description,
    },
  };
}

async function workerLoop<T>(queue: T[], fn: (item: T) => Promise<void>): Promise<void> {
  while (true) {
    const next = queue.shift();
    if (!next) return;
    // eslint-disable-next-line no-await-in-loop
    await fn(next);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error(`Rule timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}

