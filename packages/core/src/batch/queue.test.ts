import { describe, expect, it } from 'vitest';

import { runWithConcurrency } from './queue.js';

describe('runWithConcurrency', () => {
  it('does not exceed the configured concurrency', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);

    let active = 0;
    let maxActive = 0;

    await runWithConcurrency({
      items,
      concurrency: 3,
      worker: async (i) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 25));
        active -= 1;
        return i * 2;
      },
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
