import { createHash } from 'node:crypto';

/**
 * Create a stable SHA-256 hex digest for a string.
 */
export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

