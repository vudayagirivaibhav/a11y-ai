import { describe, expect, it } from 'vitest';

import { compareWith } from './compare.js';

describe('compareWith', () => {
  it('computes score deltas', () => {
    const prev: any = { summary: { score: 70 } };
    const curr: any = { summary: { score: 80 } };
    const cmp = compareWith(prev, curr);
    expect(cmp.delta).toBe(10);
    expect(cmp.direction).toBe('improved');
  });
});

