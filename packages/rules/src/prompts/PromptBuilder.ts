import type { ElementSnapshot } from 'a11y-ai';

import { PROMPT_FRAGMENTS } from './fragments.js';
import { estimateTokens, trimToTokens } from './token.js';

/**
 * Fluent builder for constructing consistent AI prompts.
 *
 * The output is a single string intended to be passed as a "user prompt" to a model.
 */
export class PromptBuilder {
  private systemText = '';
  private instructionText = '';
  private outputSchema: unknown = null;
  private elements: ElementSnapshot[] = [];
  private extraContext: Record<string, unknown> | null = null;
  private maxTokens: number | null = null;

  /**
   * Set an optional system instruction (folded into the prompt body).
   */
  system(text: string): this {
    this.systemText = text.trim();
    return this;
  }

  /**
   * Provide element snapshots to be evaluated.
   */
  context(elements: ElementSnapshot[]): this {
    this.elements = elements;
    return this;
  }

  /**
   * Provide the rule-specific instruction.
   */
  instruction(text: string): this {
    this.instructionText = text.trim();
    return this;
  }

  /**
   * Provide a JSON schema-like object describing the output format.
   */
  outputFormat(schema: unknown): this {
    this.outputSchema = schema;
    return this;
  }

  /**
   * Provide additional JSON-serializable context.
   */
  extra(extra: Record<string, unknown>): this {
    this.extraContext = extra;
    return this;
  }

  /**
   * Set an approximate maximum token budget for the entire prompt.
   */
  limitTokens(maxTokens: number): this {
    this.maxTokens = maxTokens;
    return this;
  }

  /**
   * Build the final prompt string.
   */
  build(): string {
    const payload = {
      standards: PROMPT_FRAGMENTS.standardsContext,
      severity: PROMPT_FRAGMENTS.severityDefinitions,
      system: this.systemText || undefined,
      instruction: this.instructionText,
      output: this.outputSchema,
      extra: this.extraContext ?? undefined,
      elements: this.elements.map((e) => ({
        selector: e.selector,
        tagName: e.tagName,
        textContent: e.textContent,
        attributes: e.attributes,
        computedStyle: e.computedStyle,
        boundingBox: e.boundingBox,
        html: e.html,
      })),
    };

    let text = JSON.stringify(payload, null, 2);

    if (this.maxTokens !== null) {
      text = trimToTokens(text, this.maxTokens);
    }

    // Attach a tiny hint for easier debugging in logs.
    const tokens = estimateTokens(text);
    return `${text}\n\n# tokenEstimate: ${tokens}`;
  }
}

