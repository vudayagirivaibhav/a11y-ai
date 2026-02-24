# a11y-ai GitHub Action

This repository includes a composite GitHub Action at `packages/github-action` that runs an accessibility audit and
uploads an HTML report artifact.

## Example workflow

```yaml
name: Accessibility audit

on:
  pull_request:
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Audit a URL
        uses: ./packages/github-action
        with:
          url: https://example.com
          preset: standard
          threshold: 70
          provider: openai
          api-key: ${{ secrets.OPENAI_API_KEY }}
          format: markdown
          fail-on-violations: true
```

## Inputs

- `url` (optional): URL to audit
- `html-path` (optional): path to a local HTML file to audit
- `preset` (default: `standard`)
- `threshold` (default: `70`)
- `provider` (default: `openai`)
- `api-key` (required): provider API key
- `format` (default: `markdown`): report format to generate (the action always generates HTML + Markdown + JSON + SARIF)
- `fail-on-violations` (default: `true`): fail if any critical violations are found

## Outputs

- `score`: accessibility score (0–100)
- `violations`: merged violation count
- `report-path`: path to the generated HTML report (also uploaded as an artifact named `a11y-ai-report`)
