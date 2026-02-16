import type { AuditResult } from '../types/audit.js';
import type { Violation } from '../types/violation.js';

/**
 * Reporter interface for custom report formats.
 */
export interface Reporter {
  /** Format identifier (e.g., `json`, `html`, `md`, `sarif`, `console`). */
  format: string;
  generate(result: AuditResult): string;
}

/**
 * Options for JSON report generation.
 */
export interface JsonReportOptions {
  /** Pretty-print output. Defaults to true. */
  pretty?: boolean;
}

/**
 * Options for Markdown report generation.
 */
export interface MarkdownReportOptions {
  /** Include raw HTML snippets for each violation. Defaults to true. */
  includeHtmlSnippets?: boolean;
}

/**
 * Options for HTML report generation.
 */
export interface HtmlReportOptions {
  /** Page title for the report. */
  title?: string;
}

/**
 * Options for console report generation.
 */
export interface ConsoleReportOptions {
  /** Disable ANSI colors. Defaults to false. */
  noColor?: boolean;
}

/**
 * Report generator for common output formats.
 */
export class ReportGenerator {
  generateJSON(result: AuditResult, options: JsonReportOptions = {}): string {
    const pretty = options.pretty !== false;
    return JSON.stringify(
      {
        schemaVersion: result.metadata.schemaVersion,
        ...result,
      },
      null,
      pretty ? 2 : 0,
    );
  }

  generateMarkdown(result: AuditResult, options: MarkdownReportOptions = {}): string {
    const includeHtml = options.includeHtmlSnippets !== false;
    const grouped = groupByCategory(result.mergedViolations);

    const lines: string[] = [];
    lines.push(`# a11y-ai report`);
    lines.push('');
    lines.push(`- URL: \`${result.url}\``);
    lines.push(`- Score: **${result.summary.score}** (${result.summary.grade})`);
    lines.push(`- Violations: **${result.mergedViolations.length}**`);
    lines.push('');

    lines.push(`## Severity breakdown`);
    lines.push('');
    lines.push(`| critical | serious | moderate | minor |`);
    lines.push(`| --- | --- | --- | --- |`);
    lines.push(
      `| ${result.summary.bySeverity.critical} | ${result.summary.bySeverity.serious} | ${result.summary.bySeverity.moderate} | ${result.summary.bySeverity.minor} |`,
    );
    lines.push('');

    lines.push(`## Violations by category`);
    lines.push('');

    for (const [category, violations] of Object.entries(grouped)) {
      lines.push(`### ${category}`);
      lines.push('');

      violations.forEach((v, idx) => {
        lines.push(`#### ${idx + 1}. ${v.severity.toUpperCase()} — ${v.message}`);
        lines.push('');
        lines.push(`- Selector: \`${v.selector}\``);
        lines.push(`- Source: \`${v.source}\``);
        if (v.suggestion) lines.push(`- Suggestion: ${v.suggestion}`);
        if (typeof v.confidence === 'number') lines.push(`- Confidence: ${v.confidence.toFixed(2)}`);
        if (includeHtml) {
          const html = v.axe?.html ?? v.rule?.element.html ?? '';
          if (html) {
            lines.push('');
            lines.push('```html');
            lines.push(html);
            lines.push('```');
          }
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  generateHTML(result: AuditResult, options: HtmlReportOptions = {}): string {
    const title = options.title ?? 'a11y-ai report';
    const score = result.summary.score;
    const grouped = groupByCategory(result.mergedViolations);

    // Donut chart via conic-gradient.
    const donut = `conic-gradient(#22c55e ${score}%, #ef4444 0)`;

    const rows = result.mergedViolations
      .map((v, i) => {
        const html = escapeHtml(v.axe?.html ?? v.rule?.element.html ?? '');
        return `<tr data-category="${escapeAttr(v.category ?? 'uncategorized')}" data-severity="${v.severity}">
  <td>${i + 1}</td>
  <td><span class="sev sev-${v.severity}">${v.severity}</span></td>
  <td>${escapeHtml(v.category ?? 'uncategorized')}</td>
  <td><code>${escapeHtml(v.selector)}</code></td>
  <td>${escapeHtml(v.message)}</td>
  <td>${escapeHtml(v.suggestion ?? '')}</td>
  <td><details><summary>HTML</summary><pre><code>${html}</code></pre></details></td>
</tr>`;
      })
      .join('\n');

    const categoryBars = Object.entries(result.summary.categories)
      .map(([cat, c]) => {
        return `<div class="cat">
  <div class="cat-head">
    <div class="cat-name">${escapeHtml(cat)}</div>
    <div class="cat-score">${c.score} (${escapeHtml(c.grade)})</div>
  </div>
  <div class="bar"><div class="bar-fill" style="width:${c.score}%"></div></div>
</div>`;
      })
      .join('\n');

    const categoryOptions = Object.keys(grouped)
      .sort()
      .map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`)
      .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; }
    h1 { margin: 0 0 8px; }
    .muted { opacity: 0.8; }
    .grid { display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: start; }
    .card { border: 1px solid rgba(127,127,127,0.25); border-radius: 12px; padding: 16px; background: rgba(127,127,127,0.06); }
    .donut { width: 140px; height: 140px; border-radius: 999px; background: ${donut}; display: grid; place-items: center; margin: 12px 0; }
    .donut > div { width: 110px; height: 110px; border-radius: 999px; background: canvas; display: grid; place-items: center; border: 1px solid rgba(127,127,127,0.25); }
    .score { font-size: 28px; font-weight: 700; }
    .cats { display: grid; gap: 12px; margin-top: 12px; }
    .bar { height: 10px; border-radius: 999px; background: rgba(127,127,127,0.2); overflow: hidden; }
    .bar-fill { height: 100%; background: #60a5fa; border-radius: 999px; }
    .cat-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid rgba(127,127,127,0.25); padding: 10px; vertical-align: top; }
    th { text-align: left; position: sticky; top: 0; background: canvas; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    pre { white-space: pre-wrap; word-break: break-word; }
    .sev { padding: 2px 8px; border-radius: 999px; font-size: 12px; }
    .sev-critical { background: rgba(239, 68, 68, 0.2); }
    .sev-serious { background: rgba(245, 158, 11, 0.2); }
    .sev-moderate { background: rgba(59, 130, 246, 0.2); }
    .sev-minor { background: rgba(34, 197, 94, 0.2); }
    .filters { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; }
    select { padding: 8px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35); background: canvas; color: inherit; }
    @media print { .filters { display:none; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="muted">URL: ${escapeHtml(result.url)} • Completed: ${escapeHtml(result.timestamp)}</div>

  <div class="grid" style="margin-top: 16px;">
    <div class="card">
      <div class="donut"><div><div class="score">${score}</div></div></div>
      <div class="muted">Grade: <strong>${escapeHtml(result.summary.grade)}</strong></div>
      <div class="muted">Violations: <strong>${result.mergedViolations.length}</strong></div>

      <div class="cats">${categoryBars}</div>
    </div>

    <div class="card">
      <div class="filters">
        <label>Category
          <select id="cat">
            <option value="">All</option>
            ${categoryOptions}
          </select>
        </label>
        <label>Severity
          <select id="sev">
            <option value="">All</option>
            <option value="critical">critical</option>
            <option value="serious">serious</option>
            <option value="moderate">moderate</option>
            <option value="minor">minor</option>
          </select>
        </label>
      </div>

      <table id="tbl">
        <thead>
          <tr>
            <th>#</th>
            <th>Severity</th>
            <th>Category</th>
            <th>Selector</th>
            <th>Issue</th>
            <th>Suggestion</th>
            <th>Element</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const cat = document.getElementById('cat');
    const sev = document.getElementById('sev');
    const rows = Array.from(document.querySelectorAll('#tbl tbody tr'));
    function apply() {
      const c = cat.value;
      const s = sev.value;
      rows.forEach(r => {
        const okC = !c || r.dataset.category === c;
        const okS = !s || r.dataset.severity === s;
        r.style.display = (okC && okS) ? '' : 'none';
      });
    }
    cat.addEventListener('change', apply);
    sev.addEventListener('change', apply);
  </script>
</body>
</html>`;
  }

  generateSARIF(result: AuditResult): string {
    const sarif = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'a11y-ai',
              informationUri: 'https://github.com/',
              rules: [],
            },
          },
          results: result.mergedViolations.map((v) => ({
            ruleId: v.axe?.id ?? v.rule?.ruleId ?? 'a11y-ai',
            level: sarifLevel(v.severity),
            message: { text: `${v.message}${v.suggestion ? ` Suggestion: ${v.suggestion}` : ''}` },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: result.url || 'page.html' },
                },
              },
            ],
            properties: {
              category: v.category,
              selector: v.selector,
              source: v.source,
              confidence: v.confidence,
            },
          })),
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }

  generateConsole(result: AuditResult, options: ConsoleReportOptions = {}): string {
    const color = options.noColor ? noColorize : colorize;
    const scoreColor =
      result.summary.score >= 80 ? 'green' : result.summary.score >= 70 ? 'yellow' : 'red';

    const lines: string[] = [];
    lines.push(`${color(scoreColor, `Score: ${result.summary.score} (${result.summary.grade})`)}  URL: ${result.url}`);
    lines.push(`Violations: ${result.mergedViolations.length}`);
    lines.push(
      `By severity: critical=${result.summary.bySeverity.critical} serious=${result.summary.bySeverity.serious} moderate=${result.summary.bySeverity.moderate} minor=${result.summary.bySeverity.minor}`,
    );

    for (const v of result.mergedViolations.slice(0, 50)) {
      const sev = v.severity;
      const sevColor = sev === 'critical' ? 'red' : sev === 'serious' ? 'yellow' : 'blue';
      lines.push(
        `- ${color(sevColor, sev.toUpperCase())} [${v.category ?? 'uncategorized'}] ${v.selector}: ${v.message}`,
      );
    }

    if (result.mergedViolations.length > 50) {
      lines.push(`…and ${result.mergedViolations.length - 50} more`);
    }

    return lines.join('\n');
  }
}

function groupByCategory(violations: Violation[]): Record<string, Violation[]> {
  const grouped: Record<string, Violation[]> = {};
  for (const v of violations) {
    const cat = v.category ?? 'uncategorized';
    (grouped[cat] ??= []).push(v);
  }
  return grouped;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function sarifLevel(severity: string): string {
  if (severity === 'critical') return 'error';
  if (severity === 'serious') return 'error';
  if (severity === 'moderate') return 'warning';
  return 'note';
}

type ColorName = 'red' | 'yellow' | 'green' | 'blue';

function colorize(color: ColorName, text: string): string {
  const code = color === 'red' ? 31 : color === 'yellow' ? 33 : color === 'green' ? 32 : 34;
  return `\u001b[${code}m${text}\u001b[0m`;
}

function noColorize(_color: ColorName, text: string): string {
  return text;
}

