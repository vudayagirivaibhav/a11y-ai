# @a11y-ai/ai-providers

AI provider adapters for a11y-ai — supports OpenAI, Anthropic, Ollama, and custom handlers.

## Install

```bash
npm install @a11y-ai/ai-providers
# or
pnpm add @a11y-ai/ai-providers
```

## Supported Providers

| Provider  | SDK Required        | Vision Support             |
| --------- | ------------------- | -------------------------- |
| OpenAI    | `openai`            | Yes (gpt-4o, gpt-4-vision) |
| Anthropic | `@anthropic-ai/sdk` | Yes (claude-3-\*)          |
| Ollama    | None (HTTP)         | Model-dependent            |
| Mock      | None                | No                         |
| Custom    | None                | Your implementation        |

## Usage

```typescript
import { createAIProvider } from '@a11y-ai/ai-providers';

// OpenAI
const openai = createAIProvider({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini', // or 'gpt-4o' for vision
});

// Anthropic
const anthropic = createAIProvider({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-haiku-20240307',
});

// Ollama (local)
const ollama = createAIProvider({
  provider: 'ollama',
  model: 'llama3',
  baseUrl: 'http://localhost:11434', // default
});

// Mock (for testing)
const mock = createAIProvider({
  provider: 'mock',
});

// Custom handler
const custom = createAIProvider({
  provider: 'custom',
  customHandler: async (prompt) => ({
    content: JSON.stringify({ findings: [] }),
    usage: { promptTokens: 100, completionTokens: 50 },
  }),
});
```

## Provider Configuration

### OpenAI

```typescript
{
  provider: 'openai',
  apiKey: string,          // Required
  model?: string,          // Default: 'gpt-4o-mini'
  baseUrl?: string,        // For Azure or proxies
  timeoutMs?: number,      // Default: 30000
  maxRetries?: number,     // Default: 3
  rpm?: number,            // Rate limit (requests/minute)
}
```

**Recommended models:**

- `gpt-4o-mini` — Fast, cheap, good for most rules
- `gpt-4o` — Best quality, supports vision

### Anthropic

```typescript
{
  provider: 'anthropic',
  apiKey: string,          // Required
  model?: string,          // Default: 'claude-3-haiku-20240307'
  baseUrl?: string,        // For proxies
  timeoutMs?: number,
  maxRetries?: number,
  rpm?: number,
}
```

**Recommended models:**

- `claude-3-haiku-20240307` — Fast, cheap
- `claude-3-5-sonnet-20241022` — Best quality, supports vision

### Ollama

```typescript
{
  provider: 'ollama',
  model: string,           // Required (e.g., 'llama3', 'mistral')
  baseUrl?: string,        // Default: 'http://localhost:11434'
  timeoutMs?: number,
}
```

Run Ollama locally:

```bash
ollama pull llama3
ollama serve
```

### Custom Handler

```typescript
{
  provider: 'custom',
  customHandler: async (prompt: string) => {
    // Call your own API
    const response = await fetch('https://my-api.com/analyze', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    return {
      content: data.result,
      usage: { promptTokens: data.tokens_in, completionTokens: data.tokens_out },
    };
  },
}
```

## With @a11y-ai/core

```typescript
import { audit } from '@a11y-ai/core';

const result = await audit('https://example.com', {
  preset: 'standard',
  provider: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  },
});
```

## License

MIT
