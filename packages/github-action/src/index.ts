import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { A11yAuditor, ReportGenerator, toAuditConfig } from '@a11y-ai/core';

import { readInputsFromEnv } from './lib.js';

type ProviderName = 'openai' | 'anthropic' | 'ollama' | 'custom';

async function run(): Promise<void> {
  const inputs = readInputsFromEnv(process.env);

  if (!inputs.url && !inputs.htmlPath) {
    failHard('You must provide either "url" or "html-path" input.');
    return;
  }

  const config = toAuditConfig({
    preset: inputs.preset,
    provider: {
      name: toProviderName(inputs.provider),
      apiKey: inputs.apiKey,
    },
  });

  const auditor = new A11yAuditor(config);
  const result = inputs.htmlPath
    ? await auditor.auditHTML(readFileSync(resolve(inputs.htmlPath), 'utf8'))
    : await auditor.auditURL(inputs.url!);

  const reporter = new ReportGenerator();
  const htmlReport = reporter.generateHTML(result);
  const mdReport = reporter.generateMarkdown(result);
  const jsonReport = reporter.generateJSON(result);
  const sarifReport = reporter.generateSARIF(result);

  const htmlPath = resolve(process.cwd(), 'a11y-ai-report.html');
  const mdPath = resolve(process.cwd(), 'a11y-ai-report.md');
  const jsonPath = resolve(process.cwd(), 'a11y-ai-report.json');
  const sarifPath = resolve(process.cwd(), 'a11y-ai-report.sarif.json');

  writeFileSync(htmlPath, htmlReport, 'utf8');
  writeFileSync(mdPath, mdReport, 'utf8');
  writeFileSync(jsonPath, jsonReport, 'utf8');
  writeFileSync(sarifPath, sarifReport, 'utf8');

  const score = result.summary.score;
  const violationCount = result.mergedViolations.length;

  const thresholdPassed = score >= inputs.threshold;
  const criticalViolations = inputs.failOnViolations
    ? result.mergedViolations.filter((v) => v.severity === 'critical')
    : [];
  const criticalPassed = criticalViolations.length === 0;

  const passed = thresholdPassed && criticalPassed;
  const failReason = !thresholdPassed
    ? `Score ${score} is below threshold ${inputs.threshold}.`
    : !criticalPassed
      ? `Critical violations found: ${criticalViolations.length}.`
      : '';

  setOutput('score', String(score));
  setOutput('violations', String(violationCount));
  setOutput('report-path', htmlPath);
  setOutput('report-md-path', mdPath);
  setOutput('report-json-path', jsonPath);
  setOutput('report-sarif-path', sarifPath);
  setOutput('passed', passed ? 'true' : 'false');
  setOutput('fail-reason', failReason);

  // Also publish a short summary in the job UI (optional).
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const badge = passed ? '✅' : '❌';
    const summary = `${badge} a11y-ai score: **${score}** (violations: **${violationCount}**)\n\nReport: \`${htmlPath}\`\n`;
    writeFileSync(summaryPath, summary, { encoding: 'utf8', flag: 'a' });
  }
}

function setOutput(name: string, value: string): void {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;
  writeFileSync(outPath, `${name}=${escapeOutput(value)}\n`, { encoding: 'utf8', flag: 'a' });
}

function escapeOutput(value: string): string {
  // GitHub outputs are line-based; keep this simple and safe.
  return value.replace(/\r?\n/g, ' ');
}

function failHard(message: string): void {
  setOutput('passed', 'false');
  setOutput('fail-reason', message);
  console.error(message);
}

run().catch((err) => {
  failHard(err instanceof Error ? err.message : 'GitHub Action failed');
});

function toProviderName(value: unknown): ProviderName {
  if (value === 'openai' || value === 'anthropic' || value === 'ollama' || value === 'custom')
    return value;
  return 'custom';
}
