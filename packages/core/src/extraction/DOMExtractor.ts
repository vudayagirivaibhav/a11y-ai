import type {
  ElementSnapshot,
  ExtractionResult,
  FormElement,
  FormFieldElement,
  ImageElement,
  LinkElement,
} from '../types/index.js';

import {
  attributesToRecord,
  buildDocumentOutline,
  buildSelector,
  getBoundingBox,
  getComputedStyleSubset,
  normalizeText,
  sanitizeHtml,
  truncateContent,
} from './utils.js';

/**
 * Input source for DOM extraction.
 */
export type DOMExtractorInput =
  | {
      /** Raw HTML string to parse. */
      html: string;
      url?: undefined;
    }
  | {
      /** Page URL to load and extract from. */
      url: string;
      html?: undefined;
    };

/**
 * Runtime options for DOM extraction.
 */
export interface DOMExtractorOptions {
  /** Maximum length of stored element HTML (outerHTML). */
  maxElementHtmlLength?: number;

  /** Maximum length of stored text content. */
  maxTextLength?: number;

  /** Maximum length of sanitized `rawHTML` in the final result. */
  maxRawHtmlLength?: number;

  /** Viewport size used for URL-based extraction (when supported). */
  viewport?: { width: number; height: number };

  /** Navigation + extraction timeout (ms) for URL-based extraction. */
  timeoutMs?: number;

  /**
   * Which browser automation library to use for URL-based extraction.
   *
   * - `auto`: prefer playwright, fallback to puppeteer
   * - `playwright`: use playwright only
   * - `puppeteer`: use puppeteer only
   */
  browser?: 'auto' | 'playwright' | 'puppeteer';
}

const DEFAULTS: Required<
  Pick<DOMExtractorOptions, 'maxElementHtmlLength' | 'maxTextLength' | 'maxRawHtmlLength' | 'timeoutMs' | 'browser'>
> = {
  maxElementHtmlLength: 2_000,
  maxTextLength: 500,
  maxRawHtmlLength: 200_000,
  timeoutMs: 30_000,
  browser: 'auto',
};

/**
 * Extracts accessibility-relevant element snapshots from either:
 * - static HTML (via jsdom), or
 * - a live URL (via playwright/puppeteer, optional peer deps)
 */
export class DOMExtractor {
  private readonly input: DOMExtractorInput;
  private readonly options: DOMExtractorOptions;

  constructor(input: DOMExtractorInput, options: DOMExtractorOptions = {}) {
    this.input = input;
    this.options = options;
  }

  /**
   * Extract all supported snapshot collections and page metadata.
   */
  async extractAll(): Promise<ExtractionResult> {
    if ('html' in this.input) {
      return await this.extractFromHtml(this.input.html);
    }
    return await this.extractFromUrl(this.input.url);
  }

  /**
   * Extract only image elements.
   */
  async extractImages(): Promise<ImageElement[]> {
    const all = await this.extractAll();
    return all.images;
  }

  /**
   * Extract only link elements.
   */
  async extractLinks(): Promise<LinkElement[]> {
    const all = await this.extractAll();
    return all.links;
  }

  /**
   * Extract only form elements.
   */
  async extractForms(): Promise<FormElement[]> {
    const all = await this.extractAll();
    return all.forms;
  }

  /**
   * Extract only heading elements (`h1`..`h6`).
   */
  async extractHeadings(): Promise<ElementSnapshot[]> {
    const all = await this.extractAll();
    return all.headings;
  }

  /**
   * Extract only elements that include ARIA attributes or explicit roles.
   */
  async extractARIA(): Promise<ElementSnapshot[]> {
    const all = await this.extractAll();
    return all.ariaElements;
  }

  private mergedOptions(): Required<DOMExtractorOptions> {
    return {
      maxElementHtmlLength: this.options.maxElementHtmlLength ?? DEFAULTS.maxElementHtmlLength,
      maxTextLength: this.options.maxTextLength ?? DEFAULTS.maxTextLength,
      maxRawHtmlLength: this.options.maxRawHtmlLength ?? DEFAULTS.maxRawHtmlLength,
      viewport: this.options.viewport ?? { width: 1280, height: 720 },
      timeoutMs: this.options.timeoutMs ?? DEFAULTS.timeoutMs,
      browser: this.options.browser ?? DEFAULTS.browser,
    };
  }

  private async extractFromHtml(html: string): Promise<ExtractionResult> {
    let JSDOM: typeof import('jsdom').JSDOM;
    try {
      ({ JSDOM } = await import('jsdom'));
    } catch (error) {
      throw new Error(
        'jsdom is required for HTML string extraction. Install it as a dependency (e.g., `pnpm add jsdom`).',
        { cause: error },
      );
    }
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const pageTitle = normalizeText(document.title ?? '');
    const pageLanguage = document.documentElement.getAttribute('lang');
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;

    const images = this.extractImagesFromDocument(document, dom.window.getComputedStyle.bind(dom.window));
    const links = this.extractLinksFromDocument(document, dom.window.getComputedStyle.bind(dom.window));
    const forms = this.extractFormsFromDocument(document, dom.window.getComputedStyle.bind(dom.window));
    const headings = this.extractHeadingsFromDocument(document, dom.window.getComputedStyle.bind(dom.window));
    const ariaElements = this.extractAriaFromDocument(document, dom.window.getComputedStyle.bind(dom.window));

    const outline = buildDocumentOutline(headings);

    const sanitized = sanitizeHtml(document.documentElement.outerHTML);
    const rawHTML = truncateContent(sanitized, this.mergedOptions().maxRawHtmlLength);

    return {
      url: null,
      images,
      links,
      forms,
      headings,
      ariaElements,
      pageTitle,
      pageLanguage,
      metaDescription,
      documentOutline: outline,
      rawHTML,
    };
  }

  private async extractFromUrl(url: string): Promise<ExtractionResult> {
    const options = this.mergedOptions();

    if (options.browser === 'playwright') {
      return await this.extractUsingPlaywright(url);
    }
    if (options.browser === 'puppeteer') {
      return await this.extractUsingPuppeteer(url);
    }

    try {
      return await this.extractUsingPlaywright(url);
    } catch {
      try {
        return await this.extractUsingPuppeteer(url);
      } catch (error) {
        throw new Error(
          'URL-based extraction requires either playwright or puppeteer. Install one of them (e.g., `pnpm add -D playwright`).',
          { cause: error },
        );
      }
    }
  }

  private async extractUsingPlaywright(url: string): Promise<ExtractionResult> {
    // Dynamic import so playwright stays an optional peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('playwright');
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (!chromium) throw new Error('playwright chromium not available');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const browser = await chromium.launch();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const page = await browser.newPage({ viewport: this.mergedOptions().viewport });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await page.goto(url, { waitUntil: 'networkidle', timeout: this.mergedOptions().timeoutMs });
      return await this.extractFromLivePage(page, url);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await browser.close();
    }
  }

  private async extractUsingPuppeteer(url: string): Promise<ExtractionResult> {
    // Dynamic import so puppeteer stays an optional peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('puppeteer');
    const puppeteer = mod.default ?? mod;
    if (!puppeteer?.launch) throw new Error('puppeteer not available');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const browser = await puppeteer.launch();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const page = await browser.newPage();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await page.setViewport(this.mergedOptions().viewport);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await page.goto(url, { waitUntil: 'networkidle0', timeout: this.mergedOptions().timeoutMs });
      return await this.extractFromLivePage(page, url);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await browser.close();
    }
  }

  private async extractFromLivePage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any,
    url: string,
  ): Promise<ExtractionResult> {
    const options = this.mergedOptions();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    const data = await page.evaluate(
      (maxElementHtmlLength: number, maxTextLength: number) => {
        const cssEscape = (value: string) =>
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
            const parent = current.parentElement;
            if (!parent) {
              parts.unshift(tag);
              break;
            }
            const siblings = Array.from(parent.children).filter(
              (s) => s.tagName.toLowerCase() === tag,
            );
            const index = siblings.indexOf(current);
            const needsNth = siblings.length > 1 && index >= 0;
            parts.unshift(needsNth ? `${tag}:nth-of-type(${index + 1})` : tag);
            current = parent;
          }
          return parts.join(' > ');
        };

        const attrsToRecord = (el: Element) => {
          const attrs: Record<string, string> = {};
          for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
          return attrs;
        };

        const normalizeText = (t: string) => t.replace(/\s+/g, ' ').trim();

        const truncate = (t: string, max: number) =>
          t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1))}…`;

        const styleSubset = (el: Element) => {
          const s = getComputedStyle(el);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bg = (s as any).backgroundColor ?? '';
          return {
            color: s.color ?? '',
            backgroundColor: bg,
            fontSize: s.fontSize ?? '',
            display: s.display ?? '',
            visibility: s.visibility ?? '',
            opacity: s.opacity ?? '',
          };
        };

        const boundingBox = (el: Element) => {
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };

        const toSnapshot = (el: Element) => ({
          selector: buildSelector(el),
          html: truncate(el.outerHTML ?? '', maxElementHtmlLength),
          tagName: el.tagName.toLowerCase(),
          attributes: attrsToRecord(el),
          textContent: truncate(normalizeText(el.textContent ?? ''), maxTextLength),
          computedStyle: styleSubset(el),
          boundingBox: boundingBox(el),
        });

        const images = Array.from(document.querySelectorAll('img')).map((el) => {
          const snap = toSnapshot(el);
          const alt = el.getAttribute('alt');
          return {
            ...snap,
            src: el.getAttribute('src') ?? '',
            alt,
            hasAlt: el.hasAttribute('alt'),
          };
        });

        const links = Array.from(document.querySelectorAll('a')).map((el) => ({
          ...toSnapshot(el),
          href: el.getAttribute('href'),
        }));

        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(toSnapshot);

        const ariaElements = Array.from(document.querySelectorAll('*')).filter((el) => {
          if (el.hasAttribute('role')) return true;
          for (const attr of Array.from(el.attributes)) {
            if (attr.name.startsWith('aria-')) return true;
          }
          return false;
        }).map(toSnapshot);

        const forms = Array.from(document.querySelectorAll('form')).map((form) => {
          const fields = Array.from(
            form.querySelectorAll('input,select,textarea'),
          ).map((field) => {
            const id = field.getAttribute('id');
            const label = id ? document.querySelector(`label[for="${cssEscape(id)}"]`) : null;
            return {
              ...toSnapshot(field),
              name: field.getAttribute('name'),
              type: field.getAttribute('type'),
              labelText: label ? normalizeText(label.textContent ?? '') : null,
              ariaLabel: field.getAttribute('aria-label'),
              ariaLabelledBy: field.getAttribute('aria-labelledby'),
            };
          });

          return {
            ...toSnapshot(form),
            fields,
          };
        });

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
      options.maxElementHtmlLength,
      options.maxTextLength,
    );

    const outline = buildDocumentOutline(data.headings);
    const rawHTML = truncateContent(sanitizeHtml(data.html), options.maxRawHtmlLength);

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

  private elementSnapshotFromElement(
    element: Element,
    getComputedStyle: (el: Element) => CSSStyleDeclaration,
  ): ElementSnapshot {
    const options = this.mergedOptions();
    return {
      selector: buildSelector(element),
      html: truncateContent(element.outerHTML ?? '', options.maxElementHtmlLength),
      tagName: element.tagName.toLowerCase(),
      attributes: attributesToRecord(element),
      textContent: truncateContent(normalizeText(element.textContent ?? ''), options.maxTextLength),
      computedStyle: getComputedStyleSubset(element, getComputedStyle),
      boundingBox: getBoundingBox(element),
    };
  }

  private extractImagesFromDocument(
    document: Document,
    getComputedStyle: (el: Element) => CSSStyleDeclaration,
  ): ImageElement[] {
    const images = Array.from(document.querySelectorAll('img'));
    return images.map((img) => {
      const snap = this.elementSnapshotFromElement(img, getComputedStyle);
      return {
        ...snap,
        src: img.getAttribute('src') ?? '',
        alt: img.getAttribute('alt'),
        hasAlt: img.hasAttribute('alt'),
      };
    });
  }

  private extractLinksFromDocument(
    document: Document,
    getComputedStyle: (el: Element) => CSSStyleDeclaration,
  ): LinkElement[] {
    return Array.from(document.querySelectorAll('a')).map((a) => ({
      ...this.elementSnapshotFromElement(a, getComputedStyle),
      href: a.getAttribute('href'),
    }));
  }

  private extractFormsFromDocument(
    document: Document,
    getComputedStyle: (el: Element) => CSSStyleDeclaration,
  ): FormElement[] {
    const forms = Array.from(document.querySelectorAll('form'));
    return forms.map((form) => {
      const fields = Array.from(form.querySelectorAll('input,select,textarea')).map((field) =>
        this.snapshotFormField(field, document, getComputedStyle),
      );

      return {
        ...this.elementSnapshotFromElement(form, getComputedStyle),
        fields,
      };
    });
  }

  private snapshotFormField(
    field: Element,
    document: Document,
    getComputedStyle: (el: Element) => CSSStyleDeclaration,
  ): FormFieldElement {
    const snap = this.elementSnapshotFromElement(field, getComputedStyle);
    const id = field.getAttribute('id');

    const labelText =
      id && id.trim()
        ? normalizeText(document.querySelector(`label[for="${cssEscape(id)}"]`)?.textContent ?? '')
        : '';

    const hasLabelText = labelText.trim().length > 0;

    return {
      ...snap,
      name: field.getAttribute('name'),
      type: field.getAttribute('type'),
      labelText: hasLabelText ? labelText : null,
      ariaLabel: field.getAttribute('aria-label'),
      ariaLabelledBy: field.getAttribute('aria-labelledby'),
    };
  }

  private extractHeadingsFromDocument(
    document: Document,
    getComputedStyle: (el: Element) => CSSStyleDeclaration,
  ): ElementSnapshot[] {
    return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) =>
      this.elementSnapshotFromElement(h, getComputedStyle),
    );
  }

  private extractAriaFromDocument(
    document: Document,
    getComputedStyle: (el: Element) => CSSStyleDeclaration,
  ): ElementSnapshot[] {
    const elements = Array.from(document.querySelectorAll('*')).filter((el) => {
      if (el.hasAttribute('role')) return true;
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('aria-')) return true;
      }
      return false;
    });

    return elements.map((el) => this.elementSnapshotFromElement(el, getComputedStyle));
  }
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}
