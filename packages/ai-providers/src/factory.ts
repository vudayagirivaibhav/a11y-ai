import type { AIProvider, AiProviderConfig } from '@a11y-ai/core/types';

import { AnthropicProvider } from './providers/anthropic.js';
import { MockAIProvider } from './providers/mock.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';

/**
 * Create an AI provider adapter from config.
 *
 * - `openai` / `anthropic`: require their respective peer dependency at runtime.
 * - `ollama`: uses direct HTTP calls (no SDK dependency).
 * - `custom`: uses the provided `customHandler`.
 * - fallback: uses `MockAIProvider` for deterministic testing.
 */
export function createAIProvider(config: AiProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'custom': {
      if (!config.customHandler) {
        throw new Error('customHandler is required when provider is "custom"');
      }

      return {
        /**
         * Adapter that wraps `customHandler` into the standard `AIProvider` interface.
         *
         * The base orchestrator expects `AIAnalysisResult`; we keep this lightweight
         * and leave JSON parsing/normalization to the consumer if desired.
         */
        async analyze(prompt, context) {
          const response = await config.customHandler!(prompt);
          return {
            findings: [],
            raw: response.content,
            latencyMs: 0,
            attempts: 1,
            usage: response.usage,
          };
        },
      };
    }
    default:
      return new MockAIProvider(config);
  }
}
