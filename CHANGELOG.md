# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-17

### Added

#### Core Engine (`@a11y-ai/core`)

- DOM extraction engine (HTML via `jsdom`, URL/page extraction via Playwright/Puppeteer)
- `axe-core` runner with normalization and merge utilities
- Audit orchestrator (`A11yAuditor`) with concurrent rule execution, timeouts, and caching
- Progress events (`start`, `axe:complete`, `rule:start`, `rule:complete`, `complete`)
- Scoring engine producing 0–100 score + letter grade (A-F) + category breakdown
- Report generator for JSON, HTML, Markdown, SARIF, and console output
- Batch auditing (`BatchAuditor`) with concurrency control and sitemap support
- Programmatic API: `audit`, `auditHTML`, `auditURL`, `auditPage`, `auditAxeOnly`
- Builder API: `a11yAI()` with fluent interface
- Presets: `quick` (no AI), `standard` (AI), `thorough` (AI + vision)

#### Rules Engine (`@a11y-ai/rules`)

- Rules engine framework with registry, base rule utilities, and prompt builder
- Zod-based structured AI output schemas for type-safe responses
- 9 built-in rules:
  - `ai/alt-text-quality` — static + AI + optional vision verification
  - `ai/link-text-quality` — empty links, generic text, duplicate ambiguous links
  - `ai/contrast-analysis` — computed-style contrast with AI assist
  - `ai/form-label-relevance` — label association and relevance
  - `ai/heading-structure` — outline validation, skipped levels
  - `ai/aria-validation` — invalid/redundant ARIA patterns
  - `ai/keyboard-navigation` — tabindex traps, missing keyboard handlers
  - `ai/language-readability` — lang attribute, readability scoring
  - `ai/media-accessibility` — captions/transcripts heuristics
- Custom rule support via `createRule()` helper

#### AI Providers (`@a11y-ai/ai-providers`)

- Provider abstraction with adapters for OpenAI, Anthropic, Ollama
- Mock provider for testing
- Custom provider support
- Structured JSON output with Zod schema validation
- Retry logic with exponential backoff
- Request timeouts and rate limiting

#### CLI (`@a11y-ai/cli`)

- Full-featured CLI with `audit`, `compare`, and `init` commands
- Config file discovery (`.a11yairc.json`, `a11y-ai.config.js`)
- WCAG level selection, report formats, thresholds
- Batch auditing from URL files and sitemaps
- Environment variable support

#### GitHub Action (`@a11y-ai/github-action`)

- Composite action for CI/CD integration
- PR comment feature with formatted violation tables
- Job summary with score and grade
- SARIF upload to GitHub Security tab
- Multiple report format outputs

#### Playground (`apps/playground`)

- Next.js 14 playground application
- URL and HTML auditing with live preview
- Real-time progress streaming via SSE
- Rules browser with search and filtering
- Dark mode support
- Mobile-responsive design

#### Infrastructure

- Monorepo with pnpm workspaces
- TypeScript with strict mode
- Vitest for testing
- ESLint + Prettier for code quality
- Husky + lint-staged for pre-commit hooks
- Changesets for version management
- CI pipeline with Node 18, 20, 22 matrix testing
- Automated release workflow

### Documentation

- Comprehensive README with comparison table
- Package-level READMEs for all packages
- CONTRIBUTING.md with architecture guide
- SECURITY.md with vulnerability reporting
- GitHub Action documentation with 8 workflow examples

## [Unreleased]

_No unreleased changes yet._

---

For detailed commit history, see [GitHub Commits](https://github.com/vudayagirivaibhav/a11y-ai/commits/main).
