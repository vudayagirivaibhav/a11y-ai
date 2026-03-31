import type {
  BoundingBox,
  ComputedStyleSubset,
  ElementSnapshot,
  HeadingNode,
} from '../types/index.js';

/**
 * Safely truncate text without throwing on undefined/null values.
 */
export function truncateContent(text: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

/**
 * Best-effort unique CSS selector builder.
 *
 * Strategy:
 * - If an element has an id, use `#id` (and stop).
 * - Otherwise build a path using tag names + `:nth-of-type()` to disambiguate.
 */
export function buildSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current) {
    const id = current.getAttribute?.('id');
    if (id && id.trim()) {
      parts.unshift(`#${cssEscape(id.trim())}`);
      break;
    }

    const tag = current.tagName.toLowerCase();
    const parentEl: Element | null = current.parentElement;
    if (!parentEl) {
      parts.unshift(tag);
      break;
    }

    const siblings = (Array.from(parentEl.children) as Element[]).filter(
      (el: Element) => el.tagName.toLowerCase() === tag,
    );
    const index = siblings.indexOf(current);
    const needsNth = siblings.length > 1 && index >= 0;
    parts.unshift(needsNth ? `${tag}:nth-of-type(${index + 1})` : tag);

    current = parentEl;
  }

  return parts.join(' > ');
}

/**
 * Minimal CSS escape implementation for ids and attribute-derived tokens.
 */
function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

/**
 * Extract a subset of computed style properties used by accessibility checks.
 *
 * For jsdom, computed styles are best-effort and may reflect defaults.
 */
export function getComputedStyleSubset(
  element: Element,
  getComputedStyle: (el: Element) => CSSStyleDeclaration,
): ComputedStyleSubset {
  const style = getComputedStyle(element);
  return {
    color: style.color ?? '',
    backgroundColor: (style as unknown as { backgroundColor?: string }).backgroundColor ?? '',
    fontSize: style.fontSize ?? '',
    display: style.display ?? '',
    visibility: style.visibility ?? '',
    opacity: style.opacity ?? '',
  };
}

/**
 * Extract a bounding box for an element, when the environment supports layout.
 */
export function getBoundingBox(element: Element): BoundingBox | undefined {
  const anyEl = element as unknown as { getBoundingClientRect?: () => DOMRect };
  if (typeof anyEl.getBoundingClientRect !== 'function') return undefined;

  const rect = anyEl.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Normalize text content for use in prompts (collapse whitespace).
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Remove noise from HTML for AI contexts.
 *
 * Removes:
 * - <script>, <style>, <noscript>
 * - HTML comments
 */
export function sanitizeHtml(html: string): string {
  let out = html;
  out = out.replace(/<!--([\s\S]*?)-->/g, '');
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
  return out.trim();
}

/**
 * Build a heading outline tree from extracted heading snapshots.
 */
export function buildDocumentOutline(headings: ElementSnapshot[]): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const heading of headings) {
    const match = heading.tagName.match(/^h([1-6])$/);
    if (!match) continue;
    const level = Number(match[1]);
    if (!Number.isFinite(level) || level < 1 || level > 6) continue;

    const node: HeadingNode = {
      level,
      text: heading.textContent,
      selector: heading.selector,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (!parent) {
      root.push(node);
    } else {
      parent.children.push(node);
    }

    stack.push(node);
  }

  return root;
}

/**
 * Best-effort helper to convert an element's attributes into a plain object.
 */
export function attributesToRecord(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

const LANDMARK_ROLES = new Set([
  'main',
  'navigation',
  'complementary',
  'contentinfo',
  'banner',
  'search',
  'form',
  'region',
]);

const LANDMARK_TAGS: Record<string, string> = {
  main: 'main',
  nav: 'navigation',
  aside: 'complementary',
  footer: 'contentinfo',
  header: 'banner',
  form: 'form',
};

/**
 * Walk up the DOM tree to find the nearest landmark ancestor.
 * Returns the landmark role name or null.
 */
export function getLandmark(element: Element): string | null {
  let current: Element | null = element.parentElement;
  while (current) {
    const role = current.getAttribute('role');
    if (role && LANDMARK_ROLES.has(role)) return role;
    const tag = current.tagName.toLowerCase();
    if (LANDMARK_TAGS[tag]) return LANDMARK_TAGS[tag]!;
    current = current.parentElement;
  }
  return null;
}

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'li',
  'td',
  'th',
  'blockquote',
  'figcaption',
  'figure',
]);

/**
 * Get the text content of the nearest block-level ancestor, trimmed to maxLength.
 */
export function getSurroundingText(element: Element, maxLength = 200): string {
  let current: Element | null = element.parentElement;
  while (current) {
    if (BLOCK_TAGS.has(current.tagName.toLowerCase())) {
      const text = normalizeText(current.textContent ?? '');
      return text.slice(0, maxLength);
    }
    current = current.parentElement;
  }
  return '';
}
