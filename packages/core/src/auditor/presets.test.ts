import { describe, expect, it } from 'vitest';

import { A11yAuditor } from './A11yAuditor.js';
import { toAuditConfig } from '../api.js';

describe('Presets', () => {
  it('quick preset runs only static subset of rules', async () => {
    const html = `<!doctype html>
      <html lang="en">
        <head><title>t</title></head>
        <body>
          <img src="/a.png">
          <a href="/x">click here</a>
          <form><input id="q"></form>
        </body>
      </html>`;

    const auditor = new A11yAuditor(
      toAuditConfig({
        preset: 'quick',
        provider: { name: 'custom', handler: async () => ({ content: '{"results":[]}' }) },
      }),
    );

    const result = await auditor.auditHTML(html);
    const ruleIds = new Set(result.ruleResults.map((r) => r.ruleId));

    expect(ruleIds.has('ai/alt-text-quality')).toBe(true);
    expect(ruleIds.has('ai/link-text-quality')).toBe(true);
    expect(ruleIds.has('ai/form-label-relevance')).toBe(true);

    // Disabled in quick preset
    expect(ruleIds.has('ai/contrast-analysis')).toBe(false);
    expect(ruleIds.has('ai/aria-validation')).toBe(false);
    expect(ruleIds.has('ai/heading-structure')).toBe(false);
    expect(ruleIds.has('ai/keyboard-navigation')).toBe(false);
    expect(ruleIds.has('ai/language-readability')).toBe(false);
    expect(ruleIds.has('ai/media-accessibility')).toBe(false);
  });
});
