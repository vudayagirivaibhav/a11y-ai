# Contributing to a11y-ai

Thank you for your interest in contributing to a11y-ai! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Development Workflow](#development-workflow)
- [Adding a New Rule](#adding-a-new-rule)
- [Adding a New AI Provider](#adding-a-new-ai-provider)
- [Testing](#testing)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Commit Messages](#commit-messages)

## Code of Conduct

Please be respectful and constructive in all interactions. We're building tools to make the web more accessible to everyone, and that spirit should extend to how we treat each other.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+ (via corepack)
- Git

### Setup

```bash
git clone https://github.com/vudayagirivaibhav/a11y-ai
cd a11y-ai
corepack enable
pnpm install
pnpm build
pnpm test
```

### Running the Playground

```bash
pnpm -C apps/playground dev
```

Open [http://localhost:3000](http://localhost:3000) to see the playground.

## Architecture

### Packages

```
packages/
├── core/           # @a11y-ai/core - Orchestrator, DOM extraction, axe-core, scoring, reporting
├── rules/          # @a11y-ai/rules - Rules engine + 9 built-in rules
├── ai-providers/   # @a11y-ai/ai-providers - Provider adapters (OpenAI, Anthropic, Ollama)
├── cli/            # @a11y-ai/cli - CLI wrapper
└── github-action/  # @a11y-ai/github-action - GitHub Action
apps/
└── playground/     # Next.js playground app
```

### Data Flow

```
User Input (URL/HTML)
       ↓
   A11yAuditor
       ↓
   DOMExtractor → ExtractionResult (snapshots, metadata)
       ↓
   ┌───────────────┬────────────────┐
   ↓               ↓                ↓
AxeRunner    RuleRegistry     AIProvider
   ↓               ↓                ↓
AxeViolation[]  RuleResult[]   AI responses
   └───────────────┴────────────────┘
                   ↓
         Merge + Deduplicate
                   ↓
         AccessibilityScorer → AuditSummary (score, grade)
                   ↓
         ReportGenerator → Output (JSON/HTML/MD/SARIF/Console)
```

### Key Classes

| Class                 | Package      | Purpose                                         |
| --------------------- | ------------ | ----------------------------------------------- |
| `A11yAuditor`         | core         | Main orchestrator, runs the full audit pipeline |
| `DOMExtractor`        | core         | Extracts element snapshots from HTML/URL        |
| `AxeRunner`           | core         | Runs axe-core and normalizes results            |
| `AccessibilityScorer` | core         | Calculates 0-100 score and letter grade         |
| `ReportGenerator`     | core         | Generates reports in various formats            |
| `RuleRegistry`        | rules        | Manages rule registration and execution         |
| `BaseRule`            | rules        | Abstract base class for all rules               |
| `PromptBuilder`       | rules        | Builds AI prompts with token management         |
| `BaseAIProvider`      | ai-providers | Abstract base class for AI providers            |

## Development Workflow

### Commands

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format

# Run a specific package's tests
pnpm --filter @a11y-ai/core test

# Build a specific package
pnpm --filter @a11y-ai/rules build
```

### Watch Mode

```bash
# Watch tests for a package
pnpm --filter @a11y-ai/rules test -- --watch
```

## Adding a New Rule

### 1. Create the Rule File

Create a new file at `packages/rules/src/rules/<category>/<RuleName>Rule.ts`:

```typescript
import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';
import type { AIProvider } from '@a11y-ai/ai-providers';

export class MyNewRule extends BaseRule {
  readonly id = 'ai/my-new-rule';
  readonly category = 'my-category';
  readonly description = 'Checks for something important';

  // Set to true if this rule uses AI
  readonly requiresAI = true;

  // Set to true if this rule can use vision capabilities
  readonly supportsVision = false;

  async evaluate(context: RuleContext, provider?: AIProvider): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    // Static checks (no AI needed)
    for (const element of context.elements) {
      if (this.hasIssue(element)) {
        results.push({
          ruleId: this.id,
          selector: element.selector,
          message: 'Description of the issue',
          severity: 'serious',
          confidence: 1.0,
          source: 'static',
          suggestion: 'How to fix it',
        });
      }
    }

    // AI-powered checks (if provider available)
    if (provider && this.requiresAI) {
      const aiResults = await this.runAIAnalysis(context, provider);
      results.push(...aiResults);
    }

    return results;
  }

  private hasIssue(element: ElementSnapshot): boolean {
    // Your static check logic
    return false;
  }

  private async runAIAnalysis(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    // Your AI analysis logic
    return [];
  }
}
```

### 2. Create a Zod Schema (if using AI)

Add a response schema in the same file or in `packages/rules/src/schemas.ts`:

```typescript
import { z } from 'zod';

export const MyNewRuleResponseSchema = z.object({
  issues: z.array(
    z.object({
      selector: z.string(),
      issue: z.string(),
      severity: z.enum(['critical', 'serious', 'moderate', 'minor']),
      suggestion: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
```

### 3. Register the Rule

Add to `packages/rules/src/registerBuiltinRules.ts`:

```typescript
import { MyNewRule } from './rules/my-category/MyNewRule.js';

export function registerBuiltinRules(registry: RuleRegistry): void {
  // ... existing rules
  registry.register(new MyNewRule());
}
```

### 4. Write Tests

Create `packages/rules/src/rules/<category>/<RuleName>Rule.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MyNewRule } from './MyNewRule.js';
import { createMockContext } from '../../testing/index.js';

describe('MyNewRule', () => {
  const rule = new MyNewRule();

  it('detects issues', async () => {
    const context = createMockContext({
      elements: [
        /* test elements */
      ],
    });

    const results = await rule.evaluate(context);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('serious');
  });

  it('passes for valid content', async () => {
    const context = createMockContext({
      elements: [
        /* valid elements */
      ],
    });

    const results = await rule.evaluate(context);

    expect(results).toHaveLength(0);
  });
});
```

### 5. Export the Rule

Add to `packages/rules/src/index.ts`:

```typescript
export { MyNewRule } from './rules/my-category/MyNewRule.js';
```

## Adding a New AI Provider

### 1. Create the Provider

Create `packages/ai-providers/src/providers/<name>.ts`:

```typescript
import { BaseAIProvider } from '../BaseAIProvider.js';
import type { AiProviderConfig, AICompletionOptions } from '../types.js';

export class MyProvider extends BaseAIProvider {
  readonly name = 'myprovider';

  constructor(config: AiProviderConfig) {
    super(config);
  }

  async rawComplete(
    prompt: string,
    systemPrompt?: string,
    options?: AICompletionOptions,
  ): Promise<string> {
    // Implement API call to your provider
    const response = await fetch('https://api.myprovider.com/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        system: systemPrompt,
        // ... other options
      }),
    });

    const data = await response.json();
    return data.text;
  }

  // Override if your provider supports vision
  get supportsVision(): boolean {
    return false;
  }
}
```

### 2. Add to Factory

Update `packages/ai-providers/src/factory.ts`:

```typescript
import { MyProvider } from './providers/myprovider.js';

export function createAIProvider(config: AiProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'myprovider':
      return new MyProvider(config);
    // ...
  }
}
```

### 3. Update Types

Add to `packages/core/src/types/config.ts`:

```typescript
export type AiProviderConfig = {
  provider: 'openai' | 'anthropic' | 'ollama' | 'myprovider' | 'custom' | 'mock';
  // ...
};
```

### 4. Export

Add to `packages/ai-providers/src/index.ts`:

```typescript
export { MyProvider } from './providers/myprovider.js';
```

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @a11y-ai/core test

# Watch mode
pnpm --filter @a11y-ai/rules test -- --watch

# With coverage
pnpm test -- --coverage
```

### Test Utilities

Use the testing utilities in `@a11y-ai/core/testing`:

```typescript
import { createMockContext, createMockProvider } from '@a11y-ai/core/testing';

const context = createMockContext({
  html: '<html>...</html>',
  elements: [
    /* ... */
  ],
});

const provider = createMockProvider({
  responses: {
    'ai/alt-text-quality': { issues: [] },
  },
});
```

## Pull Request Guidelines

1. **Fork and branch**: Create a feature branch from `main`
2. **Make changes**: Implement your feature or fix
3. **Test**: Ensure all tests pass (`pnpm test`)
4. **Lint**: Ensure code passes linting (`pnpm lint`)
5. **Type check**: Ensure no type errors (`pnpm typecheck`)
6. **Document**: Update relevant documentation
7. **Commit**: Use conventional commit messages
8. **PR**: Open a pull request with a clear description

### PR Checklist

- [ ] Tests added/updated for new functionality
- [ ] Documentation updated if public API changed
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Commit messages follow conventional commits

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(rules): add media accessibility rule

fix(core): handle empty HTML input gracefully

docs: update CONTRIBUTING.md with new rule guide

chore(deps): update axe-core to 4.10.0
```

## Questions?

If you have questions, feel free to:

1. Open a [GitHub Discussion](https://github.com/vudayagirivaibhav/a11y-ai/discussions)
2. Check existing [Issues](https://github.com/vudayagirivaibhav/a11y-ai/issues)
3. Read the [package READMEs](./packages)

Thank you for contributing to making the web more accessible!
