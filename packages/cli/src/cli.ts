#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { A11yAuditor, ReportGenerator } from 'a11y-ai';
import { RuleRegistry, registerBuiltinRules } from '@a11y-ai/rules';

import { compareWith } from './lib/compare.js';
import { findConfigFile, loadConfigFile, mergeConfig } from './lib/config.js';

type Commander = typeof import('commander');
type Ora = typeof import('ora');

async function main(): Promise<void> {
  const cwd = process.cwd();
  const cfgPath = findConfigFile(cwd);
  const cfg = cfgPath ? await loadConfigFile(cfgPath) : {};

  const commander = await tryImportCommander();
  if (!commander) {
    console.error('Missing optional dependency "commander". Install: pnpm -C packages/cli add commander');
    process.exit(2);
  }

  const { Command } = commander;
  const program = new Command();
  program.name('a11y-ai').description('AI-powered accessibility auditor').version('0.0.0');

  program
    .command('audit')
    .argument('<target>', 'URL or path to HTML file')
    .option('--preset <preset>', 'Preset name', cfg.preset)
    .option('--provider <provider>', 'AI provider', cfg.provider)
    .option('--model <model>', 'Model name', cfg.model)
    .option('--api-key <key>', 'API key', cfg.apiKey)
    .option('--format <format>', 'Output format: json|html|md|sarif|console', cfg.format ?? 'console')
    .option('--output <file>', 'Output file path', cfg.output)
    .option('--threshold <n>', 'Fail below this score', (v) => Number(v), cfg.threshold ?? 70)
    .option('--verbose', 'Verbose output', cfg.verbose ?? false)
    .action(async (target: string, options: Record<string, unknown>) => {
      const merged = mergeConfig(cfg, {
        preset: options.preset as string,
        provider: options.provider as string,
        model: options.model as string,
        apiKey: options.apiKey as string,
        format: options.format as string,
        output: options.output as string,
        threshold: options.threshold as number,
        verbose: Boolean(options.verbose),
      });

      const resolvedTarget = resolveTarget(target, cwd);
      const htmlOrUrl = resolvedTarget.kind === 'file' ? readFileSync(resolvedTarget.path, 'utf8') : resolvedTarget.url;

      const ora = await tryImportOra();
      const spinner = ora ? ora.default('Running audit...').start() : null;

      const auditor = new A11yAuditor({
        aiProvider: {
          provider: (merged.provider as any) ?? process.env.A11Y_AI_PROVIDER ?? 'custom',
          apiKey: merged.apiKey ?? process.env.A11Y_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY,
          model: merged.model ?? process.env.A11Y_AI_MODEL ?? undefined,
        },
        parallelism: 3,
      });

      const result =
        resolvedTarget.kind === 'file' ? await auditor.auditHTML(htmlOrUrl) : await auditor.auditURL(htmlOrUrl);

      spinner?.succeed(`Audit complete. Score: ${result.summary.score}`);

      const reporter = new ReportGenerator();
      const format = (merged.format ?? 'console').toLowerCase();
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

      const threshold = merged.threshold ?? 70;
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

function resolveTarget(target: string, cwd: string): { kind: 'url'; url: string } | { kind: 'file'; path: string } {
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

