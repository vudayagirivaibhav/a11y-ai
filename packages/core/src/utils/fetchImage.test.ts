import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchImage } from './fetchImage.js';

describe('fetchImage', () => {
  describe('data URLs', () => {
    it('parses valid base64 PNG data URL', async () => {
      const pngPixel =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await fetchImage(pngPixel);
      expect(result).not.toBeNull();
      expect(result?.mimeType).toBe('image/png');
      expect(result?.buffer).toBeInstanceOf(Buffer);
    });

    it('parses valid base64 JPEG data URL', async () => {
      const jpegData =
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
      const result = await fetchImage(jpegData);
      expect(result).not.toBeNull();
      expect(result?.mimeType).toBe('image/jpeg');
    });

    it('returns null for unsupported mime type', async () => {
      const textData = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
      const result = await fetchImage(textData);
      expect(result).toBeNull();
    });

    it('returns null for invalid data URL format', async () => {
      const invalid = 'data:image/png;notbase64,invalid';
      const result = await fetchImage(invalid);
      expect(result).toBeNull();
    });

    it('returns null for data URL exceeding max size', async () => {
      const largeData = 'data:image/png;base64,' + 'A'.repeat(10 * 1024 * 1024);
      const result = await fetchImage(largeData, undefined, { maxBytes: 1024 });
      expect(result).toBeNull();
    });
  });

  describe('URL resolution', () => {
    it('returns null for non-http(s) protocols', async () => {
      const result = await fetchImage('file:///path/to/image.png');
      expect(result).toBeNull();
    });

    it('returns null for invalid URLs', async () => {
      const result = await fetchImage('not-a-valid-url');
      expect(result).toBeNull();
    });

    it('resolves relative URLs with base URL', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      await fetchImage('/image.png', 'https://example.com');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/image.png',
        expect.any(Object),
      );

      global.fetch = originalFetch;
    });
  });

  describe('HTTP fetching', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.useRealTimers();
    });

    it('returns null for non-OK responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchImage('https://example.com/image.png');
      expect(result).toBeNull();
    });

    it('returns null for unsupported content types', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      });

      const result = await fetchImage('https://example.com/page.html');
      expect(result).toBeNull();
    });

    it('returns null when content-length exceeds max bytes', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([
          ['content-type', 'image/png'],
          ['content-length', '10000000'],
        ]),
      });

      const result = await fetchImage('https://example.com/large.png', undefined, {
        maxBytes: 1024,
      });
      expect(result).toBeNull();
    });

    it('guesses mime type from URL extension when content-type is missing', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? '' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(pngBuffer.buffer),
      });

      const result = await fetchImage('https://example.com/image.png');
      expect(result?.mimeType).toBe('image/png');
    });

    it('returns cached result on subsequent calls', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(pngBuffer.buffer),
      });
      global.fetch = mockFetch;

      const url = 'https://example.com/cached-image.png';
      const result1 = await fetchImage(url);
      const result2 = await fetchImage(url);

      expect(result1).toEqual(result2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('mime type guessing', () => {
    it('guesses JPEG from .jpg extension', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '' },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      });

      const result = await fetchImage('https://example.com/photo.jpg');
      expect(result?.mimeType).toBe('image/jpeg');
    });

    it('guesses JPEG from .jpeg extension', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '' },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      });

      const result = await fetchImage('https://example.com/photo.jpeg');
      expect(result?.mimeType).toBe('image/jpeg');
    });

    it('guesses WebP from .webp extension', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '' },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      });

      const result = await fetchImage('https://example.com/image.webp');
      expect(result?.mimeType).toBe('image/webp');
    });

    it('guesses GIF from .gif extension', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '' },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      });

      const result = await fetchImage('https://example.com/animation.gif');
      expect(result?.mimeType).toBe('image/gif');
    });

    it('guesses SVG from .svg extension', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '' },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      });

      const result = await fetchImage('https://example.com/icon.svg');
      expect(result?.mimeType).toBe('image/svg+xml');
    });
  });
});
