import type {
  BoundingBox,
  ComputedStyleSubset,
  ElementSnapshot,
  ExtractionResult,
  FormElement,
  FormFieldElement,
  ImageElement,
  LinkElement,
} from '../types/extraction.js';

import { buildDocumentOutline, sanitizeHtml, truncateContent } from './utils.js';

/**
 * Minimal interface shared by Playwright and Puppeteer `Page`.
 *
 * We keep this intentionally tiny so we don't need a hard dependency on either SDK.
 */
export interface BrowserAutomationPage {
  evaluate<TResult, TArgs extends unknown[] = unknown[]>(
    pageFunction: (...args: TArgs) => TResult | Promise<TResult>,
    ...args: TArgs
  ): Promise<TResult>;
}

type ExtractedPageData = {
  pageTitle: string;
  pageLanguage: string | null;
  metaDescription: string | null;
  images: ImageElement[];
  links: LinkElement[];
  forms: FormElement[];
  headings: ElementSnapshot[];
  ariaElements: ElementSnapshot[];
  html: string;
};

/**
 * Extract snapshots from an existing browser automation page (Playwright/Puppeteer).
 *
 * The page is expected to support:
 * - `evaluate(fn, ...args)`
 */
export async function extractFromAutomationPage(options: {
  page: BrowserAutomationPage;
  url: string;
  maxElementHtmlLength: number;
  maxTextLength: number;
  maxRawHtmlLength: number;
}): Promise<ExtractionResult> {
  const { page, url, maxElementHtmlLength, maxTextLength, maxRawHtmlLength } = options;

  const data = await page.evaluate<ExtractedPageData, [number, number]>(
    (maxElementHtmlLengthIn: number, maxTextLengthIn: number): ExtractedPageData => {
      const cssEscape = (value: string): string =>
        value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);

      const buildSelector = (el: Element): string => {
        const parts: string[] = [];
        let current: Element | null = el;
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
            (s: Element) => s.tagName.toLowerCase() === tag,
          );
          const index = siblings.indexOf(current);
          const needsNth = siblings.length > 1 && index >= 0;
          parts.unshift(needsNth ? `${tag}:nth-of-type(${index + 1})` : tag);
          current = parentEl;
        }
        return parts.join(' > ');
      };

      const attrsToRecord = (el: Element): Record<string, string> => {
        const attrs: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
        return attrs;
      };

      const normalizeText = (t: string): string => t.replace(/\s+/g, ' ').trim();

      const truncate = (t: string, max: number): string =>
        t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1))}…`;

      const styleSubset = (el: Element): ComputedStyleSubset => {
        const s = getComputedStyle(el);
        return {
          color: s.color ?? '',
          backgroundColor: s.backgroundColor ?? '',
          fontSize: s.fontSize ?? '',
          display: s.display ?? '',
          visibility: s.visibility ?? '',
          opacity: s.opacity ?? '',
        };
      };

      const boundingBox = (el: Element): BoundingBox => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };

      const toSnapshot = (el: Element): ElementSnapshot => ({
        selector: buildSelector(el),
        html: truncate(el.outerHTML ?? '', maxElementHtmlLengthIn),
        tagName: el.tagName.toLowerCase(),
        attributes: attrsToRecord(el),
        textContent: truncate(normalizeText(el.textContent ?? ''), maxTextLengthIn),
        computedStyle: styleSubset(el),
        boundingBox: boundingBox(el),
      });

      const images: ImageElement[] = Array.from(document.querySelectorAll('img')).map(
        (el): ImageElement => {
          const snap = toSnapshot(el);
          const alt = el.getAttribute('alt');
          return {
            ...snap,
            src: el.getAttribute('src') ?? '',
            alt,
            hasAlt: el.hasAttribute('alt'),
          };
        },
      );

      const links: LinkElement[] = Array.from(document.querySelectorAll('a')).map(
        (el): LinkElement => ({
          ...toSnapshot(el),
          href: el.getAttribute('href'),
        }),
      );

      const headings: ElementSnapshot[] = Array.from(
        document.querySelectorAll('h1,h2,h3,h4,h5,h6'),
      ).map(toSnapshot);

      const ariaElements: ElementSnapshot[] = Array.from(document.querySelectorAll('*'))
        .filter((el) => {
          if (el.hasAttribute('role')) return true;
          for (const attr of Array.from(el.attributes)) {
            if (attr.name.startsWith('aria-')) return true;
          }
          return false;
        })
        .map(toSnapshot);

      const forms: FormElement[] = Array.from(document.querySelectorAll('form')).map(
        (form): FormElement => {
          const fields: FormFieldElement[] = Array.from(
            form.querySelectorAll('input,select,textarea'),
          ).map((field): FormFieldElement => {
            const id = field.getAttribute('id');
            const label = id ? document.querySelector(`label[for="${cssEscape(id)}"]`) : null;
            return {
              ...toSnapshot(field),
              id,
              name: field.getAttribute('name'),
              type: field.getAttribute('type'),
              placeholder: field.getAttribute('placeholder'),
              title: field.getAttribute('title'),
              required:
                (field.getAttribute('aria-required') ?? '').toLowerCase() === 'true' ||
                field.hasAttribute('required'),
              autocomplete: field.getAttribute('autocomplete'),
              labelText: label ? normalizeText(label.textContent ?? '') : null,
              ariaLabel: field.getAttribute('aria-label'),
              ariaLabelledBy: field.getAttribute('aria-labelledby'),
            };
          });

          return {
            ...toSnapshot(form),
            fields,
          };
        },
      );

      return {
        pageTitle: normalizeText(document.title ?? ''),
        pageLanguage: document.documentElement.getAttribute('lang'),
        metaDescription:
          document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
        images,
        links,
        forms,
        headings,
        ariaElements,
        html: document.documentElement.outerHTML ?? '',
      };
    },
    maxElementHtmlLength,
    maxTextLength,
  );

  const outline = buildDocumentOutline(data.headings);
  const rawHTML = truncateContent(sanitizeHtml(data.html), maxRawHtmlLength);

  return {
    url,
    images: data.images,
    links: data.links,
    forms: data.forms,
    headings: data.headings,
    ariaElements: data.ariaElements,
    pageTitle: data.pageTitle,
    pageLanguage: data.pageLanguage,
    metaDescription: data.metaDescription,
    documentOutline: outline,
    rawHTML,
  };
}
