<p align="center">
  <a href="https://npmjs.com/package/@a11y-ai/core"><img src="https://img.shields.io/npm/v/@a11y-ai/core?style=flat-square&color=10b981" alt="npm version" /></a>
  <a href="https://npmjs.com/package/@a11y-ai/core"><img src="https://img.shields.io/npm/dm/@a11y-ai/core?style=flat-square&color=10b981" alt="npm downloads" /></a>
  <a href="https://github.com/vudayagirivaibhav/a11y-ai/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/vudayagirivaibhav/a11y-ai/ci.yml?style=flat-square&label=CI" alt="CI" /></a>
  <a href="https://github.com/vudayagirivaibhav/a11y-ai"><img src="https://img.shields.io/github/stars/vudayagirivaibhav/a11y-ai?style=flat-square&color=10b981" alt="GitHub stars" /></a>
  <a href="https://github.com/vudayagirivaibhav/a11y-ai/blob/main/LICENSE"><img src="https://img.shields.io/github/license/vudayagirivaibhav/a11y-ai?style=flat-square&color=10b981" alt="License" /></a>
  <img src="https://img.shields.io/badge/WCAG-2.1_AA-10b981?style=flat-square" alt="WCAG 2.1 AA" />
</p>

<h1 align="center">a11y-ai</h1>

<p align="center">
  <strong>Accessibility auditing that understands your page.</strong><br/>
  Combines axe-core's deterministic rules with LLM-powered semantic analysis<br/>
  to catch the issues static tools miss.
</p>

<p align="center">
  <a href="#install">Install</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#comparison">Comparison</a> •
  <a href="#rules">Rules</a> •
  <a href="#api">API</a> •
  <a href="https://a11y-ai.vercel.app">Playground</a>
</p>

---

## The difference

**axe-core** checks if your `<img>` has an `alt` attribute. **a11y-ai** checks if the alt text is _actually helpful_.

```html
<img src="team-photo.jpg" alt="DSC_00472.jpg" />
```

```
axe-core  →  ✅ Pass (image has alt text)
a11y-ai   →  🔴 Serious: Alt text is a camera filename.
              Suggested fix: "Five team members standing in front of
              the company logo at the annual retreat"
              Confidence: 0.94 (requires a vision-capable provider + preset)
```

That's the difference between checking **if** something exists and checking **if it's actually good**.

---

## Install

```bash
# CLI (globally)
npm install -g @a11y-ai/cli

# Or run directly with npx
npx @a11y-ai/cli audit https://example.com --preset quick

# Programmatic API
npm install @a11y-ai/core
```

For URL auditing, you'll also need a browser automation library:

```bash
npm install playwright
# or
npm install puppeteer
```

---

## Quick Start

### CLI

```bash
# Free audit (no API key needed)
npx @a11y-ai/cli audit https://example.com --preset quick

# AI-powered audit
npx @a11y-ai/cli audit https://example.com \
  --preset standard \
  --provider openai \
  --format html \
  --output report.html

# Audit local HTML
npx @a11y-ai/cli audit ./page.html --preset quick
```

### Programmatic

```ts
import { audit } from '@a11y-ai/core';

const result = await audit('https://example.com', {
  preset: 'standard',
  provider: { name: 'openai', apiKey: process.env.OPENAI_API_KEY },
});

console.log(result.summary.score); // 0..100
console.log(result.summary.grade); // A, B, C, D, F
console.log(result.mergedViolations.length);
```

### GitHub Actions

```yaml
- name: Accessibility audit
  uses: vudayagirivaibhav/a11y-ai@v0.1.0
  with:
    url: https://your-site.com
    preset: standard
    api-key: ${{ secrets.OPENAI_API_KEY }}
    threshold: '70'
```

See [docs/github-action.md](./docs/github-action.md) for more examples.

---

## Comparison

|                            | a11y-ai         | axe-core | Lighthouse | pa11y |
| -------------------------- | --------------- | -------- | ---------- | ----- |
| **Works without API key**  | ✅ quick preset | ✅       | ✅         | ✅    |
| **AI semantic analysis**   | ✅              | ❌       | ❌         | ❌    |
| **Vision analysis**        | ✅ thorough     | ❌       | ❌         | ❌    |
| **Batch/sitemap audit**    | ✅              | ❌       | ❌         | ✅    |
| **CI/CD integration**      | ✅              | ✅       | ✅         | ✅    |
| **Custom rules**           | ✅              | ✅       | ❌         | ❌    |
| **SARIF output**           | ✅              | ❌       | ❌         | ❌    |
| **Actionable suggestions** | ✅ AI-generated | ❌       | ❌         | ❌    |

---

## Why

[WebAIM's "Million" study](https://webaim.org/projects/million/) consistently shows that most home pages
fail basic accessibility checks. Static tools are essential, but a lot of high-impact issues require judgment:

- Is this link text meaningful out of context?
- Does this label actually describe what the input expects?
- Does this alt text describe the image _in this page's context_?
- Is contrast acceptable over a photo/gradient?

a11y-ai runs **axe-core first**, then layers **AI rules** on top for the semantic stuff.

---

## How it works

```mermaid
graph LR
  U["User (CLI / API / CI)"] --> A["A11yAuditor (@a11y-ai/core)"]

  A --> X["DOMExtractor (jsdom / browser page)"]
  A --> AXE["AxeRunner (axe-core)"]
  A --> RULES["Rules Engine (@a11y-ai/rules)"]

  RULES --> REG["RuleRegistry + BaseRule"]
  REG --> PROMPT["PromptBuilder + token utilities"]
  RULES --> P["AIProvider (@a11y-ai/ai-providers)"]

  A --> MERGE["Merge + dedupe violations"]
  MERGE --> SCORE["AccessibilityScorer (0-100)"]
  SCORE --> REPORT["ReportGenerator (JSON / HTML / MD / SARIF / Console)"]
```

---

## Presets

| Preset     |     AI calls |       Vision | Use case                                        |
| ---------- | -----------: | -----------: | ----------------------------------------------- |
| `quick`    |           No |           No | Fast CI gate, free, no API key needed           |
| `standard` |          Yes |           No | Default: all built-ins with AI where applicable |
| `thorough` |          Yes |          Yes | Full audit, enables vision where supported      |
| `custom`   | Configurable | Configurable | Fine-grained control                            |

---

## Rules

9 built-in rules:

| Rule id                   | Category    | What it catches                                                          |
| ------------------------- | ----------- | ------------------------------------------------------------------------ |
| `ai/alt-text-quality`     | alt-text    | camera filenames, placeholder alt text, optional vision mismatch checks  |
| `ai/link-text-quality`    | link-text   | "click here", bare URLs, duplicate ambiguous links                       |
| `ai/contrast-analysis`    | contrast    | low contrast based on computed styles; AI assist for complex backgrounds |
| `ai/form-label-relevance` | form-labels | missing/unclear labels and associations                                  |
| `ai/heading-structure`    | structure   | missing h1, skipped levels, outline issues                               |
| `ai/aria-validation`      | aria        | invalid/redundant/conflicting ARIA usage                                 |
| `ai/keyboard-navigation`  | structure   | tabindex traps, click handlers without keyboard access                   |
| `ai/language-readability` | structure   | missing/invalid `lang`, readability heuristics + AI notes                |
| `ai/media-accessibility`  | structure   | missing captions/subtitles/transcripts heuristics                        |

Each rule emits results with:

- **Severity**: `critical` / `serious` / `moderate` / `minor`
- **Confidence**: `0..1` (static checks tend toward `1.0`; AI is lower)
- **Source**: `static` or `ai`
- **Suggestion**: actionable remediation guidance

---

## API

### One-liner

```ts
import { audit } from '@a11y-ai/core';

const result = await audit('https://example.com', {
  preset: 'standard',
  provider: { name: 'openai' },
});
```

### Builder pattern + progress events

```ts
import { a11yAI } from '@a11y-ai/core';

const result = await a11yAI()
  .url('https://example.com')
  .provider('openai', { apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' })
  .preset('thorough')
  .on('rule:complete', (ruleId, results) => console.log('✓', ruleId, results.length))
  .run();
```

### Axe-only (no AI)

```ts
import { auditAxeOnly } from '@a11y-ai/core';

const violations = await auditAxeOnly('<html>...</html>', { standard: 'wcag2aa' });
```

### Batch API

```ts
import { BatchAuditor, toAuditConfig } from '@a11y-ai/core';

const batch = new BatchAuditor(toAuditConfig({ preset: 'quick' }));
const results = await batch.audit([
  'https://example.com',
  'https://example.com/about',
  'https://example.com/contact',
]);

console.log(results.summary.averageScore);
```

---

## AI providers

| Provider  | API key needed |  Vision support |   Local | Notes                                       |
| --------- | -------------: | --------------: | ------: | ------------------------------------------- |
| OpenAI    |            Yes |              ✅ |      No | good vision + structured JSON output        |
| Anthropic |            Yes |              ✅ |      No | strong reasoning                            |
| Ollama    |             No | model-dependent |      ✅ | private/local (no data leaves your machine) |
| Custom    |        depends |         depends | depends | bring your own handler                      |

---

## CLI usage

### Audit a URL

```bash
npx @a11y-ai/cli audit https://your-site.com \
  --preset standard \
  --provider openai \
  --model gpt-4o-mini \
  --wcag AA \
  --format html \
  --output a11y-ai-report.html
```

### Batch auditing

```bash
# From a file (one URL per line)
npx @a11y-ai/cli audit --urls ./urls.txt

# From a sitemap
npx @a11y-ai/cli audit --sitemap https://example.com/sitemap.xml --max-pages 20

# Crawl from a starting page
npx @a11y-ai/cli audit https://example.com --crawl --max-pages 20
```

### Config file

The CLI loads the first match from cwd:

- `.a11yairc.json`
- `a11y-ai.config.js`

Example `.a11yairc.json`:

```json
{
  "preset": "standard",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "wcag": "AA",
  "format": "html",
  "output": "a11y-ai-report.html",
  "threshold": 70
}
```

Environment variables:

- `A11Y_AI_PROVIDER`
- `A11Y_AI_API_KEY`
- `A11Y_AI_MODEL`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`

---

## Reports

| Format   | CLI flag           | Notes                                          |
| -------- | ------------------ | ---------------------------------------------- |
| Console  | `--format console` | ANSI-colored output                            |
| JSON     | `--format json`    | versioned schema (`schemaVersion: "1.0"`)      |
| HTML     | `--format html`    | single file, inline styles, dark-mode friendly |
| Markdown | `--format md`      | GitHub-friendly output                         |
| SARIF    | `--format sarif`   | GitHub Code Scanning compatible                |

---

## Packages

| Package                                            | Description                                     |
| -------------------------------------------------- | ----------------------------------------------- |
| [@a11y-ai/core](./packages/core)                   | Auditor, extraction, axe-core, scoring, reports |
| [@a11y-ai/rules](./packages/rules)                 | Rules engine + 9 built-in rules                 |
| [@a11y-ai/ai-providers](./packages/ai-providers)   | OpenAI / Anthropic / Ollama / Mock / Custom     |
| [@a11y-ai/cli](./packages/cli)                     | CLI wrapper                                     |
| [@a11y-ai/github-action](./packages/github-action) | GitHub Action                                   |

---

## Privacy

When AI providers are enabled, **HTML snippets and element metadata** may be sent to the provider's API.
To keep data local:

- use `--preset quick` (no AI calls)
- use `--provider ollama` (local model)
- use `--provider custom` and route via your own proxy

---

## Development

```bash
git clone https://github.com/vudayagirivaibhav/a11y-ai
cd a11y-ai
corepack enable
pnpm install
pnpm build
pnpm test
```

Playground:

```bash
pnpm -C apps/playground dev
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for architecture and contribution guidelines.

---

## License

MIT
