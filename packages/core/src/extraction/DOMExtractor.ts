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
import { extractFromAutomationPage } from './fromPage.js';

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
  Pick<
    DOMExtractorOptions,
    'maxElementHtmlLength' | 'maxTextLength' | 'maxRawHtmlLength' | 'timeoutMs' | 'browser'
  >
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
    const html = (this.input as { html?: string }).html;
    if (typeof html === 'string') {
      return await this.extractFromHtml(html);
    }

    const url = (this.input as { url?: string }).url;
    if (typeof url === 'string') {
      return await this.extractFromUrl(url);
    }

    throw new Error('DOMExtractor requires either { html } or { url } input');
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
    const metaDescription =
      document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;

    const images = this.extractImagesFromDocument(
      document,
      dom.window.getComputedStyle.bind(dom.window),
    );
    const links = this.extractLinksFromDocument(
      document,
      dom.window.getComputedStyle.bind(dom.window),
    );
    const forms = this.extractFormsFromDocument(
      document,
      dom.window.getComputedStyle.bind(dom.window),
    );
    const headings = this.extractHeadingsFromDocument(
      document,
      dom.window.getComputedStyle.bind(dom.window),
    );
    const ariaElements = this.extractAriaFromDocument(
      document,
      dom.window.getComputedStyle.bind(dom.window),
    );

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

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: this.mergedOptions().viewport });
      await page.goto(url, { waitUntil: 'networkidle', timeout: this.mergedOptions().timeoutMs });
      return await this.extractFromLivePage(page, url);
    } finally {
      await browser.close();
    }
  }

  private async extractUsingPuppeteer(url: string): Promise<ExtractionResult> {
    // Dynamic import so puppeteer stays an optional peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('puppeteer');
    const puppeteer = mod.default ?? mod;
    if (!puppeteer?.launch) throw new Error('puppeteer not available');

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await page.setViewport(this.mergedOptions().viewport);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: this.mergedOptions().timeoutMs });
      return await this.extractFromLivePage(page, url);
    } finally {
      await browser.close();
    }
  }

  private async extractFromLivePage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any,
    url: string,
  ): Promise<ExtractionResult> {
    const options = this.mergedOptions();
    return await extractFromAutomationPage({
      page,
      url,
      maxElementHtmlLength: options.maxElementHtmlLength,
      maxTextLength: options.maxTextLength,
      maxRawHtmlLength: options.maxRawHtmlLength,
    });
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
    const ariaRequired = (field.getAttribute('aria-required') ?? '').toLowerCase() === 'true';
    const required = ariaRequired || field.hasAttribute('required');

    const labelText =
      id && id.trim()
        ? normalizeText(document.querySelector(`label[for="${cssEscape(id)}"]`)?.textContent ?? '')
        : '';

    const hasLabelText = labelText.trim().length > 0;

    return {
      ...snap,
      id,
      name: field.getAttribute('name'),
      type: field.getAttribute('type'),
      placeholder: field.getAttribute('placeholder'),
      title: field.getAttribute('title'),
      required,
      autocomplete: field.getAttribute('autocomplete'),
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
