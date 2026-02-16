import { describe, expect, it } from 'vitest';

import { mergeConfig } from './config.js';

describe('mergeConfig', () => {
  it('merges rule maps deeply', () => {
    const base = { provider: 'openai', rules: { a: { enabled: true } } };
    const next = mergeConfig(base, { model: 'x', rules: { b: { enabled: false } } });
    expect(next.provider).toBe('openai');
    expect(next.model).toBe('x');
    expect(next.rules?.a.enabled).toBe(true);
    expect(next.rules?.b.enabled).toBe(false);
  });
});

