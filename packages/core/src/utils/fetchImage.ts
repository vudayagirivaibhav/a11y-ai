import { extname } from 'node:path';

type FetchImageResult = { buffer: Buffer; mimeType: string };

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_CACHE_SIZE = 128;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

function guessMimeTypeFromUrl(url: string): string | null {
  const ext = extname(url).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return null;
}

function parseDataUrl(dataUrl: string): FetchImageResult | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1]!.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return null;

  const buffer = Buffer.from(match[2]!, 'base64');
  if (buffer.byteLength > DEFAULT_MAX_BYTES) return null;

  return { buffer, mimeType };
}

class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size <= this.maxSize) return;
    const firstKey = this.map.keys().next().value as K | undefined;
    if (firstKey !== undefined) this.map.delete(firstKey);
  }
}

let cacheSize = DEFAULT_CACHE_SIZE;
let cache = new LruCache<string, FetchImageResult>(cacheSize);

export interface FetchImageOptions {
  /** Abort the request after this many milliseconds. Default: 10s. */
  timeoutMs?: number;

  /** Maximum allowed image size in bytes. Default: 5MB. */
  maxBytes?: number;

  /**
   * Override the in-memory LRU cache size.
   *
   * Note: the cache is process-global. This is intended for CI/test runs, not
   * multi-tenant environments.
   */
  cacheSize?: number;
}

/**
 * Fetch an image by URL (or resolve a data URL), returning a Buffer + mimeType.
 *
 * This is primarily used by vision-capable rules to compare image content with
 * things like alt text.
 */
export async function fetchImage(
  src: string,
  baseUrl?: string,
  options: FetchImageOptions = {},
): Promise<FetchImageResult | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (
    typeof options.cacheSize === 'number' &&
    Number.isFinite(options.cacheSize) &&
    options.cacheSize > 0
  ) {
    if (options.cacheSize !== cacheSize) {
      cacheSize = options.cacheSize;
      cache = new LruCache<string, FetchImageResult>(cacheSize);
    }
  }

  if (src.startsWith('data:')) {
    return parseDataUrl(src);
  }

  let resolved: URL;
  try {
    resolved = baseUrl ? new URL(src, baseUrl) : new URL(src);
  } catch {
    return null;
  }

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;

  const cacheKey = resolved.toString();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(cacheKey, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) return null;

    const contentLengthRaw = res.headers.get('content-length');
    if (contentLengthRaw) {
      const contentLength = Number(contentLengthRaw);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
    }

    const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const mimeType = contentType || guessMimeTypeFromUrl(cacheKey);
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) return null;

    const buffer = Buffer.from(arrayBuffer);
    const result = { buffer, mimeType };
    cache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
