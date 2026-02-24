import type { AxeRunConfig, AxeViolation } from './types/axe.js';
import type { AiHandler } from './types/ai.js';
import type { AiProviderConfig } from './types/config.js';
import type { AuditResult } from './types/audit.js';

import { AxeRunner } from './axe/AxeRunner.js';
import { DOMExtractor } from './extraction/DOMExtractor.js';
import { A11yAuditor } from './auditor/A11yAuditor.js';
import type { AuditConfig } from './auditor/types.js';

/**
 * Provider name identifiers supported by built-in adapters.
 */
export type ProviderName = 'openai' | 'anthropic' | 'ollama' | 'custom';

/**
 * User-friendly provider input shape used by convenience APIs.
 */
export type ProviderInput =
  | {
      /** Provider id. */
      name: ProviderName;

      /** Provider API key (when required). */
      apiKey?: string;

      /** Provider model id (e.g., `gpt-4o-mini`). */
      model?: string;

      /** Base URL override (useful for proxies/self-hosted endpoints). */
      baseUrl?: string;

      /**
       * Custom handler used when `name: "custom"`.
       *
       * If you pass a custom handler, you can ignore `apiKey`/`model` and
       * implement your own provider integration.
       */
      handler?: AiHandler;
    }
  | AiProviderConfig;

/**
 * Options accepted by `audit*` convenience functions.
 *
 * This is intentionally flexible and will evolve as presets/rules expand.
 */
export interface AuditOptions extends Partial<Omit<AuditConfig, 'aiProvider'>> {
  /** Preset name (e.g., `quick`, `standard`, `thorough`). */
  preset?: string;

  /** Provider selection + credentials. */
  provider?: ProviderInput;
}

/**
 * One-liner audit.
 */
export async function audit(target: string | URL, options: AuditOptions): Promise<AuditResult> {
  const auditor = new A11yAuditor(toAuditConfig(options));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await auditor.audit(target as any);
}

/**
 * Audit a raw HTML string.
 */
export async function auditHTML(html: string, options: AuditOptions): Promise<AuditResult> {
  const auditor = new A11yAuditor(toAuditConfig(options));
  return await auditor.auditHTML(html);
}

/**
 * Audit a live URL.
 */
export async function auditURL(url: string, options: AuditOptions): Promise<AuditResult> {
  const auditor = new A11yAuditor(toAuditConfig(options));
  return await auditor.auditURL(url);
}

/**
 * Audit an existing Puppeteer/Playwright page object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function auditPage(page: any, options: AuditOptions): Promise<AuditResult> {
  const auditor = new A11yAuditor(toAuditConfig(options));
  return await auditor.auditPage(page);
}

/**
 * Run axe-core only (no AI, zero cost).
 *
 * Accepts either HTML or a URL. URLs require playwright/puppeteer to be installed.
 */
export async function auditAxeOnly(
  target: string | URL,
  config: AxeRunConfig = {},
): Promise<AxeViolation[]> {
  const runner = new AxeRunner();

  const text = typeof target === 'string' ? target : target.toString();
  if (looksLikeHtml(text)) {
    return await runner.run(text, config);
  }

  const url = looksLikeUrl(text) ? text : new URL(text).toString();
  const extraction = await new DOMExtractor({ url }).extractAll();
  return await runner.run(extraction.rawHTML, config);
}

/**
 * Convert convenience options into the orchestrator's `AuditConfig`.
 */
export function toAuditConfig(options: AuditOptions): AuditConfig {
  const provider = normalizeProvider(options.provider);

  const cfg: AuditConfig = {
    ...options,
    aiProvider: provider,
  };

  return applyPreset(cfg, options.preset);
}

function normalizeProvider(input: ProviderInput | undefined): AiProviderConfig {
  if (!input) {
    return {
      provider: 'custom',
      customHandler: async () => ({ content: JSON.stringify({ results: [] }) }),
    };
  }

  if ('provider' in input) return input;

  if (input.name === 'custom') {
    return {
      provider: 'custom',
      customHandler:
        input.handler ??
        (async () => ({
          content: JSON.stringify({ results: [] }),
        })),
    };
  }

  return {
    provider: input.name,
    apiKey: input.apiKey,
    model: input.model,
    baseUrl: input.baseUrl,
  };
}

/**
 * Apply preset rules configuration.
 *
 * This is intentionally minimal right now (only a subset of rules exists).
 * It still provides stable behavior for "quick"/"standard"/"thorough".
 */
function applyPreset(config: AuditConfig, preset: string | undefined): AuditConfig {
  const p = (preset ?? '').toLowerCase();
  if (!p || p === 'custom') return config;

  const rules = { ...(config.rules ?? {}) };

  if (p === 'quick') {
    // Only run static-only modes for a small subset of rules. No AI calls.
    for (const id of [
      'ai/alt-text-quality',
      'ai/link-text-quality',
      'ai/form-label-relevance',
      'ai/contrast-analysis',
      'ai/heading-structure',
      'ai/aria-validation',
      'ai/keyboard-navigation',
      'ai/language-readability',
      'ai/media-accessibility',
    ]) {
      rules[id] = { ...(rules[id] ?? {}), enabled: false };
    }

    rules['ai/alt-text-quality'] = {
      ...(rules['ai/alt-text-quality'] ?? {}),
      enabled: true,
      vision: false,
      settings: { ...(rules['ai/alt-text-quality']?.settings ?? {}), aiEnabled: false },
    };
    rules['ai/link-text-quality'] = {
      ...(rules['ai/link-text-quality'] ?? {}),
      enabled: true,
      settings: { ...(rules['ai/link-text-quality']?.settings ?? {}), aiEnabled: false },
    };
    rules['ai/form-label-relevance'] = {
      ...(rules['ai/form-label-relevance'] ?? {}),
      enabled: true,
      settings: { ...(rules['ai/form-label-relevance']?.settings ?? {}), aiEnabled: false },
    };
  }

  if (p === 'thorough') {
    for (const id of [
      'ai/alt-text-quality',
      'ai/link-text-quality',
      'ai/contrast-analysis',
      'ai/form-label-relevance',
      'ai/heading-structure',
      'ai/aria-validation',
      'ai/keyboard-navigation',
      'ai/language-readability',
      'ai/media-accessibility',
    ]) {
      rules[id] = { ...(rules[id] ?? {}), enabled: true };
    }

    rules['ai/alt-text-quality'] = {
      ...(rules['ai/alt-text-quality'] ?? {}),
      enabled: true,
      vision: true,
      batchSize: rules['ai/alt-text-quality']?.batchSize ?? 10,
      settings: { ...(rules['ai/alt-text-quality']?.settings ?? {}), aiEnabled: true },
    };
    rules['ai/link-text-quality'] = {
      ...(rules['ai/link-text-quality'] ?? {}),
      enabled: true,
      batchSize: rules['ai/link-text-quality']?.batchSize ?? 15,
      settings: { ...(rules['ai/link-text-quality']?.settings ?? {}), aiEnabled: true },
    };
    rules['ai/form-label-relevance'] = {
      ...(rules['ai/form-label-relevance'] ?? {}),
      enabled: true,
      batchSize: rules['ai/form-label-relevance']?.batchSize ?? 5,
      settings: { ...(rules['ai/form-label-relevance']?.settings ?? {}), aiEnabled: true },
    };

    return {
      ...config,
      rules,
      vision: true,
      maxVisionImages: config.maxVisionImages ?? 20,
    };
  }

  // Default "standard": enable AI (where implemented).
  if (p === 'standard') {
    for (const id of [
      'ai/alt-text-quality',
      'ai/link-text-quality',
      'ai/contrast-analysis',
      'ai/form-label-relevance',
      'ai/heading-structure',
      'ai/aria-validation',
      'ai/keyboard-navigation',
      'ai/language-readability',
      'ai/media-accessibility',
    ]) {
      rules[id] = { ...(rules[id] ?? {}), enabled: true };
    }

    rules['ai/alt-text-quality'] = {
      ...(rules['ai/alt-text-quality'] ?? {}),
      enabled: true,
      vision: false,
      batchSize: rules['ai/alt-text-quality']?.batchSize ?? 10,
      settings: { ...(rules['ai/alt-text-quality']?.settings ?? {}), aiEnabled: true },
    };
    rules['ai/link-text-quality'] = {
      ...(rules['ai/link-text-quality'] ?? {}),
      enabled: true,
      batchSize: rules['ai/link-text-quality']?.batchSize ?? 15,
      settings: { ...(rules['ai/link-text-quality']?.settings ?? {}), aiEnabled: true },
    };
    rules['ai/form-label-relevance'] = {
      ...(rules['ai/form-label-relevance'] ?? {}),
      enabled: true,
      batchSize: rules['ai/form-label-relevance']?.batchSize ?? 5,
      settings: { ...(rules['ai/form-label-relevance']?.settings ?? {}), aiEnabled: true },
    };

    rules['ai/heading-structure'] = {
      ...(rules['ai/heading-structure'] ?? {}),
      enabled: true,
      settings: { ...(rules['ai/heading-structure']?.settings ?? {}), aiEnabled: true },
    };
    rules['ai/aria-validation'] = {
      ...(rules['ai/aria-validation'] ?? {}),
      enabled: true,
      settings: { ...(rules['ai/aria-validation']?.settings ?? {}), aiEnabled: true },
    };
    rules['ai/language-readability'] = {
      ...(rules['ai/language-readability'] ?? {}),
      enabled: true,
      settings: { ...(rules['ai/language-readability']?.settings ?? {}), aiEnabled: true },
    };
    rules['ai/media-accessibility'] = {
      ...(rules['ai/media-accessibility'] ?? {}),
      enabled: true,
      settings: { ...(rules['ai/media-accessibility']?.settings ?? {}), aiEnabled: true },
    };

    return { ...config, rules, vision: false };
  }

  return { ...config, rules };
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim();
  return t.startsWith('<') && t.includes('>');
}

function looksLikeUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}
