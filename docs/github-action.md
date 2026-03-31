# a11y-ai GitHub Action

Run AI-powered accessibility audits in your CI/CD pipeline.

## Quick Start

```yaml
name: Accessibility Audit

on:
  push:
    branches: [main]
  pull_request:

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run accessibility audit
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        with:
          url: 'https://example.com'
          preset: 'quick'
```

## Inputs

| Input                | Description                                        | Required | Default    |
| -------------------- | -------------------------------------------------- | -------- | ---------- |
| `url`                | URL to audit                                       | No\*     | -          |
| `html-path`          | Path to local HTML file                            | No\*     | -          |
| `preset`             | Audit preset: `quick`, `standard`, `thorough`      | No       | `quick`    |
| `threshold`          | Minimum passing score (0-100)                      | No       | `70`       |
| `provider`           | AI provider: `openai`, `anthropic`, `ollama`       | No       | `openai`   |
| `api-key`            | AI provider API key                                | No\*\*   | -          |
| `format`             | Report format: `html`, `markdown`, `json`, `sarif` | No       | `markdown` |
| `fail-on-violations` | Fail if critical violations found                  | No       | `true`     |

\* Either `url` or `html-path` is required.
\*\* Required for `standard` and `thorough` presets.

## Outputs

| Output              | Description                               |
| ------------------- | ----------------------------------------- |
| `score`             | Accessibility score (0-100)               |
| `grade`             | Letter grade (A, B, C, D, F)              |
| `violations`        | Total number of violations found          |
| `passed`            | Whether the audit passed (`true`/`false`) |
| `fail-reason`       | Reason for failure (if any)               |
| `report-path`       | Path to HTML report                       |
| `report-md-path`    | Path to Markdown report                   |
| `report-json-path`  | Path to JSON report                       |
| `report-sarif-path` | Path to SARIF report                      |

## Examples

### 1. Basic Audit (Free, No API Key)

Audit a URL using only axe-core (no AI):

```yaml
name: Accessibility Audit

on:
  push:
    branches: [main]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Audit accessibility
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        with:
          url: 'https://your-site.com'
          preset: 'quick'
          threshold: '70'
```

### 2. AI-Powered Audit with OpenAI

Use AI for deeper semantic analysis:

```yaml
name: AI Accessibility Audit

on:
  push:
    branches: [main]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Audit with AI
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        with:
          url: 'https://your-site.com'
          preset: 'standard'
          provider: 'openai'
          api-key: ${{ secrets.OPENAI_API_KEY }}
          threshold: '80'
```

### 3. PR Comment on Vercel Preview

Audit preview deployments and comment on PRs:

```yaml
name: Accessibility on PR

on:
  pull_request:

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Wait for Vercel deployment
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
        id: vercel
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300

      - name: Audit preview
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        with:
          url: ${{ steps.vercel.outputs.url }}
          preset: 'standard'
          api-key: ${{ secrets.OPENAI_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Scheduled Weekly Audit

Run audits on a schedule:

```yaml
name: Weekly Accessibility Audit

on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9am UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Audit production site
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        with:
          url: 'https://your-production-site.com'
          preset: 'thorough'
          api-key: ${{ secrets.OPENAI_API_KEY }}
          threshold: '85'
```

### 5. Audit Local HTML Build

Audit static HTML files without a live URL:

```yaml
name: Audit Build Output

on:
  push:
    branches: [main]

jobs:
  build-and-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build site
        run: npm run build

      - name: Audit output
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        with:
          html-path: './dist/index.html'
          preset: 'quick'
```

### 6. Upload SARIF to GitHub Security

View accessibility issues in GitHub's Security tab:

```yaml
name: Security Audit

on:
  push:
    branches: [main]

jobs:
  a11y:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Audit
        id: audit
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        with:
          url: 'https://your-site.com'
          preset: 'standard'
          api-key: ${{ secrets.OPENAI_API_KEY }}

      # SARIF upload is automatic, but you can also do it manually:
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ${{ steps.audit.outputs.report-sarif-path }}
```

### 7. Multiple Pages Audit

Audit multiple pages in parallel:

```yaml
name: Multi-Page Audit

on:
  push:
    branches: [main]

jobs:
  a11y:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        page:
          - url: 'https://your-site.com'
            name: 'home'
          - url: 'https://your-site.com/about'
            name: 'about'
          - url: 'https://your-site.com/contact'
            name: 'contact'
    steps:
      - uses: actions/checkout@v4

      - name: Audit ${{ matrix.page.name }}
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        with:
          url: ${{ matrix.page.url }}
          preset: 'quick'
```

### 8. Custom Threshold with Failure Handling

Continue on failure and handle results manually:

```yaml
name: Audit with Custom Handling

on:
  pull_request:

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Audit
        id: audit
        uses: vudayagirivaibhav/a11y-ai@v0.1.0
        continue-on-error: true
        with:
          url: 'https://your-site.com'
          preset: 'standard'
          api-key: ${{ secrets.OPENAI_API_KEY }}
          threshold: '90'

      - name: Check results
        run: |
          echo "Score: ${{ steps.audit.outputs.score }}"
          echo "Grade: ${{ steps.audit.outputs.grade }}"
          echo "Violations: ${{ steps.audit.outputs.violations }}"

          if [ "${{ steps.audit.outputs.score }}" -lt 70 ]; then
            echo "::warning::Accessibility score is below 70!"
          fi

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Accessibility Results
              
              - **Score:** ${{ steps.audit.outputs.score }}/100 (${{ steps.audit.outputs.grade }})
              - **Violations:** ${{ steps.audit.outputs.violations }}
              - **Status:** ${{ steps.audit.outputs.passed == 'true' && '✅ Passed' || '❌ Failed' }}
              `
            })
```

## Presets

| Preset     | AI Rules | Vision | Cost        | Use Case                         |
| ---------- | -------- | ------ | ----------- | -------------------------------- |
| `quick`    | None     | No     | Free        | Fast CI checks, basic validation |
| `standard` | All 9    | No     | ~$0.01/page | Comprehensive analysis           |
| `thorough` | All 9    | Yes    | ~$0.05/page | Deep analysis with screenshots   |

## Environment Variables

The action automatically uses these environment variables:

| Variable            | Description                                   |
| ------------------- | --------------------------------------------- |
| `GITHUB_TOKEN`      | Used for PR comments (automatically provided) |
| `OPENAI_API_KEY`    | Alternative to `api-key` input                |
| `ANTHROPIC_API_KEY` | For Anthropic provider                        |

## Troubleshooting

### "API key required"

For `standard` and `thorough` presets, you need an API key:

```yaml
with:
  api-key: ${{ secrets.OPENAI_API_KEY }}
```

### "Score below threshold"

The action fails by default if the score is below the threshold. To continue anyway:

```yaml
- uses: vudayagirivaibhav/a11y-ai@v0.1.0
  continue-on-error: true
```

### PR comments not appearing

Ensure `GITHUB_TOKEN` has write permissions:

```yaml
permissions:
  pull-requests: write
```

## License

MIT
