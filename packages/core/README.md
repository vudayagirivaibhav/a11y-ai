# @a11y-ai/core

Core engine for a11y-ai — AI-powered accessibility auditing built on axe-core.

## Install

```bash
npm install @a11y-ai/core
# or
pnpm add @a11y-ai/core
```

## Quick Start

```typescript
import { audit } from '@a11y-ai/core';

const result = await audit('https://example.com', {
  preset: 'quick', // 'quick' | 'standard' | 'thorough'
  provider: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

console.log(result.summary.score); // 0–100
console.log(result.summary.grade); // A, B, C, D, F
```

## API

### One-liner Functions

```typescript
// Audit a URL or HTML string
audit(target: string, options?: AuditOptions): Promise<AuditResult>

// Audit raw HTML
auditHTML(html: string, options?: AuditOptions): Promise<AuditResult>

// Audit a live URL
auditURL(url: string, options?: AuditOptions): Promise<AuditResult>

// Axe-core only (no AI, free)
auditAxeOnly(target: string): Promise<AuditResult>
```

### Builder API

```typescript
import { a11yAI } from '@a11y-ai/core';

const result = await a11yAI()
  .url('https://example.com')
  .provider('openai', { apiKey: process.env.OPENAI_API_KEY })
  .preset('standard')
  .run();
```

### Class-based API

```typescript
import { A11yAuditor, toAuditConfig } from '@a11y-ai/core';

const config = toAuditConfig({
  preset: 'standard',
  provider: { provider: 'openai', apiKey: '...' },
});

const auditor = new A11yAuditor(config);

// Listen to progress events
auditor.on('start', (target) => console.log('Starting:', target));
auditor.on('axe:complete', (violations) => console.log('Axe found:', violations.length));
auditor.on('rule:start', (ruleId) => console.log('Running:', ruleId));
auditor.on('rule:complete', (ruleId, results) => console.log('Done:', ruleId));

const result = await auditor.auditURL('https://example.com');
```

## Presets

| Preset     | AI Rules    | Vision | Cost        |
| ---------- | ----------- | ------ | ----------- |
| `quick`    | None        | No     | Free        |
| `standard` | All 9 rules | No     | ~$0.01/page |
| `thorough` | All 9 rules | Yes    | ~$0.05/page |

## Report Formats

```typescript
import { ReportGenerator } from '@a11y-ai/core';

const reporter = new ReportGenerator();

reporter.generateJSON(result); // JSON string
reporter.generateHTML(result); // Standalone HTML
reporter.generateMarkdown(result); // Markdown
reporter.generateSARIF(result); // SARIF for GitHub
reporter.generateConsole(result); // Terminal output
```

## Batch Auditing

```typescript
import { BatchAuditor, toAuditConfig } from '@a11y-ai/core';

const batch = new BatchAuditor(toAuditConfig({ preset: 'quick' }));

// Audit multiple URLs
const result = await batch.audit([
  'https://example.com',
  'https://example.com/about',
  'https://example.com/contact',
]);

// Or crawl a sitemap
const result = await batch.auditSitemap('https://example.com/sitemap.xml', {
  maxPages: 50,
  include: ['/blog/*'],
  exclude: ['/admin/*'],
});

console.log(result.summary.averageScore);
console.log(result.summary.siteWideIssues);
```

## License

MIT
