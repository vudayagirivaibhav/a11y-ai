import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

export function defineSharedVitestConfig() {
  return defineConfig({
    resolve: {
      alias: [
        { find: '@a11y-ai/core/utils', replacement: path.join(repoRoot, 'packages/core/src/utils/index.ts') },
        { find: '@a11y-ai/core/testing', replacement: path.join(repoRoot, 'packages/core/src/testing/index.ts') },
        { find: '@a11y-ai/core/types', replacement: path.join(repoRoot, 'packages/core/src/types-entry.ts') },
        { find: '@a11y-ai/core', replacement: path.join(repoRoot, 'packages/core/src/index.ts') },
        { find: '@a11y-ai/ai-providers', replacement: path.join(repoRoot, 'packages/ai-providers/src/index.ts') },
        { find: '@a11y-ai/rules/types', replacement: path.join(repoRoot, 'packages/rules/src/types-entry.ts') },
        { find: '@a11y-ai/rules', replacement: path.join(repoRoot, 'packages/rules/src/index.ts') },
      ],
    },
    test: {
      globals: true,
      include: ['**/src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json'],
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  });
}
