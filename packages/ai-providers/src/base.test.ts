import { describe, expect, it, vi } from 'vitest';

import type { AiProviderConfig, RuleContext } from 'a11y-ai';

import { AIProviderTimeoutError } from './errors.js';
import { MockAIProvider } from './providers/mock.js';

function baseConfig(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    provider: 'custom',
    ...overrides,
  };
}

const context: RuleContext = {
  url: 'https://example.com',
  ruleId: 'alt-text-quality',
  element: {
    selector: 'img',
    html: '<img alt="foo" />',
    tagName: 'img',
    attributes: { alt: 'foo' },
  },
};

describe('BaseAIProvider (via MockAIProvider)', () => {
  it('parses and normalizes structured JSON findings', async () => {
    const provider = new MockAIProvider(baseConfig({ rpm: 10_000 }));
    const result = await provider.analyze('test prompt', context);

    expect(Array.isArray(result.findings)).toBe(true);
    for (const finding of result.findings) {
      expect(typeof finding.ruleId).toBe('string');
      expect(['critical', 'serious', 'moderate', 'minor']).toContain(finding.severity);
      expect(typeof finding.message).toBe('string');
      expect(typeof finding.suggestion).toBe('string');
      expect(typeof finding.confidence).toBe('number');
      expect(finding.confidence).toBeGreaterThanOrEqual(0);
      expect(finding.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('retries on parse errors and eventually succeeds', async () => {
    class FlakyMockProvider extends MockAIProvider {
      private calls = 0;
      protected override async rawComplete(prompt: string): Promise<string> {
        this.calls++;
        if (this.calls < 3) return 'not json';
        return super.rawComplete(prompt);
      }
    }

    const provider = new FlakyMockProvider(baseConfig({ maxRetries: 3, rpm: 10_000 }));
    const result = await provider.analyze('retry prompt', context);
    expect(result.attempts).toBe(3);
  });

  it('enforces timeout for a stuck provider call', async () => {
    class StuckMockProvider extends MockAIProvider {
      protected override async rawComplete(): Promise<string> {
        return await new Promise<string>(() => {
          // never resolves
        });
      }
    }

    vi.useFakeTimers();
    try {
      const provider = new StuckMockProvider(baseConfig({ timeoutMs: 50, maxRetries: 1, rpm: 10_000 }));

      // Attach a handler immediately to avoid an "unhandled rejection" window while we advance timers.
      const settled = provider
        .analyze('timeout prompt', context)
        .then(
          () => ({ ok: true as const }),
          (err) => ({ ok: false as const, err }),
        );
      await vi.advanceTimersByTimeAsync(60);

      const result = await settled;
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.err).toBeInstanceOf(AIProviderTimeoutError);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
