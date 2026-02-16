import type { CacheAdapter } from '../types/cache.js';

/**
 * Simple in-memory TTL cache.
 *
 * This is the default cache used by the auditor.
 */
export class MemoryCacheAdapter implements CacheAdapter {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const expiresAt = Date.now() + Math.max(0, ttlMs);
    this.store.set(key, { value, expiresAt });
  }
}

