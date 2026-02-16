import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

import type { AIProvider } from '../types/provider.js';
import type { AuditResult } from '../types/audit.js';
import type { ExtractionResult } from '../types/extraction.js';

import { createAIProvider } from '@a11y-ai/ai-providers';
import { registerBuiltinRules, RuleRegistry } from '@a11y-ai/rules';
import type { Rule } from '@a11y-ai/rules';
import type { RuleResult } from '@a11y-ai/rules';

import { AxeRunner } from '../axe/AxeRunner.js';
import { DOMExtractor } from '../extraction/DOMExtractor.js';

import { MemoryCacheAdapter } from '../utils/cache.js';
import { AccessibilityScorer } from '../scoring/AccessibilityScorer.js';

import type { AuditConfig } from './types.js';
import { withAiResponseCache } from './cacheProvider.js';
import { mergeAxeAndRuleResults } from './merge.js';

const DEFAULT_OVERALL_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_CACHE_TTL_MS = 60 * 60_000;

/**
 * Main audit orchestrator. This is the programmatic API entry point.
 *
 * The auditor emits progress events and returns a structured `AuditResult`.
 */
export class A11yAuditor extends EventEmitter {
  private readonly config: AuditConfig;

  constructor(config: AuditConfig) {
    super();
    this.config = config;
  }

  /**
   * Audit a target that can be:
   * - URL string
   * - raw HTML string
   * - URL instance
   * - HTMLElement-like object (best-effort; mostly for jsdom usage)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async audit(target: string | URL | any): Promise<AuditResult> {
    if (typeof target === 'string') {
      const trimmed = target.trim();
      if (looksLikeHtml(trimmed)) return await this.auditHTML(trimmed);
      if (looksLikeUrl(trimmed)) return await this.auditURL(trimmed);
      // Default: treat as URL if it parses, otherwise as HTML.
      return await this.auditURL(trimmed);
    }

    if (target instanceof URL) {
      return await this.auditURL(target.toString());
    }

    if (target && typeof target === 'object' && typeof target.outerHTML === 'string') {
      return await this.auditHTML(target.outerHTML);
    }

    throw new Error('Unsupported audit target');
  }

  /**
   * Audit a raw HTML string.
   */
  async auditHTML(html: string): Promise<AuditResult> {
    return await this.runPipeline({ html });
  }

  /**
   * Audit a URL.
   */
  async auditURL(url: string): Promise<AuditResult> {
    return await this.runPipeline({ url });
  }

  private async runPipeline(input: { html?: string; url?: string }): Promise<AuditResult> {
    const startedAt = Date.now();
    const startedIso = new Date(startedAt).toISOString();
    const target = input.url ?? 'inline-html';

    this.emit('start', target);

    const errors: AuditResult['errors'] = [];
    const overallTimeoutMs = this.config.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;

    const result = await withTimeout(
      this.runPipelineUnsafe(input, startedAt, startedIso, errors),
      overallTimeoutMs,
    ).catch((error) => {
      errors.push({ stage: 'audit', message: 'Audit failed', cause: error });
      throw error;
    });

    return { ...result, errors };
  }

  private async runPipelineUnsafe(
    input: { html?: string; url?: string },
    startedAt: number,
    startedIso: string,
    errors: AuditResult['errors'],
  ): Promise<Omit<AuditResult, 'errors'>> {
    const registry = RuleRegistry.create();
    registerBuiltinRules(registry);

    const providerBase = createAIProvider(this.config.aiProvider);
    const cacheEnabled = this.config.cacheEnabled !== false;
    const cache = this.config.cache ?? new MemoryCacheAdapter();
    const cacheTtlMs = this.config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

    let aiCalls = 0;
    const provider: AIProvider = cacheEnabled
      ? withAiResponseCache({
          provider: providerBase,
          cache,
          ttlMs: cacheTtlMs,
          onCacheMiss: () => {
            aiCalls += 1;
          },
        })
      : providerBase;

    // Step 2: Extract DOM
    const extractor = input.html
      ? new DOMExtractor({ html: input.html }, this.config.extraction)
      : new DOMExtractor({ url: input.url! }, this.config.extraction);

    const extraction = await extractor.extractAll();

    // Step 3: Run axe-core in parallel with rule execution
    const axeRunner = new AxeRunner();
    const axePromise = (async () => {
      try {
        const htmlForAxe = input.html ?? extraction.rawHTML;
        return await axeRunner.run(htmlForAxe, this.config.axe);
      } catch (error) {
        errors.push({ stage: 'axe', message: 'axe-core failed', cause: error });
        return [];
      }
    })().then((violations) => {
      this.emit('axe:complete', violations);
      return violations;
    });

    // Step 4 + 5: Execute AI rules with progress events
    const enabledRules = registry.enabledRules(this.config);
    const ruleResults: RuleResult[] = [];
    const rulesFailed: string[] = [];

    await this.runRulesWithProgress(enabledRules, extraction, provider, ruleResults, rulesFailed, errors);

    const axeViolations = await axePromise;

    // Step 6: Merge + dedupe
    const mergedViolations = mergeAxeAndRuleResults({ axeViolations, ruleResults });

    // Step 7: Score
    const scorer = new AccessibilityScorer();
    const summary = scorer.score({
      mergedViolations,
      extraction,
      aiCalls,
      startedAt,
    });

    const completedAt = Date.now();
    const completedIso = new Date(completedAt).toISOString();

    // Step 8: Format final result
    const a11yAiVersion = resolvePackageVersionSafe();
    const axeVersion = resolveAxeVersionSafe();

    const auditResult: Omit<AuditResult, 'errors'> = {
      url: extraction.url ?? input.url ?? 'about:blank',
      timestamp: completedIso,
      extraction,
      axeViolations,
      ruleResults,
      mergedViolations,
      summary,
      metadata: {
        schemaVersion: '1.0',
        startedAt: startedIso,
        completedAt: completedIso,
        axeVersion,
        a11yAiVersion,
        aiProvider: this.config.aiProvider.provider,
        model: this.config.aiProvider.model ?? '',
        durationMs: completedAt - startedAt,
        rulesExecuted: enabledRules.map((r) => r.id),
        rulesFailed,
      },
    };

    this.emit('complete', auditResult);

    return auditResult;
  }

  private async runRulesWithProgress(
    rules: Rule[],
    extraction: ExtractionResult,
    provider: AIProvider,
    outResults: RuleResult[],
    outFailed: string[],
    outErrors: AuditResult['errors'],
  ): Promise<void> {
    const parallelism = Math.max(1, this.config.parallelism ?? 3);
    const timeoutMs = Math.max(1, this.config.ruleTimeoutMs ?? 60_000);
    const queue = rules.slice();

    const workers = Array.from({ length: Math.min(parallelism, queue.length) }, () =>
      workerLoop(queue, async (rule) => {
        this.emit('rule:start', rule.id);

        try {
          const context = {
            url: extraction.url ?? 'about:blank',
            ruleId: rule.id as unknown as string,
            extraction,
            config: this.config,
          };

          const results = await withTimeout(rule.evaluate(context as never, provider), timeoutMs);
          outResults.push(...results);
          this.emit('rule:complete', rule.id, results);
        } catch (error) {
          outFailed.push(rule.id);
          outErrors.push({ stage: 'rule', message: `Rule failed: ${rule.id}`, cause: error });
          this.emit('rule:complete', rule.id, []);
        }
      }),
    );

    await Promise.all(workers);
  }

  // EventEmitter API is used directly:
  // - start(target)
  // - axe:complete(axeViolations)
  // - rule:start(ruleId)
  // - rule:complete(ruleId, results)
  // - complete(auditResult)
}

function looksLikeHtml(text: string): boolean {
  return text.startsWith('<') && text.includes('>');
}

function looksLikeUrl(text: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(text);
    return true;
  } catch {
    return false;
  }
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
    handle = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}

function resolvePackageVersionSafe(): string {
  try {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pkg = require('../../package.json');
    return typeof pkg?.version === 'string' ? pkg.version : '';
  } catch {
    return '';
  }
}

function resolveAxeVersionSafe(): string {
  try {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pkg = require('axe-core/package.json');
    return typeof pkg?.version === 'string' ? pkg.version : '';
  } catch {
    return '';
  }
}
