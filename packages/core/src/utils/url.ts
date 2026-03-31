/**
 * Shared URL and HTML detection utilities.
 */

/**
 * Check if a string looks like HTML content.
 */
export function looksLikeHtml(text: string): boolean {
  return text.startsWith('<') && text.includes('>');
}

/**
 * Check if a string looks like a valid URL.
 */
export function looksLikeUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a relative URL against a base URL.
 * Returns null if the URL cannot be resolved.
 */
export function resolveUrl(src: string, baseUrl?: string): URL | null {
  try {
    return baseUrl ? new URL(src, baseUrl) : new URL(src);
  } catch {
    return null;
  }
}
