'use client';

import { useEffect, useMemo, useState } from 'react';

type Preset = 'quick' | 'standard' | 'thorough';

/**
 * Minimal client-safe view model used by the playground UI.
 *
 * We intentionally avoid importing the full `AuditResult` type from `@a11y-ai/core`
 * in this client component to keep the browser bundle isolated from server-only
 * workspace code paths during Next.js development.
 */
type PlaygroundViolation = {
  selector: string;
  message: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  source?: string;
  category?: string;
  suggestion?: string;
  confidence?: number;
};

type PlaygroundAuditResult = {
  mergedViolations?: PlaygroundViolation[];
  summary?: {
    score?: number;
    grade?: string;
    aiCalls?: number;
    auditDurationMs?: number;
    bySeverity?: Partial<Record<'critical' | 'serious' | 'moderate' | 'minor', number>>;
    categories?: Record<
      string,
      {
        score?: number;
        grade?: string;
        violationCount?: number;
        topIssue?: string;
      }
    >;
  };
  metadata?: {
    rulesExecuted?: string[];
  };
};

type PlaygroundResponse = {
  result?: PlaygroundAuditResult;
  error?: string;
};

type SampleKey = 'marketing' | 'checkout' | 'blog';

const SAMPLE_HTML: Record<SampleKey, string> = {
  marketing: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Spring Launch Event</title>
    <meta name="description" content="Reserve your seat for our spring launch event." />
  </head>
  <body>
    <header>
      <img src="/hero-team.jpg" alt="IMG_4821.JPG" width="980" height="420" />
      <h1>Spring Launch Event</h1>
      <p>Join our team for product demos, customer stories, and roadmap updates.</p>
      <a href="/register">Click here</a>
      <a href="/agenda">Read more</a>
      <a href="/speakers">Read more</a>
    </header>

    <main>
      <section>
        <h3>Why attend</h3>
        <p>Learn about our newest features and upcoming improvements.</p>
      </section>
      <section>
        <form>
          <label>Email</label>
          <input type="email" name="email" />
          <button>Submit</button>
        </form>
      </section>
    </main>
  </body>
</html>`,
  checkout: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Checkout</title>
  </head>
  <body>
    <main>
      <h1>Checkout</h1>
      <form>
        <label>Address</label>
        <input id="address-line-1" name="address1" />

        <label>Address</label>
        <input id="address-line-2" name="address2" />

        <input type="text" placeholder="ZIP code" />

        <div onclick="submitForm()">Pay now</div>
      </form>

      <a href="/help">here</a>
    </main>
  </body>
</html>`,
  blog: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Productivity tips for distributed teams</title>
  </head>
  <body>
    <div style="background:url('/beach.jpg'); padding: 24px;">
      <h1 style="color:#fff;">Remote Work Tips</h1>
    </div>

    <p>
      This article delivers operational productivity enablement methodologies for cross-functional
      collaboration optimization in asynchronous environments.
    </p>

    <video autoplay>
      <source src="/demo.mp4" type="video/mp4" />
    </video>
  </body>
</html>`,
};

const SAMPLE_DESCRIPTIONS: Record<SampleKey, string> = {
  marketing: 'Landing page with weak alt text, vague links, and heading/form issues.',
  checkout: 'Checkout form with ambiguous labels and keyboard accessibility problems.',
  blog: 'Article page with contrast, readability, missing lang, and media issues.',
};

function formatConfidence(value?: number): string {
  if (typeof value !== 'number') return '-';
  return `${Math.round(value * 100)}%`;
}

function scoreTone(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 85) return 'good';
  if (score >= 70) return 'warn';
  return 'bad';
}

export function PlaygroundClient() {
  const [html, setHtml] = useState<string>(SAMPLE_HTML.marketing);
  const [preset, setPreset] = useState<Preset>('quick');
  const [selectedSample, setSelectedSample] = useState<SampleKey>('marketing');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PlaygroundAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastAction, setLastAction] = useState<string>('none');

  useEffect((): void => {
    setIsHydrated(true);
  }, []);

  const mergedViolations = useMemo<PlaygroundViolation[]>(() => {
    if (!result || !Array.isArray(result.mergedViolations)) return [];
    return result.mergedViolations.filter(
      (item): item is PlaygroundViolation =>
        Boolean(item) && typeof item.selector === 'string' && typeof item.message === 'string',
    );
  }, [result]);

  const groupedViolations = useMemo(() => {
    if (mergedViolations.length === 0) {
      return [] as Array<{ category: string; items: PlaygroundViolation[] }>;
    }

    const map = new Map<string, PlaygroundViolation[]>();
    for (const item of mergedViolations) {
      const key = item.category ?? 'uncategorized';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [mergedViolations]);

  const topViolations = mergedViolations.slice(0, 8);
  const score = result?.summary?.score ?? 0;
  const severityCounts = {
    critical: result?.summary?.bySeverity?.critical ?? 0,
    serious: result?.summary?.bySeverity?.serious ?? 0,
    moderate: result?.summary?.bySeverity?.moderate ?? 0,
    minor: result?.summary?.bySeverity?.minor ?? 0,
  } as const;
  const categorySummaries = result?.summary?.categories ?? {};
  const rulesExecutedCount = result?.metadata?.rulesExecuted?.length ?? 0;

  async function runAudit(): Promise<void> {
    setLastAction('run-audit');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html, preset }),
      });
      const raw = await response.text();
      let data: PlaygroundResponse;
      try {
        data = JSON.parse(raw) as PlaygroundResponse;
      } catch {
        setResult(null);
        setError(`Unexpected API response (${response.status}).`);
        return;
      }

      if (!response.ok || !data.result) {
        setResult(null);
        setError(data.error ?? `Request failed (${response.status})`);
        return;
      }

      setResult(data.result);
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }

  function loadSample(sample: SampleKey): void {
    setLastAction(`sample:${sample}`);
    setSelectedSample(sample);
    setHtml(SAMPLE_HTML[sample]);
    setError(null);
    setResult(null);
  }

  return (
    <main className="playground-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">a11y-ai playground</p>
          <h1>Test accessibility issues with a UI that makes sense</h1>
          <p className="hero-copy">
            Paste HTML, choose an audit preset, and inspect results as a product team would: score,
            severity breakdown, grouped issues, and actionable fixes.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={runAudit} disabled={isLoading} type="button">
              {isLoading ? 'Running audit...' : 'Run audit'}
            </button>
            <select
              className="preset-select"
              value={preset}
              onChange={(event) => setPreset(event.target.value as Preset)}
              aria-label="Audit preset"
            >
              <option value="quick">quick (static only)</option>
              <option value="standard">standard (AI-enabled rules)</option>
              <option value="thorough">thorough (vision enabled where supported)</option>
            </select>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-card-label">What this demo does</p>
          <ul>
            <li>Runs the real audit pipeline in `@a11y-ai/core`</li>
            <li>Uses a local demo AI handler (no API key required)</li>
            <li>Lets you test rule behavior before wiring CLI/CI</li>
          </ul>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel input-panel">
          <div className="panel-header">
            <div>
              <h2>Input HTML</h2>
              <p>Paste a page fragment or full HTML document.</p>
            </div>
            <div className={isHydrated ? 'client-status ready' : 'client-status'}>
              {isHydrated ? 'JS ready' : 'Waiting for JS'}
            </div>
          </div>

          <div className="samples">
            {(Object.keys(SAMPLE_HTML) as SampleKey[]).map((sample) => (
              <button
                key={sample}
                className={sample === selectedSample ? 'sample-chip active' : 'sample-chip'}
                onClick={() => loadSample(sample)}
                type="button"
                title={SAMPLE_DESCRIPTIONS[sample]}
              >
                {sample}
              </button>
            ))}
          </div>
          <p className="sample-description">{SAMPLE_DESCRIPTIONS[selectedSample]}</p>

          <textarea
            className="editor"
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            spellCheck={false}
            aria-label="HTML input"
          />

          <div className="input-footer">
            <span>{html.length.toLocaleString()} chars</span>
            <span>Preset: {preset}</span>
            <span>Last action: {lastAction}</span>
          </div>
        </div>

        <div className="panel results-panel">
          <div className="panel-header">
            <div>
              <h2>Audit results</h2>
              <p>Visual summary of the current run.</p>
            </div>
            {result ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = 'a11y-ai-playground-report.json';
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download JSON
              </button>
            ) : null}
          </div>

          {error ? <div className="error-banner">{error}</div> : null}

          {!result && !error ? (
            <div className="empty-state">
              <h3>Run an audit to see a report</h3>
              <p>
                Start with one of the samples, then inspect the score, grouped violations, and
                suggestions.
              </p>
            </div>
          ) : null}

          {result ? (
            <>
              <div className="score-grid">
                <div className={`score-card tone-${scoreTone(score)}`}>
                  <p className="muted-label">Accessibility score</p>
                  <div className="score-row">
                    <div className="score-number">{result.summary?.score ?? 0}</div>
                    <div className="score-grade">{result.summary?.grade ?? '-'}</div>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <div
                      className="progress-fill"
                      style={{ width: `${result.summary?.score ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="metric-card">
                  <p className="muted-label">Violations</p>
                  <p className="metric-value">{mergedViolations.length}</p>
                  <p className="metric-meta">Merged axe-core + rule findings</p>
                </div>

                <div className="metric-card">
                  <p className="muted-label">AI calls</p>
                  <p className="metric-value">{result.summary?.aiCalls ?? 0}</p>
                  <p className="metric-meta">Preset-dependent; cached when enabled</p>
                </div>

                <div className="metric-card">
                  <p className="muted-label">Duration</p>
                  <p className="metric-value">{result.summary?.auditDurationMs ?? 0}ms</p>
                  <p className="metric-meta">{rulesExecutedCount} rules executed</p>
                </div>
              </div>

              <div className="severity-panel">
                <h3>Severity breakdown</h3>
                <div className="severity-bars">
                  {(['critical', 'serious', 'moderate', 'minor'] as const).map((level) => {
                    const count = severityCounts[level];
                    const max = Math.max(
                      1,
                      ...Object.values(severityCounts).map((value) => Number(value)),
                    );
                    const width = (count / max) * 100;
                    return (
                      <div key={level} className="severity-row">
                        <span className={`severity-pill ${level}`}>{level}</span>
                        <div className="severity-track">
                          <div className="severity-fill" style={{ width: `${width}%` }} />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="split-panels">
                <section className="sub-panel">
                  <h3>Top issues</h3>
                  <div className="issue-list">
                    {topViolations.length === 0 ? (
                      <p className="muted-note">No violations found in this run.</p>
                    ) : (
                      topViolations.map((violation, index) => (
                        <article key={`${violation.selector}-${index}`} className="issue-item">
                          <div className="issue-head">
                            <span className={`severity-pill ${violation.severity}`}>
                              {violation.severity}
                            </span>
                            <span className="issue-source">{violation.source}</span>
                          </div>
                          <p className="issue-message">{violation.message}</p>
                          <p className="issue-meta">
                            <code>{violation.selector}</code>
                          </p>
                          {violation.suggestion ? (
                            <p className="issue-suggestion">{violation.suggestion}</p>
                          ) : null}
                          <div className="issue-foot">
                            <span>{violation.category ?? 'uncategorized'}</span>
                            <span>confidence: {formatConfidence(violation.confidence)}</span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="sub-panel">
                  <h3>Categories</h3>
                  <div className="category-list">
                    {Object.entries(categorySummaries).map(([category, summary]) => (
                      <article key={category} className="category-item">
                        <div className="category-header">
                          <h4>{category}</h4>
                          <span>
                            {summary.score ?? 0} ({summary.grade ?? '-'})
                          </span>
                        </div>
                        <div className="progress-track small" aria-hidden="true">
                          <div
                            className="progress-fill"
                            style={{ width: `${summary.score ?? 0}%` }}
                          />
                        </div>
                        <p className="category-meta">{summary.violationCount ?? 0} violations</p>
                        <p className="category-top-issue">
                          {summary.topIssue ?? 'No issues summary available.'}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grouped-results">
                <h3>Grouped violations</h3>
                {groupedViolations.map((group) => (
                  <details key={group.category} className="group-card" open>
                    <summary>
                      <span>{group.category}</span>
                      <span>{group.items.length} issues</span>
                    </summary>
                    <div className="group-card-body">
                      {group.items.map((item, index) => (
                        <div key={`${item.selector}-${index}`} className="group-row">
                          <div className="group-row-main">
                            <span className={`severity-pill ${item.severity}`}>
                              {item.severity}
                            </span>
                            <p>{item.message}</p>
                          </div>
                          <code>{item.selector}</code>
                          {item.suggestion ? (
                            <p className="group-suggestion">{item.suggestion}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
