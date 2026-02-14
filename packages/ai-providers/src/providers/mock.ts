import type { AiProviderConfig } from 'a11y-ai/types';

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

export class MockAIProvider extends BaseAIProvider {
  constructor(config: AiProviderConfig) {
    super(config);
  }

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
}
