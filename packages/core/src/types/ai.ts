import type { Buffer } from 'node:buffer';

/**
 * Optional context to send alongside an AI request.
 *
 * Different providers support different modalities; `images` is intended for
 * vision-capable models (e.g., for contrast / visual context).
 */
export interface AiRequestContext {
  /** Binary image payloads (e.g., screenshots). */
  images?: Buffer[];

  /** Upper bound on tokens for the response (provider-specific). */
  maxTokens?: number;

  /** Sampling temperature (provider-specific). */
  temperature?: number;
}

/**
 * Normalized AI response shape used across providers.
 *
 * `content` is the model's text output. `usage` is optional and provider-dependent.
 */
export interface AiResponse {
  /** Model output text (should be parseable / structured by higher layers). */
  content: string;

  /** Token accounting when the provider returns it. */
  usage?: {
    /** Prompt/input tokens consumed. */
    promptTokens: number;

    /** Completion/output tokens consumed. */
    completionTokens: number;
  };
}

/**
 * Provider-agnostic interface for calling an LLM.
 *
 * This allows swapping providers (OpenAI/Anthropic/Ollama/custom) without
 * changing the rest of the auditing pipeline.
 */
export interface AiHandler {
  (prompt: string, context?: AiRequestContext): Promise<AiResponse>;
}
