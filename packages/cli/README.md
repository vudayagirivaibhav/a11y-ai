# @a11y-ai/cli

Command-line interface for a11y-ai — AI-powered accessibility auditing.

## Install

```bash
# Global install
npm install -g @a11y-ai/cli

# Or run directly with npx
npx @a11y-ai/cli audit https://example.com
```

## Quick Start

```bash
# Audit a URL (quick mode, no API key needed)
a11y-ai audit https://example.com

# Audit with AI analysis
a11y-ai audit https://example.com --preset standard --provider openai

# Audit a local HTML file
a11y-ai audit ./index.html --format html --output report.html
```

## Commands

### `audit <target>`

Audit a URL or HTML file for accessibility issues.

```bash
a11y-ai audit https://example.com [options]
```

**Options:**

| Option              | Description                                      | Default          |
| ------------------- | ------------------------------------------------ | ---------------- |
| `--preset <name>`   | Preset: `quick`, `standard`, `thorough`          | `quick`          |
| `--provider <name>` | AI provider: `openai`, `anthropic`, `ollama`     | -                |
| `--model <name>`    | Model name (e.g., `gpt-4o-mini`)                 | Provider default |
| `--api-key <key>`   | API key (or use env vars)                        | -                |
| `--wcag <level>`    | WCAG level: `A`, `AA`, `AAA`                     | `AA`             |
| `--format <fmt>`    | Output: `json`, `html`, `md`, `sarif`, `console` | `console`        |
| `--output <file>`   | Write report to file                             | stdout           |
| `--threshold <n>`   | Fail if score below this                         | `70`             |
| `--verbose`         | Show detailed progress                           | `false`          |

**Batch Options:**

| Option             | Description                                  |
| ------------------ | -------------------------------------------- |
| `--urls <file>`    | Audit URLs from a file (one per line)        |
| `--sitemap <url>`  | Audit URLs from a sitemap.xml                |
| `--crawl`          | Treat target as site root, audit its sitemap |
| `--max-pages <n>`  | Limit pages for sitemap/crawl (default: 50)  |
| `--include <glob>` | Include URL pattern (repeatable)             |
| `--exclude <glob>` | Exclude URL pattern (repeatable)             |

### `rules [ruleId]`

List all rules or show details for a specific rule.

```bash
# List all rules
a11y-ai rules

# Show rule details
a11y-ai rules ai/alt-text-quality
```

### `init`

Create a configuration file.

```bash
a11y-ai init
# Creates .a11yairc.json
```

### `compare <previous> <current>`

Compare two JSON reports.

```bash
a11y-ai compare report-v1.json report-v2.json
# Previous: 72
# Current:  85
# Delta:    +13 (improved)
```

## Configuration

### Config File

Create `.a11yairc.json` in your project root:

```json
{
  "preset": "standard",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "wcag": "AA",
  "format": "html",
  "output": "a11y-report.html",
  "threshold": 70
}
```

### Environment Variables

```bash
# API keys
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...

# Or use a11y-ai specific vars
export A11Y_AI_PROVIDER=openai
export A11Y_AI_API_KEY=sk-...
export A11Y_AI_MODEL=gpt-4o-mini
```

## Examples

```bash
# Quick audit (free, axe-core only)
a11y-ai audit https://example.com --preset quick

# Standard audit with OpenAI
a11y-ai audit https://example.com --preset standard --provider openai

# Generate HTML report
a11y-ai audit https://example.com --format html --output report.html

# Audit with strict threshold
a11y-ai audit https://example.com --threshold 90

# Batch audit from sitemap
a11y-ai audit https://example.com --crawl --max-pages 20

# Audit specific URLs from file
a11y-ai audit --urls urls.txt --format json --output batch-report.json
```

## Exit Codes

| Code | Meaning                                     |
| ---- | ------------------------------------------- |
| `0`  | Success (score >= threshold)                |
| `1`  | Audit completed but score < threshold       |
| `2`  | Error (invalid args, network failure, etc.) |

## License

MIT
