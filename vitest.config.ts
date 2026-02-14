import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * Vitest runs against TypeScript source, not built `dist/` artifacts.
 *
 * Since workspace packages export `dist/*` in their `package.json`, we alias
 * workspace imports back to their source entrypoints for local testing.
 */
export default defineConfig({
  resolve: {
    alias: {
      'a11y-ai': path.join(repoRoot, 'packages/core/src/index.ts'),
      'a11y-ai/types': path.join(repoRoot, 'packages/core/src/types-entry.ts'),
      '@a11y-ai/ai-providers': path.join(repoRoot, 'packages/ai-providers/src/index.ts'),
      '@a11y-ai/rules': path.join(repoRoot, 'packages/rules/src/index.ts'),
    },
  },
  test: {
    globals: true,
    include: ['packages/**/src/**/*.test.ts'],
  },
});
