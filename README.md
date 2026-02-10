# a11y-ai

An open-source AI-powered accessibility auditor npm package. It builds on top of axe-core and adds AI analysis:

- Image alt-text quality
- Meaningful link text
- Visual contrast issues
- Form label relevance

## Requirements

- Node.js >= 18 (see `.nvmrc`)

## Development

This repo is scaffolded for `pnpm` + `tsup` (dual ESM/CJS).

1. Install dependencies:
   - `corepack enable`
   - `pnpm install`
2. Build:
   - `pnpm build`

## CLI (stub)

After building, run:

- `node dist/cli.mjs`
