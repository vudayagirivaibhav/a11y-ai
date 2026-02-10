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

export class AIProviderTimeoutError extends AIProviderError {
  constructor(timeoutMs: number) {
    super(`AI provider request timed out after ${timeoutMs}ms`);
    this.name = 'AIProviderTimeoutError';
  }
}

export class AIProviderParseError extends AIProviderError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AIProviderParseError';
  }
}

