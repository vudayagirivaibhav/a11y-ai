# a11y-ai

An open-source AI-powered accessibility auditor npm package. It builds on top of axe-core and adds AI analysis:

- Image alt-text quality
- Meaningful link text
- Visual contrast issues
- Form label relevance

## Requirements

- Node.js >= 18 (see `.nvmrc`)

## Development

This repo is a `pnpm` workspace:

- `packages/core` — published `a11y-ai` package (dual ESM/CJS via `tsup`)
- `packages/ai-providers` — provider adapters (OpenAI/Anthropic/Ollama/Mock)

1. Install dependencies:
   - `corepack enable`
   - `pnpm install`
2. Build:
   - `pnpm build` (runs `pnpm -r build`)

## CLI (stub)

After building, run:

- `node packages/core/dist/cli.mjs`
