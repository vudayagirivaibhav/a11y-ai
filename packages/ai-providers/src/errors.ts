/**
 * Base error type for failures coming from provider adapters.
 *
 * This is used so callers can differentiate "provider problems" from
 * extraction/rules/reporting errors.
 */
export class AIProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'AIProviderError';
    if (options?.cause !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = options.cause;
    }
  }
}

/**
 * Thrown when a provider request exceeds the configured timeout.
 */
export class AIProviderTimeoutError extends AIProviderError {
  constructor(timeoutMs: number) {
    super(`AI provider request timed out after ${timeoutMs}ms`);
    this.name = 'AIProviderTimeoutError';
  }
}

/**
 * Thrown when the provider returned output that couldn't be parsed as JSON.
 */
export class AIProviderParseError extends AIProviderError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AIProviderParseError';
  }
}

/**
 * Thrown when a vision-capable rule attempts to use image analysis but the
 * configured provider does not support multimodal inputs.
 */
export class VisionNotSupportedError extends AIProviderError {
  constructor(provider: string) {
    super(`Vision analysis is not supported by provider: ${provider}`);
    this.name = 'VisionNotSupportedError';
  }
}
