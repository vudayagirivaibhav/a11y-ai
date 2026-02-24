import { describe, expect, it } from 'vitest';

import { readInputsFromEnv } from './lib.js';

describe('github-action input parsing', () => {
  it('parses inputs from INPUT_* env vars', () => {
    const env = {
      INPUT_URL: 'https://example.com',
      INPUT_PRESET: 'quick',
      INPUT_THRESHOLD: '80',
      INPUT_PROVIDER: 'openai',
      INPUT_API_KEY: 'x',
      INPUT_FORMAT: 'markdown',
      INPUT_FAIL_ON_VIOLATIONS: 'false',
    } as NodeJS.ProcessEnv;

    const inputs = readInputsFromEnv(env);
    expect(inputs.url).toBe('https://example.com');
    expect(inputs.preset).toBe('quick');
    expect(inputs.threshold).toBe(80);
    expect(inputs.failOnViolations).toBe(false);
  });
});
