import { describe, expect, it, vi } from 'vitest';

import { TokenBucket } from './tokenBucket.js';

describe('TokenBucket', () => {
  describe('initialization', () => {
    it('initializes with full capacity', async () => {
      let currentTime = 0;
      const bucket = new TokenBucket({
        rpm: 10,
        now: () => currentTime,
        sleep: vi.fn(),
      });

      await bucket.take(10);
    });

    it('handles zero rpm (disabled limiting)', async () => {
      const sleepFn = vi.fn();
      const bucket = new TokenBucket({
        rpm: 0,
        now: () => 0,
        sleep: sleepFn,
      });

      await bucket.take(100);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it('handles negative rpm as zero', async () => {
      const sleepFn = vi.fn();
      const bucket = new TokenBucket({
        rpm: -5,
        now: () => 0,
        sleep: sleepFn,
      });

      await bucket.take(100);
      expect(sleepFn).not.toHaveBeenCalled();
    });
  });

  describe('token consumption', () => {
    it('consumes tokens without waiting when available', async () => {
      let currentTime = 0;
      const sleepFn = vi.fn();
      const bucket = new TokenBucket({
        rpm: 10,
        now: () => currentTime,
        sleep: sleepFn,
      });

      await bucket.take(5);
      expect(sleepFn).not.toHaveBeenCalled();

      await bucket.take(5);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it('waits when tokens are exhausted', async () => {
      let currentTime = 0;
      const sleepFn = vi.fn().mockImplementation((ms: number) => {
        currentTime += ms;
        return Promise.resolve();
      });

      const bucket = new TokenBucket({
        rpm: 5,
        now: () => currentTime,
        sleep: sleepFn,
      });

      await bucket.take(5);
      expect(sleepFn).not.toHaveBeenCalled();

      await bucket.take(1);
      expect(sleepFn).toHaveBeenCalled();
    });

    it('handles count of zero', async () => {
      const sleepFn = vi.fn();
      const bucket = new TokenBucket({
        rpm: 10,
        now: () => 0,
        sleep: sleepFn,
      });

      await bucket.take(0);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it('handles negative count', async () => {
      const sleepFn = vi.fn();
      const bucket = new TokenBucket({
        rpm: 10,
        now: () => 0,
        sleep: sleepFn,
      });

      await bucket.take(-5);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it('defaults count to 1', async () => {
      let currentTime = 0;
      const sleepFn = vi.fn();
      const bucket = new TokenBucket({
        rpm: 2,
        now: () => currentTime,
        sleep: sleepFn,
      });

      await bucket.take();
      await bucket.take();
      expect(sleepFn).not.toHaveBeenCalled();

      await bucket.take();
      expect(sleepFn).toHaveBeenCalled();
    });
  });

  describe('refilling', () => {
    it('refills tokens after one minute', async () => {
      let currentTime = 0;
      const sleepFn = vi.fn().mockImplementation((ms: number) => {
        currentTime += ms;
        return Promise.resolve();
      });

      const bucket = new TokenBucket({
        rpm: 5,
        now: () => currentTime,
        sleep: sleepFn,
      });

      await bucket.take(5);

      currentTime += 60_000;

      sleepFn.mockClear();
      await bucket.take(5);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it('accumulates multiple refill periods', async () => {
      let currentTime = 0;
      const sleepFn = vi.fn();

      const bucket = new TokenBucket({
        rpm: 5,
        now: () => currentTime,
        sleep: sleepFn,
      });

      await bucket.take(5);

      currentTime += 120_000;

      await bucket.take(5);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it('caps tokens at capacity', async () => {
      let currentTime = 0;
      const sleepFn = vi.fn().mockImplementation((ms: number) => {
        currentTime += ms;
        return Promise.resolve();
      });

      const bucket = new TokenBucket({
        rpm: 5,
        now: () => currentTime,
        sleep: sleepFn,
      });

      await bucket.take(3);

      currentTime += 180_000;

      await bucket.take(5);
      expect(sleepFn).not.toHaveBeenCalled();

      await bucket.take(1);
      expect(sleepFn).toHaveBeenCalled();
    });
  });

  describe('concurrent usage', () => {
    it('serializes concurrent take calls', async () => {
      let currentTime = 0;
      let sleepCount = 0;
      const sleepFn = vi.fn().mockImplementation((ms: number) => {
        sleepCount++;
        currentTime += ms;
        return Promise.resolve();
      });

      const bucket = new TokenBucket({
        rpm: 2,
        now: () => currentTime,
        sleep: sleepFn,
      });

      const results = await Promise.all([bucket.take(1), bucket.take(1), bucket.take(1)]);

      expect(results).toHaveLength(3);
      expect(sleepCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('uses default now function when not provided', () => {
      const bucket = new TokenBucket({
        rpm: 10,
        sleep: vi.fn(),
      });
      expect(bucket).toBeDefined();
    });

    it('uses default sleep function when not provided', () => {
      const bucket = new TokenBucket({
        rpm: 10,
        now: () => 0,
      });
      expect(bucket).toBeDefined();
    });

    it('handles large token requests', async () => {
      let currentTime = 0;
      const sleepFn = vi.fn().mockImplementation((ms: number) => {
        currentTime += ms;
        return Promise.resolve();
      });

      const bucket = new TokenBucket({
        rpm: 5,
        now: () => currentTime,
        sleep: sleepFn,
      });

      await bucket.take(10);
      expect(sleepFn).toHaveBeenCalled();
    });
  });
});
