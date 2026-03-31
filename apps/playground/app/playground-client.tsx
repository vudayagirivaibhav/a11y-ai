'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Preset = 'quick' | 'standard' | 'thorough';
type InputMode = 'html' | 'url';

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

type StreamEvent = {
  type: 'start' | 'axe:complete' | 'rule:start' | 'rule:complete' | 'complete' | 'error';
  data: Record<string, unknown>;
};

type SampleKey = 'marketing' | 'checkout' | 'blog' | 'dashboard';

const SAMPLE_HTML: Record<SampleKey, string> = {
  marketing: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Spring Launch Event</title>
  <meta name="description" content="Reserve your seat for our spring launch event.">
</head>
<body>
  <header>
    <img src="/hero-team.jpg" alt="IMG_4821.JPG" width="980" height="420">
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
        <input type="email" name="email">
        <button>Submit</button>
      </form>
    </section>
  </main>
</body>
</html>`,
  checkout: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Checkout</title>
</head>
<body>
  <main>
    <h1>Checkout</h1>
    <form>
      <label>Address</label>
      <input id="address-line-1" name="address1">

      <label>Address</label>
      <input id="address-line-2" name="address2">

      <input type="text" placeholder="ZIP code">

      <div onclick="submitForm()" style="cursor:pointer; padding:10px; background:#007bff; color:white;">
        Pay now
      </div>
    </form>

    <a href="/help">here</a>
  </main>
</body>
</html>`,
  blog: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Productivity tips for distributed teams</title>
</head>
<body>
  <div style="background:url('/beach.jpg'); padding: 24px;">
    <h1 style="color:#fff;">Remote Work Tips</h1>
  </div>

  <p>
    This article delivers operational productivity enablement methodologies 
    for cross-functional collaboration optimization in asynchronous environments.
  </p>

  <video autoplay>
    <source src="/demo.mp4" type="video/mp4">
  </video>
</body>
</html>`,
  dashboard: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Analytics Dashboard</title>
</head>
<body>
  <nav role="navigation">
    <ul>
      <li><a href="#"><img src="/icon-home.svg"></a></li>
      <li><a href="#">Dashboard</a></li>
      <li><a href="#">Reports</a></li>
    </ul>
  </nav>

  <main>
    <h1>Welcome back</h1>
    
    <div class="chart" role="img">
      <!-- Chart rendered by JS -->
    </div>

    <table>
      <tr><td>Revenue</td><td>$50,000</td></tr>
      <tr><td>Users</td><td>1,234</td></tr>
    </table>

    <button onclick="exportData()">
      <img src="/download.svg"> Export
    </button>
  </main>
</body>
</html>`,
};

const SAMPLE_META: Record<SampleKey, { title: string; description: string; icon: string }> = {
  marketing: {
    title: 'Marketing Page',
    description: 'Weak alt text, vague links, heading hierarchy issues',
    icon: '📢',
  },
  checkout: {
    title: 'Checkout Form',
    description: 'Ambiguous labels, keyboard traps, missing ARIA',
    icon: '🛒',
  },
  blog: {
    title: 'Blog Article',
    description: 'Contrast issues, missing lang, media without captions',
    icon: '📝',
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Missing alt text, table headers, chart accessibility',
    icon: '📊',
  },
};

const EXAMPLE_URLS = [
  { label: 'Example.com', url: 'https://example.com', icon: '🌐' },
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Web_accessibility', icon: '📚' },
  { label: 'MDN Web Docs', url: 'https://developer.mozilla.org', icon: '🔧' },
];

function formatConfidence(value?: number): string {
  if (typeof value !== 'number') return '-';
  return `${Math.round(value * 100)}%`;
}

function scoreTone(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 85) return 'good';
  if (score >= 70) return 'warn';
  return 'bad';
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 70) return 'text-yellow-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
}

function AnimatedScore({ score, grade }: { score: number; grade: string }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [score]);

  return (
    <div className="score-display">
      <div className={`score-number ${getScoreColor(score)}`}>{displayScore}</div>
      <div className="score-grade">{grade}</div>
    </div>
  );
}

function ProgressIndicator({ events, isComplete }: { events: StreamEvent[]; isComplete: boolean }) {
  const stages = [
    { key: 'start', label: 'Starting audit', icon: '🚀' },
    { key: 'axe:complete', label: 'Static analysis', icon: '🔍' },
    { key: 'rule:start', label: 'AI rules', icon: '🤖' },
    { key: 'complete', label: 'Complete', icon: '✅' },
  ];

  const completedStages = new Set(events.map((e) => e.type));
  const currentRules = events
    .filter((e) => e.type === 'rule:start')
    .map((e) => e.data.ruleId as string);

  return (
    <div className="progress-indicator">
      <div className="progress-stages">
        {stages.map((stage, i) => {
          const isCompleted = completedStages.has(stage.key as StreamEvent['type']) || isComplete;
          const isCurrent =
            !isComplete &&
            completedStages.has(stages[Math.max(0, i - 1)]?.key as StreamEvent['type']) &&
            !completedStages.has(stage.key as StreamEvent['type']);

          return (
            <div
              key={stage.key}
              className={`progress-stage ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <span className="stage-icon">{stage.icon}</span>
              <span className="stage-label">{stage.label}</span>
              {isCurrent && <span className="stage-spinner" />}
            </div>
          );
        })}
      </div>
      {currentRules.length > 0 && !isComplete && (
        <div className="current-rule">
          Running: <code>{currentRules[currentRules.length - 1]}</code>
        </div>
      )}
    </div>
  );
}

function LivePreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html]);

  return (
    <div className="live-preview">
      <div className="preview-header">
        <span className="preview-dot red" />
        <span className="preview-dot yellow" />
        <span className="preview-dot green" />
        <span className="preview-title">Live Preview</span>
      </div>
      <iframe
        ref={iframeRef}
        title="Live HTML Preview"
        sandbox="allow-same-origin"
        className="preview-frame"
      />
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" onClick={handleCopy} className="copy-btn" title="Copy to clipboard">
      {copied ? '✓' : '📋'} {label}
    </button>
  );
}

export function PlaygroundClient() {
  const [inputMode, setInputMode] = useState<InputMode>('html');
  const [html, setHtml] = useState<string>(SAMPLE_HTML.marketing);
  const [url, setUrl] = useState<string>('');
  const [preset, setPreset] = useState<Preset>('quick');
  const [selectedSample, setSelectedSample] = useState<SampleKey>('marketing');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PlaygroundAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'categories' | 'all'>('issues');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mergedViolations = useMemo<PlaygroundViolation[]>(() => {
    if (!result || !Array.isArray(result.mergedViolations)) return [];
    return result.mergedViolations.filter(
      (item): item is PlaygroundViolation =>
        Boolean(item) && typeof item.selector === 'string' && typeof item.message === 'string',
    );
  }, [result]);

  const groupedViolations = useMemo(() => {
    if (mergedViolations.length === 0) return [];
    const map = new Map<string, PlaygroundViolation[]>();
    for (const item of mergedViolations) {
      const key = item.category ?? 'uncategorized';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [mergedViolations]);

  const runAudit = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setStreamEvents([]);
    setResult(null);

    try {
      const body = inputMode === 'url' ? { url, preset } : { html, preset };
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as PlaygroundResponse;

      if (!response.ok || !data.result) {
        setError(data.error ?? `Request failed (${response.status})`);
        return;
      }

      setStreamEvents([{ type: 'complete', data: {} }]);
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, [inputMode, url, html, preset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading) runAudit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, runAudit]);

  const loadSample = (sample: SampleKey) => {
    setSelectedSample(sample);
    setHtml(SAMPLE_HTML[sample]);
    setError(null);
    setResult(null);
  };

  const score = result?.summary?.score ?? 0;
  const severityCounts = {
    critical: result?.summary?.bySeverity?.critical ?? 0,
    serious: result?.summary?.bySeverity?.serious ?? 0,
    moderate: result?.summary?.bySeverity?.moderate ?? 0,
    minor: result?.summary?.bySeverity?.minor ?? 0,
  };

  return (
    <div className="playground-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon">✨</span>
            <span>AI-Powered Accessibility Auditing</span>
          </div>
          <h1 className="hero-title">
            Find accessibility issues
            <br />
            <span className="gradient-text">before your users do</span>
          </h1>
          <p className="hero-description">
            Combines axe-core static analysis with AI semantic understanding. Catch issues that
            traditional tools miss.
          </p>

          <div className="hero-actions">
            <button
              className="btn-primary"
              onClick={runAudit}
              disabled={
                isLoading || (inputMode === 'url' && !url) || (inputMode === 'html' && !html)
              }
            >
              {isLoading ? (
                <>
                  <span className="btn-spinner" />
                  Analyzing...
                </>
              ) : (
                <>
                  <span>▶</span>
                  Run Audit
                </>
              )}
            </button>
            <div className="preset-wrapper">
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as Preset)}
                className="preset-select"
              >
                <option value="quick">⚡ Quick (Static only)</option>
                <option value="standard">🤖 Standard (AI-enabled)</option>
                <option value="thorough">🔬 Thorough (Vision AI)</option>
              </select>
            </div>
            <span className="keyboard-hint">⌘+Enter</span>
          </div>
        </div>

        <div className="hero-stats">
          <div className="stat-card">
            <div className="stat-value">9</div>
            <div className="stat-label">AI Rules</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">100+</div>
            <div className="stat-label">axe-core checks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">&lt;5s</div>
            <div className="stat-label">Avg. audit time</div>
          </div>
        </div>
      </section>

      {/* Main Workspace */}
      <section className="workspace">
        {/* Input Panel */}
        <div className="panel input-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Input</h2>
              <div className="mode-toggle">
                <button
                  className={`mode-btn ${inputMode === 'html' ? 'active' : ''}`}
                  onClick={() => setInputMode('html')}
                >
                  📄 HTML
                </button>
                <button
                  className={`mode-btn ${inputMode === 'url' ? 'active' : ''}`}
                  onClick={() => setInputMode('url')}
                >
                  🔗 URL
                </button>
              </div>
            </div>
            {inputMode === 'html' && (
              <button
                className="preview-toggle"
                onClick={() => setShowPreview(!showPreview)}
                title="Toggle live preview"
              >
                {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
              </button>
            )}
          </div>

          {inputMode === 'html' ? (
            <>
              <div className="samples-grid">
                {(Object.keys(SAMPLE_HTML) as SampleKey[]).map((key) => (
                  <button
                    key={key}
                    className={`sample-card ${selectedSample === key ? 'active' : ''}`}
                    onClick={() => loadSample(key)}
                  >
                    <span className="sample-icon">{SAMPLE_META[key].icon}</span>
                    <div className="sample-info">
                      <span className="sample-title">{SAMPLE_META[key].title}</span>
                      <span className="sample-desc">{SAMPLE_META[key].description}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className={`editor-container ${showPreview ? 'with-preview' : ''}`}>
                <div className="editor-wrapper">
                  <div className="editor-header">
                    <span className="editor-lang">HTML</span>
                    <CopyButton text={html} label="Copy" />
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="code-editor"
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    spellCheck={false}
                    placeholder="Paste your HTML here..."
                  />
                  <div className="editor-footer">
                    <span>{html.length.toLocaleString()} characters</span>
                    <span>{html.split('\n').length} lines</span>
                  </div>
                </div>

                {showPreview && <LivePreview html={html} />}
              </div>
            </>
          ) : (
            <div className="url-input-section">
              <div className="url-samples">
                {EXAMPLE_URLS.map((ex) => (
                  <button
                    key={ex.url}
                    className={`url-chip ${url === ex.url ? 'active' : ''}`}
                    onClick={() => setUrl(ex.url)}
                  >
                    <span>{ex.icon}</span>
                    <span>{ex.label}</span>
                  </button>
                ))}
              </div>

              <div className="url-input-wrapper">
                <span className="url-icon">🔗</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="url-input"
                />
                {url && (
                  <button className="url-clear" onClick={() => setUrl('')}>
                    ✕
                  </button>
                )}
              </div>

              <div className="url-info">
                <p>
                  <strong>Note:</strong> Only public URLs are supported. Private networks and
                  localhost are blocked for security.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="panel results-panel">
          <div className="panel-header">
            <h2>Results</h2>
            {result && (
              <button
                className="btn-secondary"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], {
                    type: 'application/json',
                  });
                  const downloadUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = downloadUrl;
                  a.download = 'a11y-audit-report.json';
                  a.click();
                  URL.revokeObjectURL(downloadUrl);
                }}
              >
                📥 Export JSON
              </button>
            )}
          </div>

          {isLoading && <ProgressIndicator events={streamEvents} isComplete={false} />}

          {error && (
            <div className="error-card">
              <span className="error-icon">⚠️</span>
              <div>
                <strong>Audit Failed</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!result && !error && !isLoading && (
            <div className="empty-state">
              <div className="empty-illustration">
                <svg viewBox="0 0 200 200" className="empty-svg">
                  <circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.2"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="60"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <path
                    d="M100 60 L100 100 L130 100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3>Ready to audit</h3>
              <p>
                Select a sample or paste your HTML, then click "Run Audit" to analyze accessibility.
              </p>
            </div>
          )}

          {result && (
            <div className="results-content">
              {/* Score Overview */}
              <div className="score-overview">
                <div className={`score-card-main tone-${scoreTone(score)}`}>
                  <AnimatedScore score={score} grade={result.summary?.grade ?? '-'} />
                  <div className="score-label">Accessibility Score</div>
                  <div className="score-bar">
                    <div className="score-bar-fill" style={{ width: `${score}%` }} />
                  </div>
                </div>

                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-icon">🐛</div>
                    <div className="metric-value">{mergedViolations.length}</div>
                    <div className="metric-label">Issues Found</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-icon">🤖</div>
                    <div className="metric-value">{result.summary?.aiCalls ?? 0}</div>
                    <div className="metric-label">AI Calls</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-icon">⚡</div>
                    <div className="metric-value">{result.summary?.auditDurationMs ?? 0}ms</div>
                    <div className="metric-label">Duration</div>
                  </div>
                </div>
              </div>

              {/* Severity Breakdown */}
              <div className="severity-section">
                <h3>Severity Breakdown</h3>
                <div className="severity-grid">
                  {(['critical', 'serious', 'moderate', 'minor'] as const).map((level) => (
                    <div key={level} className={`severity-card severity-${level}`}>
                      <div className="severity-count">{severityCounts[level]}</div>
                      <div className="severity-label">{level}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results Tabs */}
              <div className="results-tabs">
                <button
                  className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
                  onClick={() => setActiveTab('issues')}
                >
                  Top Issues ({Math.min(mergedViolations.length, 10)})
                </button>
                <button
                  className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
                  onClick={() => setActiveTab('categories')}
                >
                  By Category ({groupedViolations.length})
                </button>
                <button
                  className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  All Issues ({mergedViolations.length})
                </button>
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                {activeTab === 'issues' && (
                  <div className="issues-list">
                    {mergedViolations.slice(0, 10).map((v, i) => (
                      <div key={i} className="issue-card">
                        <div className="issue-header">
                          <span className={`severity-badge ${v.severity}`}>{v.severity}</span>
                          <span className="issue-source">{v.source}</span>
                        </div>
                        <p className="issue-message">{v.message}</p>
                        <code className="issue-selector">{v.selector}</code>
                        {v.suggestion && <p className="issue-suggestion">💡 {v.suggestion}</p>}
                        <div className="issue-footer">
                          <span className="issue-category">{v.category}</span>
                          <span className="issue-confidence">
                            Confidence: {formatConfidence(v.confidence)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'categories' && (
                  <div className="categories-list">
                    {groupedViolations.map((group) => (
                      <details key={group.category} className="category-card" open>
                        <summary>
                          <span className="category-name">{group.category}</span>
                          <span className="category-count">{group.items.length} issues</span>
                        </summary>
                        <div className="category-issues">
                          {group.items.map((item, i) => (
                            <div key={i} className="mini-issue">
                              <span className={`severity-dot ${item.severity}`} />
                              <span className="mini-message">{item.message}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                )}

                {activeTab === 'all' && (
                  <div className="all-issues">
                    {mergedViolations.map((v, i) => (
                      <div key={i} className="compact-issue">
                        <span className={`severity-badge small ${v.severity}`}>
                          {v.severity.charAt(0).toUpperCase()}
                        </span>
                        <span className="compact-message">{v.message}</span>
                        <code className="compact-selector">{v.selector}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
