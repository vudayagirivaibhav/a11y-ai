import type { RuleContext } from './provider.js';

/**
 * Subset of computed styles that are directly relevant to accessibility checks.
 */
export interface ComputedStyleSubset {
  /** CSS `color` value (e.g., `rgb(0, 0, 0)`). */
  color: string;

  /** CSS `background-color` value. */
  backgroundColor: string;

  /** CSS `font-size` value (e.g., `16px`). */
  fontSize: string;

  /** CSS `display` value (e.g., `block`, `none`). */
  display: string;

  /** CSS `visibility` value (e.g., `visible`, `hidden`). */
  visibility: string;

  /** CSS `opacity` value (e.g., `1`). */
  opacity: string;
}

/**
 * Bounding box information for an element.
 *
 * For non-rendered HTML parsing (jsdom), these values may be `null` because no
 * layout engine is available.
 */
export interface BoundingBox {
  /** X offset in CSS pixels, relative to the page viewport. */
  x: number;

  /** Y offset in CSS pixels, relative to the page viewport. */
  y: number;

  /** Width in CSS pixels. */
  width: number;

  /** Height in CSS pixels. */
  height: number;
}

/**
 * Generic element snapshot.
 *
 * This is intentionally "broad" so future extraction modules can add new
 * element types while still reusing the same base shape.
 */
export interface ElementSnapshot {
  /** Unique-ish CSS selector for the element (best-effort). */
  selector: string;

  /** Element outerHTML (may be truncated by the extractor). */
  html: string;

  /** Lowercased tag name (e.g., `img`, `a`). */
  tagName: string;

  /** Element attributes at extraction time. */
  attributes: Record<string, string>;

  /** Text content (normalized whitespace, best-effort). */
  textContent: string;

  /** Accessibility-relevant computed style subset (best-effort). */
  computedStyle?: ComputedStyleSubset;

  /** Bounding box (best-effort; may be missing for jsdom parsing). */
  boundingBox?: BoundingBox;
}

/**
 * Snapshot for `<img>` elements (and other image-like sources).
 */
export interface ImageElement extends ElementSnapshot {
  /** The image source URL (from `src`). */
  src: string;

  /** The `alt` attribute value if present. */
  alt: string | null;

  /** Whether the element has an `alt` attribute (even if empty). */
  hasAlt: boolean;
}

/**
 * Snapshot for `<a>` elements.
 */
export interface LinkElement extends ElementSnapshot {
  /** HREF for the link (best-effort). */
  href: string | null;
}

/**
 * Snapshot for a single form field.
 */
export interface FormFieldElement extends ElementSnapshot {
  /** Field `name` attribute (if present). */
  name: string | null;

  /** Field `type` attribute (for inputs). */
  type: string | null;

  /** Referenced label text (best-effort). */
  labelText: string | null;

  /** `aria-label` value (if present). */
  ariaLabel: string | null;

  /** `aria-labelledby` value (if present). */
  ariaLabelledBy: string | null;
}

/**
 * Snapshot for `<form>` elements, including extracted fields.
 */
export interface FormElement extends ElementSnapshot {
  /** Extracted input/select/textarea field snapshots within the form. */
  fields: FormFieldElement[];
}

/**
 * Heading node used to represent the document outline.
 */
export interface HeadingNode {
  /** Heading level (1..6). */
  level: number;

  /** Text content of the heading. */
  text: string;

  /** Selector pointing to the heading element. */
  selector: string;

  /** Child nodes nested under this heading. */
  children: HeadingNode[];
}

/**
 * Aggregate extraction output used to feed both AI rules and axe-core runs.
 */
export interface ExtractionResult {
  /**
   * Source URL used for extraction (when available).
   *
   * For raw HTML extraction, this may be `null`.
   */
  url: string | null;

  /** Extracted image elements. */
  images: ImageElement[];

  /** Extracted link elements. */
  links: LinkElement[];

  /** Extracted form elements. */
  forms: FormElement[];

  /** Extracted heading elements. */
  headings: ElementSnapshot[];

  /** Elements that contain ARIA attributes or explicit roles. */
  ariaElements: ElementSnapshot[];

  /** Document title (`<title>`). */
  pageTitle: string;

  /** Page language (from `<html lang="">`). */
  pageLanguage: string | null;

  /** Meta description (from `<meta name="description">`). */
  metaDescription: string | null;

  /** Heading hierarchy tree for the document. */
  documentOutline: HeadingNode[];

  /**
   * Sanitized HTML intended for AI context windows.
   *
   * This string should be treated as "best-effort" and may be truncated.
   */
  rawHTML: string;
}

/**
 * Options for building a `RuleContext` from an `ExtractionResult`.
 */
export interface RuleContextBuildOptions {
  /** Rule identifier currently being analyzed. */
  ruleId: RuleContext['ruleId'];

  /**
   * Optional element snapshot to focus the context around.
   * When provided, it is included prominently in the resulting HTML context.
   */
  element?: ElementSnapshot;

  /**
   * Approximate token budget for the HTML context.
   *
   * Tokenization is provider-specific; we use a conservative approximation.
   */
  maxTokens?: number;

  /**
   * List of active rules for this audit. Used to prioritize which extracted
   * sections are included in the context.
   */
  activeRules?: RuleContext['ruleId'][];
}
