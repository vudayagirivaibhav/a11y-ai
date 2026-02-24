import { describe, expect, it } from 'vitest';
import type { AuditResult } from '@a11y-ai/core';

import { compareWith } from './compare.js';

describe('compareWith', () => {
  it('computes score deltas', () => {
    const prev = { summary: { score: 70 } } as AuditResult;
    const curr = { summary: { score: 80 } } as AuditResult;
    const cmp = compareWith(prev, curr);
    expect(cmp.delta).toBe(10);
    expect(cmp.direction).toBe('improved');
  });
});
