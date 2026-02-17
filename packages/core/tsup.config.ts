import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/types-entry.ts', 'src/testing/index.ts', 'src/utils/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  splitting: false,
  external: ['jsdom', 'playwright', 'puppeteer'],
  platform: 'node',
  target: 'es2022',
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
});
