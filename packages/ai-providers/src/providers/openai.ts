import type { AiProviderConfig } from '@a11y-ai/core/types';

import { BaseAIProvider } from '../base.js';
import { AIProviderError } from '../errors.js';

type OpenAIUsage = { prompt_tokens?: number; completion_tokens?: number };

/**
 * Convert image input to a URL the OpenAI SDK accepts.
 *
 * - If `input` is already a string, it is treated as a URL or data URL.
 * - If `input` is a Buffer, it is encoded as a PNG data URL.
 */
function toDataUrl(input: Buffer | string): string {
  if (typeof input === 'string') return input;
  const base64 = input.toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * OpenAI provider adapter.
 *
 * Notes:
 * - `openai` is a peer dependency and is imported dynamically at runtime.
 * - Defaults to `gpt-4o-mini` unless `config.model` is provided.
 * - Uses the Chat Completions API and requests a JSON object response format.
 */
export class OpenAIProvider extends BaseAIProvider {
  constructor(config: AiProviderConfig) {
    super(config);
  }

  /**
   * Perform a single text completion request.
   *
   * The base class wraps this in retry/timeout/rate-limiting logic.
   */
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

  /**
   * Vision-capable analysis using an image URL/data URL (or Buffer).
   *
   * The returned string is fed back into the base JSON normalization pipeline.
   */
  override async analyzeImage(
    imageData: Buffer | string,
    prompt: string,
    context: Parameters<BaseAIProvider['analyze']>[1],
  ): Promise<import('@a11y-ai/core/types').AIAnalysisResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new AIProviderError('OpenAI apiKey is required');

    const model = this.config.model ?? 'gpt-4o-mini';
    const baseURL = this.config.baseUrl;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('openai');
    const OpenAI = mod.default ?? mod.OpenAI ?? mod;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const client = new OpenAI({ apiKey, baseURL });

    const imageUrl = toDataUrl(imageData);
    const systemPrompt = this.config.systemPrompt;

    return await this.runWithRetries(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
      const response = await client.chat.completions.create({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.2,
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
    }, context);
  }
}
