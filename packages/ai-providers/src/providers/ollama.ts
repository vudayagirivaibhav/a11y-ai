import type { AiProviderConfig } from 'a11y-ai/types';

import { BaseAIProvider } from '../base.js';
import { AIProviderError } from '../errors.js';

type OllamaChatResponse = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
};

export class OllamaProvider extends BaseAIProvider {
  constructor(config: AiProviderConfig) {
    super(config);
  }

  protected async rawComplete(prompt: string, systemPrompt?: string): Promise<string> {
    const baseUrl = this.config.baseUrl ?? 'http://localhost:11434';
    const model = this.config.model ?? 'llama3.1';

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new AIProviderError(`Ollama request failed with status ${response.status}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data?.message?.content;

    this.setLastUsage({
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
    });

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AIProviderError('Ollama returned an empty response');
    }

    return content;
  }
}
