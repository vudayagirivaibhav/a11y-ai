import { describe, expect, it, vi } from 'vitest';

import { createAIProvider } from './factory.js';
import { MockAIProvider } from './providers/mock.js';

describe('createAIProvider', () => {
  describe('mock provider', () => {
    it('returns MockAIProvider for unknown provider', () => {
      const provider = createAIProvider({
        provider: 'unknown' as 'mock',
      });
      expect(provider).toBeInstanceOf(MockAIProvider);
    });

    it('returns MockAIProvider for mock provider', () => {
      const provider = createAIProvider({
        provider: 'mock',
      });
      expect(provider).toBeInstanceOf(MockAIProvider);
    });

    it('MockAIProvider returns deterministic results', async () => {
      const provider = createAIProvider({
        provider: 'mock',
      });

      const result = await provider.analyze('test prompt', {
        url: 'https://example.com',
        ruleId: 'test-rule',
        html: '<div>test</div>',
        metadata: {
          pageTitle: 'Test',
          counts: { images: 0, links: 0, forms: 0, headings: 0, ariaElements: 0 },
        },
      });

      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('raw');
      expect(result).toHaveProperty('latencyMs');
      expect(result).toHaveProperty('attempts');
    });
  });

  describe('custom provider', () => {
    it('throws when customHandler is missing', () => {
      expect(() =>
        createAIProvider({
          provider: 'custom',
        }),
      ).toThrow('customHandler is required when provider is "custom"');
    });

    it('wraps customHandler into AIProvider interface', async () => {
      const customHandler = vi.fn().mockResolvedValue({
        content: '{"findings": []}',
        usage: { promptTokens: 10, completionTokens: 5 },
      });

      const provider = createAIProvider({
        provider: 'custom',
        customHandler,
      });

      const result = await provider.analyze('test prompt', {
        url: 'https://example.com',
        ruleId: 'test-rule',
        html: '<div>test</div>',
        metadata: {
          pageTitle: 'Test',
          counts: { images: 0, links: 0, forms: 0, headings: 0, ariaElements: 0 },
        },
      });

      expect(customHandler).toHaveBeenCalledWith('test prompt');
      expect(result.raw).toBe('{"findings": []}');
      expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
      expect(result.findings).toEqual([]);
      expect(result.latencyMs).toBe(0);
      expect(result.attempts).toBe(1);
    });
  });

  describe('openai provider', () => {
    it('returns OpenAIProvider for openai config', () => {
      const provider = createAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      expect(provider).toBeDefined();
      expect(provider.analyze).toBeInstanceOf(Function);
    });
  });

  describe('anthropic provider', () => {
    it('returns AnthropicProvider for anthropic config', () => {
      const provider = createAIProvider({
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-haiku-20240307',
      });

      expect(provider).toBeDefined();
      expect(provider.analyze).toBeInstanceOf(Function);
    });
  });

  describe('ollama provider', () => {
    it('returns OllamaProvider for ollama config', () => {
      const provider = createAIProvider({
        provider: 'ollama',
        model: 'llama2',
        baseUrl: 'http://localhost:11434',
      });

      expect(provider).toBeDefined();
      expect(provider.analyze).toBeInstanceOf(Function);
    });
  });
});
