import { describe, expect, it } from 'vitest';

import type { AuditResult } from '../types/audit.js';

import { ReportGenerator } from './ReportGenerator.js';

function sampleResult(): AuditResult {
  return {
    url: 'https://example.com',
    timestamp: new Date().toISOString(),
    extraction: {
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
    },
    axeViolations: [],
    ruleResults: [],
    mergedViolations: [
      {
        category: 'alt-text',
        selector: '#img1',
        severity: 'serious',
        source: 'ai',
        message: 'Alt text is missing.',
        suggestion: 'Add alt text.',
        confidence: 0.9,
      },
    ],
    summary: {
      score: 95,
      grade: 'A',
      categories: {
        'alt-text': { score: 90, grade: 'A', violationCount: 1, topIssue: 'Alt text is missing.' },
      },
      totalViolations: 1,
      bySeverity: { critical: 0, serious: 1, moderate: 0, minor: 0 },
      elementsAnalyzed: 10,
      aiCalls: 1,
      estimatedTokens: 100,
      auditDurationMs: 1000,
      wcagCompliance: { level: 'none', passedCriteria: [], failedCriteria: [] },
    },
    metadata: {
      schemaVersion: '1.0',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      axeVersion: '4.x',
      a11yAiVersion: '0.0.0',
      aiProvider: 'mock',
      model: 'mock',
      durationMs: 1000,
      rulesExecuted: [],
      rulesFailed: [],
    },
    errors: [],
  };
}

describe('ReportGenerator', () => {
  it('generates JSON', () => {
    const gen = new ReportGenerator();
    const json = gen.generateJSON(sampleResult());
    expect(json).toContain('"schemaVersion"');
    expect(json).toContain('"mergedViolations"');
  });

  it('generates Markdown', () => {
    const gen = new ReportGenerator();
    const md = gen.generateMarkdown(sampleResult());
    expect(md).toContain('# a11y-ai report');
    expect(md).toContain('### alt-text');
  });

  it('generates HTML', () => {
    const gen = new ReportGenerator();
    const html = gen.generateHTML(sampleResult());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<table');
  });

  it('generates SARIF', () => {
    const gen = new ReportGenerator();
    const sarif = gen.generateSARIF(sampleResult());
    expect(sarif).toContain('"version": "2.1.0"');
    expect(sarif).toContain('"runs"');
  });

  it('generates console output', () => {
    const gen = new ReportGenerator();
    const out = gen.generateConsole(sampleResult(), { noColor: true });
    expect(out).toContain('Score: 95');
    expect(out).toContain('Alt text is missing');
  });
});

