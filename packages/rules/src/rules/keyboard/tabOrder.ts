import type { ElementSnapshot } from '@a11y-ai/core/types';

export interface TabEntry {
  selector: string;
  tagName: string;
  tabIndex: number | null;
  order: number;
}

const NATIVELY_INTERACTIVE_TAGS = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'details',
  'summary',
]);

function isNativelyInteractive(tagName: string): boolean {
  return NATIVELY_INTERACTIVE_TAGS.has(tagName.toLowerCase());
}

/**
 * Compute the expected keyboard tab order for a list of interactive elements.
 *
 * Algorithm (matches browser behavior):
 * 1. Elements with explicit positive tabindex, sorted ascending, then by DOM order.
 * 2. Elements with tabindex="0" or no tabindex, in DOM order.
 * 3. Elements with tabindex="-1" are excluded.
 */
export function buildTabOrder(elements: ElementSnapshot[]): TabEntry[] {
  const positive: TabEntry[] = [];
  const zero: TabEntry[] = [];

  elements.forEach((el, domIndex) => {
    const raw = el.attributes.tabindex ?? el.attributes.tabIndex;
    const tabIndex = raw !== undefined ? Number(raw) : null;
    const hasRole = el.attributes.role !== undefined;
    const isInteractive = isNativelyInteractive(el.tagName) || hasRole;

    if (tabIndex === -1) return;

    const entry: TabEntry = {
      selector: el.selector,
      tagName: el.tagName,
      tabIndex,
      order: domIndex,
    };

    if (tabIndex !== null && tabIndex > 0) {
      positive.push(entry);
    } else if (isInteractive || tabIndex === 0) {
      zero.push(entry);
    }
  });

  positive.sort((a, b) => a.tabIndex! - b.tabIndex! || a.order - b.order);

  return [...positive, ...zero].map((e, i) => ({ ...e, order: i + 1 }));
}
