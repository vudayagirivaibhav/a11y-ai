/**
 * Cache entry wrapper used for TTL-based caches.
 */
export interface CacheEntry<T> {
  /** Cached value. */
  value: T;

  /** Expiration timestamp in milliseconds since epoch. */
  expiresAt: number;
}

/**
 * Minimal cache adapter interface used by the auditor for AI response caching.
 *
 * Implementations can be:
 * - in-memory (default)
 * - disk-backed
 * - redis/memcached
 * - custom (bring-your-own)
 */
export interface CacheAdapter {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
}

