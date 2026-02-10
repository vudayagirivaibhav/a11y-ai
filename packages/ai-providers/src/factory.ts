import type { AIProvider, AiProviderConfig } from 'a11y-ai';

import { AnthropicProvider } from './providers/anthropic.js';
import { MockAIProvider } from './providers/mock.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';

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

