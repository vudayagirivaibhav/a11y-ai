type NowFn = () => number;
type SleepFn = (ms: number) => Promise<void>;

const defaultNow: NowFn = () => Date.now();
const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Minimal token bucket limiter for "requests per minute".
 *
 * This is intentionally simple and per-instance. It is meant to prevent bursts
 * during development/CI, not to perfectly mirror provider-side throttling.
 */
export class TokenBucket {
  private readonly capacity: number;
  private readonly refillMs: number;
  private tokens: number;
  private lastRefillAt: number;
  private readonly now: NowFn;
  private readonly sleep: SleepFn;

  constructor(options: { rpm: number; now?: NowFn; sleep?: SleepFn }) {
    const rpm = Math.max(0, options.rpm);
    this.capacity = rpm;
    this.refillMs = 60_000;
    this.tokens = rpm;
    this.lastRefillAt = (options.now ?? defaultNow)();
    this.now = options.now ?? defaultNow;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async take(count = 1): Promise<void> {
    if (this.capacity === 0) return;
    if (count <= 0) return;

    while (true) {
      this.refillIfNeeded();

      if (this.tokens >= count) {
        this.tokens -= count;
        return;
      }

      const waitMs = Math.max(0, this.lastRefillAt + this.refillMs - this.now());
      await this.sleep(waitMs);
    }
  }

  private refillIfNeeded(): void {
    const now = this.now();
    const elapsed = now - this.lastRefillAt;
    if (elapsed < this.refillMs) return;

    const buckets = Math.floor(elapsed / this.refillMs);
    this.tokens = Math.min(this.capacity, this.tokens + buckets * this.capacity);
    this.lastRefillAt += buckets * this.refillMs;
  }
}

