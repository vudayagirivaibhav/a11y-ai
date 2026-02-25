# Changelog

All notable changes to this repository will be documented here.

This project is currently pre-release (`0.0.0`) and is under active development.

## Unreleased

### Added

- Monorepo workspace with `@a11y-ai/core`, `@a11y-ai/ai-providers`, `@a11y-ai/rules`, and `@a11y-ai/cli`.
- DOM extraction engine (HTML via `jsdom`, URL/page extraction via Playwright/Puppeteer when available).
- `axe-core` runner + normalization + merge utilities.
- AI provider abstraction with adapters for OpenAI, Anthropic, Ollama, and a deterministic Mock provider.
- Rules engine framework (registry, base rule utilities, prompt builder, batching, and aggregation helpers).
- Built-in rules:
  - `ai/alt-text-quality` (static + AI + optional vision)
  - `ai/link-text-quality`
  - `ai/contrast-analysis`
  - `ai/form-label-relevance`
  - `ai/heading-structure`
  - `ai/aria-validation`
  - `ai/keyboard-navigation`
  - `ai/language-readability` (includes static readability scoring)
  - `ai/media-accessibility`
- Audit orchestrator (`A11yAuditor`) with:
  - concurrent rule execution
  - per-rule and overall timeouts
  - AI response caching (in-memory by default)
  - progress events (`start`, `axe:complete`, `rule:start`, `rule:complete`, `complete`)
- Scoring engine producing 0–100 score + grade + category breakdown.
- Report generator for JSON/HTML/Markdown/SARIF/console output.
- CLI with config discovery, WCAG level selection for axe, report formats, thresholds, and compare/init commands.
- Programmatic API (`audit`, `auditHTML`, `auditURL`, `auditPage`, `auditAxeOnly`) + builder API (`a11yAI()`).
- Batch auditing (`BatchAuditor`) with concurrency control + sitemap support + aggregated batch summary.
- Custom rule support via `a11yAI.registerRule(...)` and `createRule(...)`.
- Tooling scaffolding: Prettier, ESLint (flat config), Husky/lint-staged hooks, changesets config, and a minimal CI workflow.
- Minimal Next.js playground app (`apps/playground`) for manual testing.
- GitHub Action scaffold (`packages/github-action`) for running audits in CI.
