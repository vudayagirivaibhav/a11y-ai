'use client';

import { useState } from 'react';

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>
  
  <main>
    <h1>Welcome to My Page</h1>
    <img src="/hero.jpg" alt="" />
    
    <section>
      <h2>Contact Us</h2>
      <form>
        <label for="name">Name</label>
        <input type="text" id="name" name="name" />
        
        <label for="email">Email</label>
        <input type="email" id="email" name="email" />
        
        <button type="submit">Send</button>
      </form>
    </section>
  </main>
  
  <footer>
    <p>&copy; 2024 My Company</p>
  </footer>
</body>
</html>`;

type AuditResult = {
  summary?: {
    score?: number;
    grade?: string;
  };
  mergedViolations?: Array<{
    selector: string;
    message: string;
    severity: string;
    suggestion?: string;
  }>;
};

export default function EditorPage() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, preset: 'quick' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Audit failed');
        return;
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  const violations = result?.mergedViolations || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">HTML Editor</h1>
        <p className="text-slate-400">
          Write or paste HTML and run accessibility audits in real-time.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">HTML Input</h2>
            <button
              onClick={runAudit}
              disabled={loading}
              className="px-4 py-2 bg-accent text-slate-900 font-semibold rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Auditing...' : 'Run Audit'}
            </button>
          </div>

          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="w-full h-[600px] bg-slate-900 border border-white/10 rounded-xl p-4 font-mono text-sm text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            spellCheck={false}
            aria-label="HTML editor"
          />

          <div className="flex justify-between text-sm text-slate-500">
            <span>{html.length.toLocaleString()} characters</span>
            <span>{html.split('\n').length} lines</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Results</h2>
            {result && (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{result.summary?.score ?? 0}</span>
                <span className="text-slate-400">{result.summary?.grade ?? '-'}</span>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-xl p-4 h-[600px] overflow-auto">
            {error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                {error}
              </div>
            ) : !result ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <p className="text-lg mb-2">No results yet</p>
                  <p className="text-sm">Click "Run Audit" to analyze your HTML</p>
                </div>
              </div>
            ) : violations.length === 0 ? (
              <div className="flex items-center justify-center h-full text-green-400">
                <div className="text-center">
                  <svg
                    className="w-16 h-16 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-lg">No accessibility issues found!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-400 mb-4">
                  Found {violations.length} issue{violations.length !== 1 ? 's' : ''}
                </p>
                {violations.map((v, i) => (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          v.severity === 'critical'
                            ? 'bg-red-500/20 text-red-300'
                            : v.severity === 'serious'
                              ? 'bg-orange-500/20 text-orange-300'
                              : v.severity === 'moderate'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-green-500/20 text-green-300'
                        }`}
                      >
                        {v.severity}
                      </span>
                    </div>
                    <p className="text-slate-200">{v.message}</p>
                    <code className="block text-xs text-slate-500 truncate">{v.selector}</code>
                    {v.suggestion && <p className="text-sm text-accent">{v.suggestion}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
