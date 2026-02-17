import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core/vitest.config.ts',
  'packages/ai-providers/vitest.config.ts',
  'packages/rules/vitest.config.ts',
  'packages/cli/vitest.config.ts'
]);

