#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { A11yAuditor, BatchAuditor, ReportGenerator, toAuditConfig } from '@a11y-ai/core';
import { RuleRegistry, registerBuiltinRules } from '@a11y-ai/rules';

import { compareWith } from './lib/compare.js';
import { findConfigFile, loadConfigFile, mergeConfig } from './lib/config.js';

type Commander = typeof import('commander');
type Ora = typeof import('ora');

type WcagLevel = 'A' | 'AA' | 'AAA';
type ProviderName = 'openai' | 'anthropic' | 'ollama' | 'custom';

async function main(): Promise<void> {
  const cwd = process.cwd();
  const cfgPath = findConfigFile(cwd);
  const cfg = cfgPath ? await loadConfigFile(cfgPath) : {};

  const commander = await tryImportCommander();
  if (!commander) {
    console.error(
      'Missing optional dependency "commander". Install: pnpm -C packages/cli add commander',
    );
    process.exit(2);
  }

  const { Command } = commander;
  const program = new Command();
  program.name('a11y-ai').description('AI-powered accessibility auditor').version('0.0.0');

  program
    .command('audit')
    .argument('[target]', 'URL or path to HTML file')
    .option('--preset <preset>', 'Preset name', cfg.preset)
    .option('--provider <provider>', 'AI provider', cfg.provider)
    .option('--model <model>', 'Model name', cfg.model)
    .option('--api-key <key>', 'API key', cfg.apiKey)
    .option('--wcag <level>', 'WCAG level for axe-core: A|AA|AAA', cfg.wcag ?? 'AA')
    .option(
      '--format <format>',
      'Output format: json|html|md|sarif|console',
      cfg.format ?? 'console',
    )
    .option('--output <file>', 'Output file path', cfg.output)
    .option(
      '--threshold <n>',
      'Fail below this score',
      (v: string) => Number(v),
      cfg.threshold ?? 70,
    )
    .option('--verbose', 'Verbose output', cfg.verbose ?? false)
    .option('--urls <file>', 'Audit a list of URLs (one per line)')
    .option('--sitemap <url>', 'Audit URLs discovered from a sitemap.xml')
    .option('--crawl', 'Treat <target> as a site root and audit its /sitemap.xml')
    .option(
      '--max-pages <n>',
      'Limit number of pages for --sitemap/--crawl',
      (v: string) => Number(v),
      50,
    )
    .option(
      '--include <glob>',
      'Include URL glob when crawling sitemaps (repeatable)',
      collectRepeatable,
      [],
    )
    .option(
      '--exclude <glob>',
      'Exclude URL glob when crawling sitemaps (repeatable)',
      collectRepeatable,
      [],
    )
    .action(async (target: string | undefined, options: Record<string, unknown>) => {
      const merged = mergeConfig(cfg, {
        preset: options.preset as string,
        provider: options.provider as string,
        model: options.model as string,
        apiKey: options.apiKey as string,
        wcag: options.wcag ? toWcagLevel(options.wcag) : undefined,
        format: options.format as string,
        output: options.output as string,
        threshold: options.threshold as number,
        verbose: Boolean(options.verbose),
      });

      const ora = await tryImportOra();
      const spinner = ora ? ora.default('Starting audit...').start() : null;

      const auditConfig = toAuditConfig({
        preset: merged.preset,
        provider: {
          name: toProviderName(merged.provider ?? process.env.A11Y_AI_PROVIDER),
          apiKey:
            merged.apiKey ??
            process.env.A11Y_AI_API_KEY ??
            process.env.OPENAI_API_KEY ??
            process.env.ANTHROPIC_API_KEY,
          model: merged.model ?? process.env.A11Y_AI_MODEL ?? undefined,
        },
        axe: { standard: wcagToAxeStandard(toWcagLevel(merged.wcag ?? 'AA')) },
        rules: merged.rules ?? {},
        parallelism: 3,
        concurrency: 3,
      });

      const reporter = new ReportGenerator();
      const format = (merged.format ?? 'console').toLowerCase();
      const threshold = merged.threshold ?? 70;

      const batchMode = Boolean(options.urls || options.sitemap || options.crawl);

      if (batchMode) {
        const batch = new BatchAuditor(auditConfig);

        if (spinner) {
          batch.on('progress', (p: { completed: number; total: number; percent: number }) => {
            spinner.text = `Auditing pages... (${p.completed}/${p.total})`;
          });
          batch.on('page:complete', (p: { target: string; score: number }) => {
            if (merged.verbose) spinner.text = `Done: ${p.target} (score ${p.score})`;
          });
        }

        const maxPages = Number(options.maxPages ?? 50);
        const include = (options.include as string[]) ?? [];
        const exclude = (options.exclude as string[]) ?? [];

        const batchResult = options.urls
          ? await batch.audit(readUrlsFile(path.resolve(cwd, String(options.urls))))
          : await batch.auditSitemap(resolveSitemapTarget(target, options), {
              maxPages,
              include,
              exclude,
            });

        spinner?.succeed(
          `Batch audit complete. Avg score: ${batchResult.summary.averageScore} (${batchResult.summary.succeeded}/${batchResult.summary.totalPages} succeeded)`,
        );

        const output =
          format === 'json'
            ? JSON.stringify(batchResult, null, 2)
            : format === 'html'
              ? generateBatchHtml(batchResult)
              : format === 'md' || format === 'markdown'
                ? generateBatchMarkdown(batchResult)
                : JSON.stringify(batchResult, null, 2);

        if (merged.output) {
          writeFileSync(path.resolve(cwd, merged.output), output, 'utf8');
        } else {
          process.stdout.write(output + '\n');
        }

        process.exit(batchResult.summary.averageScore >= threshold ? 0 : 1);
      }

      if (!target) {
        console.error('Missing <target>. Provide a URL/file, or use --urls/--sitemap/--crawl.');
        process.exit(2);
      }

      const resolvedTarget = resolveTarget(target, cwd);
      const htmlOrUrl =
        resolvedTarget.kind === 'file'
          ? readFileSync(resolvedTarget.path, 'utf8')
          : resolvedTarget.url;

      const auditor = new A11yAuditor(auditConfig);
      if (spinner) {
        const registry = RuleRegistry.create();
        registerBuiltinRules(registry);
        const enabled = registry.enabledRules(
          toAuditConfig({ preset: merged.preset, provider: { name: 'custom' } }),
        );
        let done = 0;
        const total = enabled.length;

        auditor.on('start', () => {
          spinner.text = 'Extracting DOM and running axe-core...';
        });
        auditor.on('axe:complete', () => {
          spinner.text = `Running AI rules... (0/${total})`;
        });
        auditor.on('rule:start', (ruleId: string) => {
          if (merged.verbose) spinner.text = `Running ${ruleId}... (${done}/${total})`;
        });
        auditor.on('rule:complete', () => {
          done += 1;
          spinner.text = `Running AI rules... (${done}/${total})`;
        });
      }
      const result =
        resolvedTarget.kind === 'file'
          ? await auditor.auditHTML(htmlOrUrl)
          : await auditor.auditURL(htmlOrUrl);

      spinner?.succeed(`Audit complete. Score: ${result.summary.score}`);

      const output =
        format === 'json'
          ? reporter.generateJSON(result)
          : format === 'html'
            ? reporter.generateHTML(result)
            : format === 'md' || format === 'markdown'
              ? reporter.generateMarkdown(result)
              : format === 'sarif'
                ? reporter.generateSARIF(result)
                : reporter.generateConsole(result);

      if (merged.output) {
        writeFileSync(path.resolve(cwd, merged.output), output, 'utf8');
      } else {
        process.stdout.write(output + '\n');
      }

      process.exit(result.summary.score >= threshold ? 0 : 1);
    });

  program
    .command('rules')
    .argument('[ruleId]', 'Rule id to inspect')
    .action((ruleId?: string) => {
      const registry = RuleRegistry.create();
      registerBuiltinRules(registry);
      if (ruleId) {
        const rule = registry.get(ruleId);
        if (!rule) {
          console.error(`Unknown rule: ${ruleId}`);
          process.exit(2);
        }
        console.log(`${rule.id} (${rule.category})`);
        console.log(rule.description);
        return;
      }

      for (const rule of registry.getAll()) {
        console.log(`${rule.id}\t${rule.category}\t${rule.description}`);
      }
    });

  program
    .command('init')
    .option('--path <file>', 'Where to write config', '.a11yairc.json')
    .action((opts: { path: string }) => {
      const outPath = path.resolve(cwd, opts.path);
      const template = {
        preset: 'standard',
        provider: 'openai',
        model: 'gpt-4o-mini',
        wcag: 'AA',
        format: 'html',
        output: 'a11y-ai-report.html',
        threshold: 70,
        rules: {},
      };
      writeFileSync(outPath, JSON.stringify(template, null, 2), 'utf8');
      console.log(`Wrote ${outPath}`);
    });

  program
    .command('compare')
    .argument('<previous>', 'Previous JSON report')
    .argument('<current>', 'Current JSON report')
    .action((previousPath: string, currentPath: string) => {
      const prev = JSON.parse(readFileSync(path.resolve(cwd, previousPath), 'utf8'));
      const curr = JSON.parse(readFileSync(path.resolve(cwd, currentPath), 'utf8'));
      const cmp = compareWith(prev, curr);
      console.log(`Previous: ${cmp.previousScore}`);
      console.log(`Current:  ${cmp.currentScore}`);
      console.log(`Delta:    ${cmp.delta} (${cmp.direction})`);
      process.exit(0);
    });

  await program.parseAsync(process.argv);
}

function resolveTarget(
  target: string,
  cwd: string,
): { kind: 'url'; url: string } | { kind: 'file'; path: string } {
  try {
    const u = new URL(target);
    return { kind: 'url', url: u.toString() };
  } catch {
    return { kind: 'file', path: path.resolve(cwd, target) };
  }
}

async function tryImportCommander(): Promise<Commander | null> {
  try {
    return await import('commander');
  } catch {
    return null;
  }
}

async function tryImportOra(): Promise<Ora | null> {
  try {
    return await import('ora');
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

function wcagToAxeStandard(level: 'A' | 'AA' | 'AAA'): import('@a11y-ai/core').AxeStandard {
  if (level === 'A') return 'wcag2a';
  if (level === 'AAA') return 'wcag2aaa';
  return 'wcag2aa';
}

function collectRepeatable(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function toWcagLevel(value: unknown): WcagLevel {
  if (value === 'A' || value === 'AA' || value === 'AAA') return value;
  return 'AA';
}

function toProviderName(value: unknown): ProviderName {
  if (value === 'openai' || value === 'anthropic' || value === 'ollama' || value === 'custom')
    return value;
  return 'custom';
}

function readUrlsFile(filePath: string): string[] {
  const raw = readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

function resolveSitemapTarget(
  target: string | undefined,
  options: Record<string, unknown>,
): string {
  if (options.sitemap) return String(options.sitemap);
  if (options.crawl) {
    if (!target) throw new Error('Missing <target> for --crawl');
    const u = new URL(target);
    return new URL('/sitemap.xml', u).toString();
  }
  if (!target) throw new Error('Missing sitemap target');
  return target;
}

function generateBatchMarkdown(result: import('@a11y-ai/core').BatchAuditResult): string {
  const lines: string[] = [];
  lines.push('# a11y-ai batch report');
  lines.push('');
  lines.push(
    `- Pages: **${result.summary.totalPages}** (ok: ${result.summary.succeeded}, failed: ${result.summary.failed})`,
  );
  lines.push(`- Average score: **${result.summary.averageScore}**`);
  lines.push('');

  if (result.summary.siteWideIssues.length > 0) {
    lines.push('## Site-wide issues');
    lines.push('');
    for (const i of result.summary.siteWideIssues) {
      lines.push(`- \`${i.key}\` — on ${i.countPages} pages (e.g. "${i.example.message}")`);
    }
    lines.push('');
  }

  lines.push('## Worst pages');
  lines.push('');
  for (const p of result.summary.worstPages) {
    lines.push(`- ${p.score} — ${p.target}`);
  }
  lines.push('');

  return lines.join('\n');
}

function generateBatchHtml(result: import('@a11y-ai/core').BatchAuditResult): string {
  const pages = result.pages.filter((p) => p.result);
  const nav = pages
    .map((p, idx) => `<li><a href="#page-${idx}">${escapeHtml(p.target)}</a></li>`)
    .join('');

  const sections = pages
    .map((p, idx) => {
      const r = p.result!;
      const violations = r.mergedViolations
        .slice(0, 25)
        .map((v) => `<li><b>${v.severity}</b> — ${escapeHtml(v.message)}</li>`)
        .join('');
      return `<section id="page-${idx}">
  <h2>${escapeHtml(p.target)}</h2>
  <p><b>Score:</b> ${r.summary.score} (${r.summary.grade}) · <b>Violations:</b> ${r.mergedViolations.length}</p>
  <details>
    <summary>Top violations</summary>
    <ul>${violations}</ul>
  </details>
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>a11y-ai batch report</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; line-height: 1.4; }
    nav ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; padding-left: 18px; }
    section { border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>a11y-ai batch report</h1>
  <p><b>Average score:</b> ${result.summary.averageScore} · <b>Pages:</b> ${result.summary.totalPages} (ok: ${result.summary.succeeded}, failed: ${result.summary.failed})</p>
  <nav>
    <h2>Pages</h2>
    <ul>${nav}</ul>
  </nav>
  ${sections}
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
