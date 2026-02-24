import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { AuditConfig as RulesAuditConfig } from '@a11y-ai/rules';

/**
 * CLI configuration file names (searched upwards from cwd).
 */
export const CONFIG_FILES = ['.a11yairc.json', 'a11y-ai.config.js'] as const;

/**
 * Basic CLI config shape.
 *
 * The orchestrator `AuditConfig` is richer; this is a user-friendly wrapper that
 * can be merged with CLI flags and env vars.
 */
export interface CliConfigFile {
  /** Preset name (e.g., `quick`, `standard`, `thorough`). */
  preset?: string;

  /** AI provider id (e.g., `openai`, `anthropic`, `ollama`, `custom`). */
  provider?: string;

  /** Provider API key (or use env vars like `OPENAI_API_KEY`). */
  apiKey?: string;

  /** Provider model id (e.g., `gpt-4o-mini`). */
  model?: string;

  /** Report format (`json`, `html`, `md`, `sarif`, `console`). */
  format?: string;

  /** Output file path (defaults to stdout when omitted). */
  output?: string;

  /** Minimum passing score for CI-style runs. */
  threshold?: number;

  /** WCAG level used for axe-core presets (`A`, `AA`, `AAA`). */
  wcag?: 'A' | 'AA' | 'AAA';

  /** Enable verbose logging. */
  verbose?: boolean;

  /**
   * Per-rule overrides.
   *
   * This intentionally stays loose because rule settings are rule-specific.
   */
  rules?: RulesAuditConfig['rules'];
}

/**
 * Find a config file by walking up from the starting directory.
 */
export function findConfigFile(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    for (const name of CONFIG_FILES) {
      const full = path.join(dir, name);
      if (existsSync(full)) return full;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Load config from disk. Supports:
 * - `.a11yairc.json`
 * - `a11y-ai.config.js` (default export or module.exports)
 */
export async function loadConfigFile(filePath: string): Promise<CliConfigFile> {
  if (filePath.endsWith('.json')) {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as CliConfigFile;
  }

  if (filePath.endsWith('.js')) {
    const mod = await import(pathToFileURL(filePath).href);

    const cfg = (mod.default ?? mod) as CliConfigFile;
    return cfg ?? {};
  }

  return {};
}

/**
 * Merge config objects with precedence: base < overrides.
 */
export function mergeConfig(base: CliConfigFile, overrides: Partial<CliConfigFile>): CliConfigFile {
  return {
    ...base,
    ...overrides,
    rules: {
      ...(base.rules ?? {}),
      ...(overrides.rules ?? {}),
    },
  };
}
