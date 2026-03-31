# @a11y-ai/github-action

GitHub Action for running a11y-ai accessibility audits in CI/CD pipelines.

## Usage

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
          preset: 'standard'
          provider: 'openai'
          threshold: 70
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Inputs

| Input       | Description                                   | Required | Default          |
| ----------- | --------------------------------------------- | -------- | ---------------- |
| `url`       | URL to audit                                  | Yes      | -                |
| `preset`    | Audit preset: `quick`, `standard`, `thorough` | No       | `quick`          |
| `provider`  | AI provider: `openai`, `anthropic`, `ollama`  | No       | -                |
| `model`     | Model name                                    | No       | Provider default |
| `threshold` | Minimum passing score (0-100)                 | No       | `70`             |
| `wcag`      | WCAG level: `A`, `AA`, `AAA`                  | No       | `AA`             |
| `format`    | Report format: `json`, `sarif`                | No       | `json`           |

## Outputs

| Output       | Description                   |
| ------------ | ----------------------------- |
| `score`      | Accessibility score (0-100)   |
| `grade`      | Letter grade (A, B, C, D, F)  |
| `violations` | Number of violations found    |
| `report`     | Path to generated report file |

## Examples

### Quick Audit (Free)

```yaml
- uses: vudayagirivaibhav/a11y-ai@v0.1.0
  with:
    url: 'https://example.com'
    preset: 'quick'
```

### Standard Audit with OpenAI

```yaml
- uses: vudayagirivaibhav/a11y-ai@v0.1.0
  with:
    url: 'https://example.com'
    preset: 'standard'
    provider: 'openai'
    threshold: 80
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Upload SARIF to GitHub Security

```yaml
- uses: vudayagirivaibhav/a11y-ai@v0.1.0
  id: audit
  with:
    url: 'https://example.com'
    format: 'sarif'

- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: ${{ steps.audit.outputs.report }}
```

### Comment on PR

```yaml
- uses: vudayagirivaibhav/a11y-ai@v0.1.0
  id: audit
  with:
    url: 'https://example.com'

- uses: actions/github-script@v7
  if: github.event_name == 'pull_request'
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `## Accessibility Audit Results
        
        - **Score:** ${{ steps.audit.outputs.score }}/100 (${{ steps.audit.outputs.grade }})
        - **Violations:** ${{ steps.audit.outputs.violations }}
        `
      })
```

### Fail on Low Score

```yaml
- uses: vudayagirivaibhav/a11y-ai@v0.1.0
  with:
    url: 'https://example.com'
    threshold: 90 # Fail if score < 90
```

### Audit Preview Deployment

```yaml
deploy:
  runs-on: ubuntu-latest
  outputs:
    url: ${{ steps.deploy.outputs.url }}
  steps:
    - uses: actions/checkout@v4
    - id: deploy
      run: echo "url=https://preview-${{ github.sha }}.example.com" >> $GITHUB_OUTPUT

a11y:
  needs: deploy
  runs-on: ubuntu-latest
  steps:
    - uses: vudayagirivaibhav/a11y-ai@v0.1.0
      with:
        url: ${{ needs.deploy.outputs.url }}
        preset: 'standard'
```

## Environment Variables

| Variable            | Description                                         |
| ------------------- | --------------------------------------------------- |
| `OPENAI_API_KEY`    | OpenAI API key                                      |
| `ANTHROPIC_API_KEY` | Anthropic API key                                   |
| `A11Y_AI_API_KEY`   | Generic API key (used if provider-specific not set) |

## License

MIT
