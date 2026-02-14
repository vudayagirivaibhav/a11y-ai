import type { AiProviderConfig } from 'a11y-ai/types';

import { BaseAIProvider } from '../base.js';
import { AIProviderError } from '../errors.js';

type OpenAIUsage = { prompt_tokens?: number; completion_tokens?: number };

export class OpenAIProvider extends BaseAIProvider {
  constructor(config: AiProviderConfig) {
    super(config);
  }

  protected async rawComplete(prompt: string, systemPrompt?: string): Promise<string> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new AIProviderError('OpenAI apiKey is required');

    const model = this.config.model ?? 'gpt-4o-mini';
    const baseURL = this.config.baseUrl;

    // Dynamic import so `openai` stays a peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('openai');
    const OpenAI = mod.default ?? mod.OpenAI ?? mod;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const client = new OpenAI({ apiKey, baseURL });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    const response = await client.chat.completions.create({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      // Hint to return JSON (best-effort; some models may still wrap in fences).
      response_format: { type: 'json_object' },
    });

    const usage = (response?.usage ?? {}) as OpenAIUsage;
    this.setLastUsage({
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    });

    const content = response?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AIProviderError('OpenAI returned an empty response');
    }

    return content;
  }
}
