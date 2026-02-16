import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
  preset?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  format?: string;
  output?: string;
  threshold?: number;
  wcag?: 'A' | 'AA' | 'AAA';
  verbose?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules?: Record<string, any>;
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

