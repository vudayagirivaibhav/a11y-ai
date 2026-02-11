import type { ExtractionResult, RuleContextBuildOptions } from '../types/extraction.js';
import type { RuleContext } from '../types/provider.js';

import { truncateContent } from './utils.js';

const DEFAULT_MAX_TOKENS = 8_000;

/**
 * Build a `RuleContext` for a specific rule invocation from an `ExtractionResult`.
 *
 * The context includes:
 * - URL + rule id
 * - an optional focused element snapshot
 * - a trimmed HTML context string sized to an approximate token budget
 * - high-level page metadata
 *
 * Note: "tokens" are provider-specific. We approximate tokens using characters.
 */
export function buildRuleContext(
  extraction: ExtractionResult,
  options: RuleContextBuildOptions,
): RuleContext {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const htmlContext = buildHtmlContext(extraction, options);
  const trimmedHtml = trimToTokenBudget(htmlContext, maxTokens);

  const context: RuleContext = {
    url: extraction.url ?? 'about:blank',
    ruleId: options.ruleId,
    html: trimmedHtml,
    metadata: {
      pageTitle: extraction.pageTitle,
      pageLanguage: extraction.pageLanguage,
      metaDescription: extraction.metaDescription,
      counts: {
        images: extraction.images.length,
        links: extraction.links.length,
        forms: extraction.forms.length,
        headings: extraction.headings.length,
        ariaElements: extraction.ariaElements.length,
      },
      outline: extraction.documentOutline,
    },
  };

  if (options.element) {
    context.element = {
      selector: options.element.selector,
      html: options.element.html,
      tagName: options.element.tagName,
      attributes: options.element.attributes,
    };
  }

  return context;
}

function buildHtmlContext(extraction: ExtractionResult, options: RuleContextBuildOptions): string {
  const lines: string[] = [];

  lines.push(`# Page context`);
  lines.push(`title: ${extraction.pageTitle || '(none)'}`);
  lines.push(`lang: ${extraction.pageLanguage ?? '(unknown)'}`);
  lines.push(`description: ${extraction.metaDescription ?? '(none)'}`);
  lines.push('');

  if (options.element) {
    lines.push(`# Focus element`);
    lines.push(`selector: ${options.element.selector}`);
    lines.push(`tag: ${options.element.tagName}`);
    lines.push(`text: ${truncateContent(options.element.textContent ?? '', 200)}`);
    lines.push(`html: ${truncateContent(options.element.html ?? '', 2_000)}`);
    lines.push('');
  }

  const activeRules = options.activeRules ?? [options.ruleId];

  if (activeRules.includes('alt-text-quality')) {
    lines.push(`# Images`);
    for (const img of extraction.images.slice(0, 50)) {
      lines.push(
        `- ${img.selector} alt=${img.alt === null ? '(missing)' : JSON.stringify(img.alt)} src=${truncateContent(
          img.src,
          200,
        )}`,
      );
    }
    lines.push('');
  }

  if (activeRules.includes('link-text-quality')) {
    lines.push(`# Links`);
    for (const link of extraction.links.slice(0, 50)) {
      lines.push(`- ${link.selector} href=${link.href ?? '(none)'} text=${truncateContent(link.textContent, 120)}`);
    }
    lines.push('');
  }

  if (activeRules.includes('form-label-relevance')) {
    lines.push(`# Forms`);
    for (const form of extraction.forms.slice(0, 10)) {
      lines.push(`- form: ${form.selector}`);
      for (const field of form.fields.slice(0, 50)) {
        lines.push(
          `  - field: ${field.selector} name=${field.name ?? '(none)'} type=${field.type ?? '(none)'} label=${
            field.labelText ?? '(none)'
          } aria-label=${field.ariaLabel ?? '(none)'} aria-labelledby=${field.ariaLabelledBy ?? '(none)'}`,
        );
      }
    }
    lines.push('');
  }

  if (activeRules.includes('contrast-analysis')) {
    lines.push(`# Headings (style hints)`);
    for (const h of extraction.headings.slice(0, 50)) {
      const style = h.computedStyle;
      lines.push(
        `- ${h.selector} text=${truncateContent(h.textContent, 120)} color=${style?.color ?? ''} background=${
          style?.backgroundColor ?? ''
        } fontSize=${style?.fontSize ?? ''}`,
      );
    }
    lines.push('');
  }

  lines.push(`# Sanitized HTML (truncated)`);
  lines.push(extraction.rawHTML);

  return lines.join('\n');
}

/**
 * Conservative approximation: ~4 characters per token.
 */
function trimToTokenBudget(text: string, maxTokens: number): string {
  const charBudget = Math.max(0, Math.floor(maxTokens * 4));
  return truncateContent(text, charBudget);
}
