'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

type Preset = 'quick' | 'standard' | 'thorough';

type Violation = {
  selector: string;
  message: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  suggestion?: string;
  category?: string;
  source?: string;
};

type AuditResult = {
  summary?: {
    score?: number;
    grade?: string;
    auditDurationMs?: number;
    bySeverity?: Partial<Record<string, number>>;
  };
  mergedViolations?: Violation[];
};

export default function EditorPage() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>('quick');
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, preset }),
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
  }, [html, preset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!loading) runAudit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, runAudit]);

  useEffect(() => {
    if (iframeRef.current && showPreview) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html, showPreview]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const violations = result?.mergedViolations || [];
  const score = result?.summary?.score ?? 0;

  const getScoreColor = (s: number) => {
    if (s >= 90) return '#22c55e';
    if (s >= 70) return '#eab308';
    if (s >= 50) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="editor-page">
      <div className="editor-header">
        <div className="header-left">
          <h1>HTML Editor</h1>
          <p>Write or paste HTML and run accessibility audits in real-time</p>
        </div>
        <div className="header-actions">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="preset-select"
          >
            <option value="quick">⚡ Quick</option>
            <option value="standard">🤖 Standard</option>
            <option value="thorough">🔬 Thorough</option>
          </select>
          <button onClick={runAudit} disabled={loading} className="run-btn">
            {loading ? (
              <>
                <span className="spinner" />
                Analyzing...
              </>
            ) : (
              <>
                <span>▶</span>
                Run Audit
              </>
            )}
          </button>
          <span className="keyboard-hint">⌘+Enter</span>
        </div>
      </div>

      <div className="editor-workspace">
        <div className="editor-panel">
          <div className="panel-toolbar">
            <div className="toolbar-left">
              <span className="file-icon">📄</span>
              <span className="file-name">index.html</span>
            </div>
            <div className="toolbar-right">
              <button onClick={handleCopy} className="toolbar-btn">
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
              <button onClick={() => setShowPreview(!showPreview)} className="toolbar-btn">
                {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
              </button>
            </div>
          </div>

          <div className={`editor-content ${showPreview ? 'with-preview' : ''}`}>
            <div className="code-section">
              <div className="line-numbers">
                {html.split('\n').map((_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className="code-textarea"
                spellCheck={false}
                aria-label="HTML editor"
              />
            </div>

            {showPreview && (
              <div className="preview-section">
                <div className="preview-header">
                  <span className="preview-dot red" />
                  <span className="preview-dot yellow" />
                  <span className="preview-dot green" />
                  <span className="preview-title">Preview</span>
                </div>
                <iframe
                  ref={iframeRef}
                  title="Live Preview"
                  sandbox="allow-same-origin"
                  className="preview-iframe"
                />
              </div>
            )}
          </div>

          <div className="editor-footer">
            <span>{html.length.toLocaleString()} characters</span>
            <span>{html.split('\n').length} lines</span>
            <span>UTF-8</span>
          </div>
        </div>

        <div className="results-panel">
          <div className="results-header">
            <h2>Results</h2>
            {result && (
              <div className="score-badge" style={{ borderColor: getScoreColor(score) }}>
                <span className="score-value" style={{ color: getScoreColor(score) }}>
                  {score}
                </span>
                <span className="score-grade">{result.summary?.grade ?? '-'}</span>
              </div>
            )}
          </div>

          <div className="results-content">
            {error ? (
              <div className="error-card">
                <span className="error-icon">⚠️</span>
                <div>
                  <strong>Audit Failed</strong>
                  <p>{error}</p>
                </div>
              </div>
            ) : !result ? (
              <div className="empty-results">
                <div className="empty-icon">🔍</div>
                <h3>Ready to audit</h3>
                <p>Click "Run Audit" or press ⌘+Enter to analyze your HTML</p>
              </div>
            ) : violations.length === 0 ? (
              <div className="success-results">
                <div className="success-icon">✅</div>
                <h3>No issues found!</h3>
                <p>Your HTML passed all accessibility checks</p>
                {result.summary?.auditDurationMs && (
                  <span className="duration">Completed in {result.summary.auditDurationMs}ms</span>
                )}
              </div>
            ) : (
              <>
                <div className="results-summary">
                  <span className="issue-count">
                    {violations.length} issue{violations.length !== 1 ? 's' : ''} found
                  </span>
                  {result.summary?.auditDurationMs && (
                    <span className="duration">{result.summary.auditDurationMs}ms</span>
                  )}
                </div>

                <div className="severity-summary">
                  {(['critical', 'serious', 'moderate', 'minor'] as const).map((sev) => {
                    const count = violations.filter((v) => v.severity === sev).length;
                    if (count === 0) return null;
                    return (
                      <span key={sev} className={`severity-chip ${sev}`}>
                        {count} {sev}
                      </span>
                    );
                  })}
                </div>

                <div className="violations-list">
                  {violations.map((v, i) => (
                    <div key={i} className="violation-card">
                      <div className="violation-header">
                        <span className={`severity-badge ${v.severity}`}>{v.severity}</span>
                        {v.source && <span className="source-badge">{v.source}</span>}
                      </div>
                      <p className="violation-message">{v.message}</p>
                      <code className="violation-selector">{v.selector}</code>
                      {v.suggestion && (
                        <div className="violation-suggestion">
                          <span>💡</span>
                          <span>{v.suggestion}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .editor-page {
          max-width: 1600px;
          margin: 0 auto;
          padding: 24px;
          height: calc(100vh - 64px);
          display: flex;
          flex-direction: column;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-left h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .header-left p {
          margin: 4px 0 0;
          color: #718096;
          font-size: 0.95rem;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .preset-select {
          padding: 10px 36px 10px 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f0f4fc;
          font-size: 0.9rem;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23718096' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
        }

        .run-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .run-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .run-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .keyboard-hint {
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 0.8rem;
          color: #718096;
          font-family: ui-monospace, monospace;
        }

        .editor-workspace {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 20px;
          min-height: 0;
        }

        .editor-panel {
          display: flex;
          flex-direction: column;
          background: rgba(15, 20, 28, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
        }

        .panel-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .file-icon {
          font-size: 1rem;
        }

        .file-name {
          font-size: 0.85rem;
          color: #a0aec0;
        }

        .toolbar-right {
          display: flex;
          gap: 8px;
        }

        .toolbar-btn {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #a0aec0;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .toolbar-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f0f4fc;
        }

        .editor-content {
          flex: 1;
          display: grid;
          min-height: 0;
        }

        .editor-content.with-preview {
          grid-template-columns: 1fr 1fr;
        }

        .code-section {
          display: flex;
          overflow: auto;
          background: rgba(0, 0, 0, 0.3);
        }

        .line-numbers {
          display: flex;
          flex-direction: column;
          padding: 16px 0;
          background: rgba(255, 255, 255, 0.02);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          user-select: none;
        }

        .line-numbers span {
          padding: 0 16px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.85rem;
          line-height: 1.6;
          color: #4a5568;
          text-align: right;
        }

        .code-textarea {
          flex: 1;
          padding: 16px;
          background: transparent;
          border: none;
          color: #e2e8f0;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.85rem;
          line-height: 1.6;
          resize: none;
          outline: none;
        }

        .preview-section {
          display: flex;
          flex-direction: column;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          background: white;
        }

        .preview-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #2d3748;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .preview-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .preview-dot.red {
          background: #ef4444;
        }
        .preview-dot.yellow {
          background: #f59e0b;
        }
        .preview-dot.green {
          background: #22c55e;
        }

        .preview-title {
          margin-left: 8px;
          font-size: 0.8rem;
          color: #a0aec0;
        }

        .preview-iframe {
          flex: 1;
          border: none;
          background: white;
        }

        .editor-footer {
          display: flex;
          gap: 20px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.75rem;
          color: #718096;
        }

        .results-panel {
          display: flex;
          flex-direction: column;
          background: rgba(15, 20, 28, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .results-header h2 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .score-badge {
          display: flex;
          align-items: baseline;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 2px solid;
          border-radius: 10px;
        }

        .score-value {
          font-size: 1.5rem;
          font-weight: 800;
          line-height: 1;
        }

        .score-grade {
          font-size: 0.9rem;
          color: #718096;
          font-weight: 600;
        }

        .results-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .error-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
        }

        .error-icon {
          font-size: 1.25rem;
        }

        .error-card strong {
          display: block;
          color: #fca5a5;
          margin-bottom: 4px;
        }

        .error-card p {
          margin: 0;
          color: #a0aec0;
          font-size: 0.9rem;
        }

        .empty-results,
        .success-results {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: 100%;
          padding: 40px 20px;
        }

        .empty-icon,
        .success-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .empty-results h3,
        .success-results h3 {
          margin: 0 0 8px;
          font-size: 1.1rem;
        }

        .empty-results p,
        .success-results p {
          margin: 0;
          color: #718096;
          font-size: 0.9rem;
        }

        .success-results {
          color: #22c55e;
        }

        .duration {
          margin-top: 12px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          font-size: 0.8rem;
          color: #718096;
        }

        .results-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .issue-count {
          font-weight: 600;
          color: #f0f4fc;
        }

        .severity-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }

        .severity-chip {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .severity-chip.critical {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
        }
        .severity-chip.serious {
          background: rgba(245, 158, 11, 0.15);
          color: #fcd34d;
        }
        .severity-chip.moderate {
          background: rgba(59, 130, 246, 0.15);
          color: #93c5fd;
        }
        .severity-chip.minor {
          background: rgba(34, 197, 94, 0.15);
          color: #86efac;
        }

        .violations-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .violation-card {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .violation-header {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        }

        .severity-badge {
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .severity-badge.critical {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
        }
        .severity-badge.serious {
          background: rgba(245, 158, 11, 0.15);
          color: #fcd34d;
        }
        .severity-badge.moderate {
          background: rgba(59, 130, 246, 0.15);
          color: #93c5fd;
        }
        .severity-badge.minor {
          background: rgba(34, 197, 94, 0.15);
          color: #86efac;
        }

        .source-badge {
          padding: 3px 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          font-size: 0.7rem;
          color: #718096;
        }

        .violation-message {
          margin: 0 0 10px;
          font-size: 0.9rem;
          line-height: 1.5;
          color: #e2e8f0;
        }

        .violation-selector {
          display: block;
          padding: 8px 10px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          font-size: 0.75rem;
          color: #10b981;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .violation-suggestion {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 10px;
          padding: 10px;
          background: rgba(16, 185, 129, 0.08);
          border-left: 3px solid #10b981;
          border-radius: 0 6px 6px 0;
          font-size: 0.85rem;
          color: #34d399;
        }

        @media (max-width: 1200px) {
          .editor-workspace {
            grid-template-columns: 1fr;
          }

          .results-panel {
            max-height: 400px;
          }
        }

        @media (max-width: 768px) {
          .editor-page {
            padding: 16px;
            height: auto;
          }

          .editor-header {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions {
            flex-wrap: wrap;
          }

          .keyboard-hint {
            display: none;
          }

          .editor-content.with-preview {
            grid-template-columns: 1fr;
          }

          .preview-section {
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            height: 300px;
          }
        }
      `}</style>
    </div>
  );
}
