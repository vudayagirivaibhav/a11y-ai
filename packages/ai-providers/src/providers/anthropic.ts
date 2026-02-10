import type { AiProviderConfig } from 'a11y-ai';

import { BaseAIProvider } from '../base.js';
import { AIProviderError } from '../errors.js';

type AnthropicUsage = { input_tokens?: number; output_tokens?: number };

export class AnthropicProvider extends BaseAIProvider {
  constructor(config: AiProviderConfig) {
    super(config);
  }

  protected async rawComplete(prompt: string, systemPrompt?: string): Promise<string> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new AIProviderError('Anthropic apiKey is required');

    const model = this.config.model ?? 'claude-sonnet-4-20250514';
    const baseURL = this.config.baseUrl;

    // Dynamic import so `@anthropic-ai/sdk` stays a peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('@anthropic-ai/sdk');
    const Anthropic = mod.default ?? mod.Anthropic ?? mod;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const client = new Anthropic({ apiKey, baseURL });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const usage = (response?.usage ?? {}) as AnthropicUsage;
    this.setLastUsage({
      promptTokens: usage.input_tokens ?? 0,
      completionTokens: usage.output_tokens ?? 0,
    });

    const blocks = response?.content;
    const content =
      Array.isArray(blocks) && blocks.length > 0
        ? blocks
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((b: any) => (typeof b?.text === 'string' ? b.text : ''))
            .join('')
        : '';

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AIProviderError('Anthropic returned an empty response');
    }

    return content;
  }
}

