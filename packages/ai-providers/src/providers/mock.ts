import type { AiProviderConfig } from '@a11y-ai/core/types';

import { BaseAIProvider } from '../base.js';

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(arr: readonly T[], n: number): T {
  return arr[n % arr.length]!;
}

/**
 * Deterministic mock provider.
 *
 * This is intended for unit/integration tests to avoid real network calls.
 * The response is based on hashing the prompt so the same input yields the
 * same output.
 */
export class MockAIProvider extends BaseAIProvider {
  constructor(config: AiProviderConfig) {
    super(config);
  }

  /**
   * Produce deterministic JSON output based on prompt hashing.
   */
  protected async rawComplete(prompt: string): Promise<string> {
    const hash = fnv1a32(prompt);

    const count = hash % 3; // 0..2 findings
    const severities = ['minor', 'moderate', 'serious'] as const;
    const rules = ['alt-text-quality', 'link-text-quality', 'contrast-analysis', 'form-label-relevance'] as const;

    const findings = Array.from({ length: count }, (_, i) => ({
      ruleId: pick(rules, hash + i),
      severity: pick(severities, hash + i * 7),
      element: {
        selector: `#mock-${(hash + i) % 100}`,
        html: `<div id="mock-${(hash + i) % 100}"></div>`,
        tagName: 'div',
        attributes: { id: `mock-${(hash + i) % 100}` },
      },
      message: `Mock finding ${(hash + i) % 1000}`,
      suggestion: 'This is a deterministic mock suggestion.',
      confidence: ((hash % 100) / 100) * 0.9 + 0.05,
      context: { mockHash: hash },
    }));

    return JSON.stringify({ findings });
  }

  /**
   * Mock vision support.
   *
   * We don't attempt image understanding here; we just include a small marker in
   * the prompt so tests can verify the vision code path is used.
   */
  override async analyzeImage(
    imageData: Buffer | string,
    prompt: string,
    context: Parameters<BaseAIProvider['analyze']>[1],
  ): Promise<import('@a11y-ai/core/types').AIAnalysisResult> {
    const marker =
      typeof imageData === 'string' ? `image:string:${imageData.length}` : `image:buffer:${imageData.byteLength}`;
    return await this.analyze(`${prompt}\n\n[vision:${marker}]`, context);
  }
}
