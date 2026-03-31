# @a11y-ai/ai-providers

## 0.2.0

### Minor Changes

- 21a3331: Initial public release v0.1.0.

  ## Features

  ### Core Engine
  - DOM extraction engine with jsdom support
  - axe-core integration with normalization and deduplication
  - 3 presets: `quick` (free), `standard` (AI), `thorough` (AI + vision)
  - 5 report formats: JSON, HTML, Markdown, SARIF, console
  - Batch auditing with sitemap support
  - Programmatic API with builder pattern and progress events

  ### AI Rules (9 total)
  - `ai/alt-text-quality` — Image alt text validation
  - `ai/link-text-quality` — Link text descriptiveness
  - `ai/form-label-quality` — Form label clarity
  - `ai/heading-structure` — Heading hierarchy
  - `ai/aria-usage` — ARIA attribute validation
  - `ai/color-contrast` — Color contrast (static + AI hybrid)
  - `ai/keyboard-navigation` — Keyboard accessibility
  - `ai/language-quality` — Reading level and lang attributes
  - `ai/media-accessibility` — Video/audio captions

  ### AI Providers
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Anthropic (Claude 3)
  - Ollama (local models)
  - Custom handler support
  - Mock provider for testing

  ### CLI
  - `a11y-ai audit <url|file>` — Single page audit
  - `a11y-ai audit --sitemap <url>` — Batch audit from sitemap
  - `a11y-ai rules` — List all rules
  - `a11y-ai init` — Create config file
  - `a11y-ai compare` — Compare two reports
  - Config file support (`.a11yairc.json`)
  - Environment variable support

  ### GitHub Action
  - Run audits in CI/CD pipelines
  - SARIF output for GitHub Security tab
  - Configurable threshold for pass/fail

### Patch Changes

- Updated dependencies [21a3331]
  - @a11y-ai/core@0.2.0
