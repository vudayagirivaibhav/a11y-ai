import type { AiProviderConfig } from '@a11y-ai/core/types';

import { BaseAIProvider } from '../base.js';
import { AIProviderError } from '../errors.js';

type AnthropicUsage = { input_tokens?: number; output_tokens?: number };

/**
 * Extract text from the Anthropic SDK response `content` blocks.
 */
function extractTextFromBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  return (
    blocks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => (typeof b?.text === 'string' ? b.text : ''))
      .join('')
  );
}

/**
 * Normalize image input into the `{ mediaType, base64 }` shape required by Anthropic.
 *
 * - Buffers are assumed to be PNG.
 * - Strings must be a `data:<mime>;base64,...` URL.
 */
function parseDataUrl(input: Buffer | string): { mediaType: string; base64: string } {
  if (Buffer.isBuffer(input)) {
    return { mediaType: 'image/png', base64: input.toString('base64') };
  }

  const value = input.trim();
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new AIProviderError(
      'Anthropic vision expects a data URL string (data:<mime>;base64,...) or a Buffer',
    );
  }
  return { mediaType: match[1]!, base64: match[2]! };
}

/**
 * Anthropic provider adapter.
 *
 * Notes:
 * - `@anthropic-ai/sdk` is a peer dependency and is imported dynamically at runtime.
 * - Defaults to `claude-sonnet-4-20250514` unless `config.model` is provided.
 */
export class AnthropicProvider extends BaseAIProvider {
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
    if (!apiKey) throw new AIProviderError('Anthropic apiKey is required');

    const model = this.config.model ?? 'claude-sonnet-4-20250514';
    const baseURL = this.config.baseUrl;

    // Dynamic import so `@anthropic-ai/sdk` stays a peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('@anthropic-ai/sdk');
    const Anthropic = mod.default ?? mod.Anthropic ?? mod;

    const client = new Anthropic({ apiKey, baseURL });

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

    const content = extractTextFromBlocks(response?.content);

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AIProviderError('Anthropic returned an empty response');
    }

    return content;
  }

  /**
   * Vision-capable analysis using a base64 image payload.
   *
   * The returned string is fed back into the base JSON normalization pipeline.
   */
  override async analyzeImage(
    imageData: Buffer | string,
    prompt: string,
    context: Parameters<BaseAIProvider['analyze']>[1],
  ): Promise<import('@a11y-ai/core/types').AIAnalysisResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new AIProviderError('Anthropic apiKey is required');

    const model = this.config.model ?? 'claude-sonnet-4-20250514';
    const baseURL = this.config.baseUrl;
    const systemPrompt = this.config.systemPrompt;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('@anthropic-ai/sdk');
    const Anthropic = mod.default ?? mod.Anthropic ?? mod;

    const client = new Anthropic({ apiKey, baseURL });

    const { mediaType, base64 } = parseDataUrl(imageData);

    return await this.runWithRetries(async () => {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            ],
          },
        ],
      });

      const usage = (response?.usage ?? {}) as AnthropicUsage;
      this.setLastUsage({
        promptTokens: usage.input_tokens ?? 0,
        completionTokens: usage.output_tokens ?? 0,
      });

      const content = extractTextFromBlocks(response?.content);
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new AIProviderError('Anthropic returned an empty response');
      }

      return content;
    }, context);
  }
}
