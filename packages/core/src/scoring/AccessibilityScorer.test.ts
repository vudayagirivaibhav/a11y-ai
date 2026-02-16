import { describe, expect, it } from 'vitest';

import type { ExtractionResult } from '../types/extraction.js';
import type { Violation } from '../types/violation.js';

import { AccessibilityScorer } from './AccessibilityScorer.js';

const extraction: ExtractionResult = {
  url: 'https://example.com',
  images: [],
  links: [],
  forms: [],
  headings: [],
  ariaElements: [],
  pageTitle: 'Example',
  pageLanguage: 'en',
  metaDescription: null,
  documentOutline: [],
  rawHTML: '<html></html>',
};

describe('AccessibilityScorer', () => {
  it('returns 100 (A) when there are no violations', () => {
    const scorer = new AccessibilityScorer();
    const summary = scorer.score({
      mergedViolations: [],
      extraction,
      aiCalls: 0,
      startedAt: Date.now(),
    });

    expect(summary.score).toBe(100);
    expect(summary.grade).toBe('A');
    expect(summary.totalViolations).toBe(0);
  });

  it('deducts more for higher severity and higher confidence', () => {
    const scorer = new AccessibilityScorer();

    const violations: Violation[] = [
      {
        selector: '#a',
        severity: 'critical',
        source: 'axe',
        message: 'Critical issue',
        confidence: 1,
      },
      {
        selector: '#b',
        severity: 'minor',
        source: 'ai',
        message: 'Minor issue',
        confidence: 0.2,
      },
    ];

    const summary = scorer.score({
      mergedViolations: violations,
      extraction,
      aiCalls: 2,
      startedAt: Date.now(),
    });

    expect(summary.score).toBeLessThan(100);
    expect(summary.bySeverity.critical).toBe(1);
    expect(summary.bySeverity.minor).toBe(1);
  });

  it('applies diminishing returns after many violations in same category', () => {
    const scorer = new AccessibilityScorer();

    const violations: Violation[] = Array.from({ length: 12 }, (_, i) => ({
      category: 'alt-text',
      selector: `#img${i}`,
      severity: 'moderate' as const,
      source: 'ai' as const,
      message: 'Alt text issue',
      confidence: 1,
    }));

    const summary = scorer.score({
      mergedViolations: violations,
      extraction,
      aiCalls: 0,
      startedAt: Date.now(),
    });

    // Should not tank all the way to 0 for repeated moderate issues.
    expect(summary.score).toBeGreaterThan(0);
    expect(summary.categories['alt-text']?.violationCount).toBe(12);
  });
});

