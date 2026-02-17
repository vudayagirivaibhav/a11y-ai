type NowFn = () => number;
type SleepFn = (ms: number) => Promise<void>;

const defaultNow: NowFn = () => Date.now();
const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Configuration for a `TokenBucket` instance.
 */
type TokenBucketOptions = {
  /**
   * Requests-per-minute.
   *
   * If this is `0`, limiting is effectively disabled (calls will not wait).
   */
  rpm: number;

  /**
   * Time source override used in tests.
   *
   * Defaults to `Date.now`.
   */
  now?: NowFn;

  /**
   * Sleep implementation override used in tests.
   *
   * Defaults to a `setTimeout`-based sleep.
   */
  sleep?: SleepFn;
};

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

  /**
   * Create a new token bucket limiter.
   */
  constructor(options: TokenBucketOptions) {
    const rpm = Math.max(0, options.rpm);
    this.capacity = rpm;
    this.refillMs = 60_000;
    this.tokens = rpm;
    this.lastRefillAt = (options.now ?? defaultNow)();
    this.now = options.now ?? defaultNow;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /**
   * Consume tokens from the bucket.
   *
   * If insufficient tokens are available, this waits until the bucket refills.
   * This method is safe to call concurrently; callers will serialize on the
   * awaited `sleep(...)` between refill windows.
   */
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
