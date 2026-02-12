#!/usr/bin/env node
import { existsSync } from 'node:fs';

// In the published package, `dist/cli.mjs` will exist.
// In the workspace during development, it may not exist until you build.
const cliPath = new URL('../dist/cli.mjs', import.meta.url);

if (!existsSync(cliPath)) {
  // eslint-disable-next-line no-console
  console.error('[a11y-ai] CLI build not found at packages/core/dist/cli.mjs');
  // eslint-disable-next-line no-console
  console.error('Run: pnpm -C packages/core build');
  process.exit(1);
}

await import(cliPath.href);

