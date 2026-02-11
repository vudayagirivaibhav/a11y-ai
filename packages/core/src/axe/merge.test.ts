import { describe, expect, it } from 'vitest';

import type { AiIssue, AxeViolation } from '../types/index.js';

import { mergeViolations } from './merge.js';

describe('mergeViolations', () => {
  it('merges matching axe + AI findings when selector and rule match', () => {
    const axe: AxeViolation[] = [
      {
        id: 'image-alt',
        severity: 'serious',
        help: 'Images must have alternate text',
        helpUrl: 'https://example.com',
        description: 'desc',
        selector: '#img1',
        html: '<img id="img1" src="/missing-alt.png">',
        tags: ['wcag2a'],
      },
    ];

    const ai: AiIssue[] = [
      {
        rule: 'alt-text-quality',
        severity: 'serious',
        element: {
          selector: '#img1',
          html: '<img id="img1" src="/missing-alt.png">',
          tagName: 'img',
          attributes: { id: 'img1', src: '/missing-alt.png' },
        },
        message: 'Alt text is missing.',
        suggestion: 'Add meaningful alt text.',
        confidence: 0.9,
      },
    ];

    const merged = mergeViolations(axe, ai);
    expect(merged.length).toBe(1);
    expect(merged[0]?.source).toBe('both');
    expect(merged[0]?.selector).toBe('#img1');
  });
});

