import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { findConfigFile, loadConfigFile, mergeConfig } from './lib/config.js';
import { compareWith } from './lib/compare.js';

describe('CLI config utilities', () => {
  describe('findConfigFile', () => {
    const testDir = join(tmpdir(), 'a11y-ai-cli-test-' + Date.now());

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      const files = ['.a11yairc.json', '.a11yairc.yaml', 'a11y-ai.config.js'];
      for (const file of files) {
        const path = join(testDir, file);
        if (existsSync(path)) {
          unlinkSync(path);
        }
      }
    });

    it('returns null when no config file exists', () => {
      const result = findConfigFile(testDir);
      expect(result).toBeNull();
    });

    it('finds .a11yairc.json', () => {
      const configPath = join(testDir, '.a11yairc.json');
      writeFileSync(configPath, '{}');
      const result = findConfigFile(testDir);
      expect(result).toBe(configPath);
    });
  });

  describe('loadConfigFile', () => {
    const testDir = join(tmpdir(), 'a11y-ai-cli-load-test-' + Date.now());

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      const path = join(testDir, 'config.json');
      if (existsSync(path)) {
        unlinkSync(path);
      }
    });

    it('loads JSON config file', async () => {
      const configPath = join(testDir, 'config.json');
      const config = { preset: 'standard', provider: 'openai' };
      writeFileSync(configPath, JSON.stringify(config));

      const result = await loadConfigFile(configPath);
      expect(result).toEqual(config);
    });

    it('returns empty object for invalid JSON', async () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, 'not valid json');

      const result = await loadConfigFile(configPath);
      expect(result).toEqual({});
    });
  });

  describe('mergeConfig', () => {
    it('merges file config with CLI options', () => {
      const fileConfig = {
        preset: 'standard',
        provider: 'openai',
        model: 'gpt-4',
        threshold: 70,
      };

      const cliOptions = {
        provider: 'anthropic',
        threshold: 80,
      };

      const result = mergeConfig(fileConfig, cliOptions);
      expect(result.preset).toBe('standard');
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('gpt-4');
      expect(result.threshold).toBe(80);
    });

    it('CLI options override file config', () => {
      const fileConfig = { format: 'json' };
      const cliOptions = { format: 'html' };

      const result = mergeConfig(fileConfig, cliOptions);
      expect(result.format).toBe('html');
    });

    it('ignores undefined CLI options', () => {
      const fileConfig = { preset: 'standard' };
      const cliOptions = { preset: undefined, provider: 'openai' };

      const result = mergeConfig(fileConfig, cliOptions);
      expect(result.preset).toBe('standard');
      expect(result.provider).toBe('openai');
    });
  });
});

describe('CLI compare utilities', () => {
  describe('compareWith', () => {
    it('calculates positive delta when score improves', () => {
      const previous = { summary: { score: 70 } };
      const current = { summary: { score: 85 } };

      const result = compareWith(previous, current);
      expect(result.previousScore).toBe(70);
      expect(result.currentScore).toBe(85);
      expect(result.delta).toBe(15);
      expect(result.direction).toBe('improved');
    });

    it('calculates negative delta when score regresses', () => {
      const previous = { summary: { score: 85 } };
      const current = { summary: { score: 70 } };

      const result = compareWith(previous, current);
      expect(result.previousScore).toBe(85);
      expect(result.currentScore).toBe(70);
      expect(result.delta).toBe(-15);
      expect(result.direction).toBe('regressed');
    });

    it('reports unchanged when scores are equal', () => {
      const previous = { summary: { score: 80 } };
      const current = { summary: { score: 80 } };

      const result = compareWith(previous, current);
      expect(result.delta).toBe(0);
      expect(result.direction).toBe('unchanged');
    });

    it('handles missing summary gracefully', () => {
      const previous = {};
      const current = { summary: { score: 80 } };

      const result = compareWith(previous, current);
      expect(result.previousScore).toBe(0);
      expect(result.currentScore).toBe(80);
    });

    it('compares violation counts', () => {
      const previous = {
        summary: { score: 80, totalViolations: 10 },
        mergedViolations: Array(10).fill({ severity: 'moderate' }),
      };
      const current = {
        summary: { score: 85, totalViolations: 5 },
        mergedViolations: Array(5).fill({ severity: 'moderate' }),
      };

      const result = compareWith(previous, current);
      expect(result.violationsDelta).toBe(-5);
    });
  });
});

describe('CLI argument parsing', () => {
  it('parses WCAG level correctly', () => {
    const toWcagLevel = (value: unknown): 'A' | 'AA' | 'AAA' => {
      if (value === 'A' || value === 'AA' || value === 'AAA') return value;
      return 'AA';
    };

    expect(toWcagLevel('A')).toBe('A');
    expect(toWcagLevel('AA')).toBe('AA');
    expect(toWcagLevel('AAA')).toBe('AAA');
    expect(toWcagLevel('invalid')).toBe('AA');
    expect(toWcagLevel(undefined)).toBe('AA');
  });

  it('parses provider name correctly', () => {
    const toProviderName = (value: unknown): 'openai' | 'anthropic' | 'ollama' | 'custom' => {
      if (value === 'openai' || value === 'anthropic' || value === 'ollama' || value === 'custom')
        return value;
      return 'custom';
    };

    expect(toProviderName('openai')).toBe('openai');
    expect(toProviderName('anthropic')).toBe('anthropic');
    expect(toProviderName('ollama')).toBe('ollama');
    expect(toProviderName('custom')).toBe('custom');
    expect(toProviderName('invalid')).toBe('custom');
    expect(toProviderName(undefined)).toBe('custom');
  });
});

describe('CLI URL resolution', () => {
  it('resolves target as URL when valid', () => {
    const resolveTarget = (
      target: string,
      cwd: string,
    ): { kind: 'url'; url: string } | { kind: 'file'; path: string } => {
      try {
        const u = new URL(target);
        return { kind: 'url', url: u.toString() };
      } catch {
        return { kind: 'file', path: join(cwd, target) };
      }
    };

    const result = resolveTarget('https://example.com', '/home/user');
    expect(result.kind).toBe('url');
    expect((result as { kind: 'url'; url: string }).url).toBe('https://example.com/');
  });

  it('resolves target as file when not a URL', () => {
    const resolveTarget = (
      target: string,
      cwd: string,
    ): { kind: 'url'; url: string } | { kind: 'file'; path: string } => {
      try {
        const u = new URL(target);
        return { kind: 'url', url: u.toString() };
      } catch {
        return { kind: 'file', path: join(cwd, target) };
      }
    };

    const result = resolveTarget('index.html', '/home/user');
    expect(result.kind).toBe('file');
    expect((result as { kind: 'file'; path: string }).path).toBe('/home/user/index.html');
  });
});
