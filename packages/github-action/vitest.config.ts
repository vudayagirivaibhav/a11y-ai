import { defineConfig } from 'vitest/config';

import { defineSharedVitestConfig } from '../../vitest.shared.ts';

const shared = defineSharedVitestConfig();

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    include: ['src/**/*.test.ts'],
  },
});
