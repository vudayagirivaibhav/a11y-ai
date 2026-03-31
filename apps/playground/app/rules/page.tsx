'use client';

import { useEffect, useState } from 'react';

interface RuleInfo {
  id: string;
  category: string;
  description: string;
  severity: string;
  requiresAI: boolean;
  supportsVision: boolean;
  estimatedCost?: string;
}

const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
  images: { color: '#a855f7', icon: '🖼️' },
  links: { color: '#3b82f6', icon: '🔗' },
  forms: { color: '#22c55e', icon: '📝' },
  structure: { color: '#eab308', icon: '🏗️' },
  contrast: { color: '#f97316', icon: '🎨' },
  aria: { color: '#ec4899', icon: '♿' },
  language: { color: '#06b6d4', icon: '🌐' },
  media: { color: '#ef4444', icon: '🎬' },
  keyboard: { color: '#8b5cf6', icon: '⌨️' },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  critical: { color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.15)' },
  serious: { color: '#fcd34d', bg: 'rgba(245, 158, 11, 0.15)' },
  moderate: { color: '#93c5fd', bg: 'rgba(59, 130, 246, 0.15)' },
  minor: { color: '#86efac', bg: 'rgba(34, 197, 94, 0.15)' },
};

function RuleCard({ rule }: { rule: RuleInfo }) {
  const categoryConfig = CATEGORY_CONFIG[rule.category] || { color: '#718096', icon: '📋' };
  const severityConfig = SEVERITY_CONFIG[rule.severity] || {
    color: '#a0aec0',
    bg: 'rgba(160, 174, 192, 0.15)',
  };

  return (
    <div className="rule-card">
      <div className="rule-header">
        <div className="rule-id-row">
          <span className="category-icon">{categoryConfig.icon}</span>
          <code className="rule-id">{rule.id}</code>
        </div>
        <div className="rule-badges">
          {rule.requiresAI && (
            <span className="badge badge-ai">
              <span className="badge-dot ai" />
              AI
            </span>
          )}
          {rule.supportsVision && (
            <span className="badge badge-vision">
              <span className="badge-dot vision" />
              Vision
            </span>
          )}
        </div>
      </div>

      <p className="rule-description">{rule.description}</p>

      <div className="rule-footer">
        <span
          className="category-tag"
          style={{ borderColor: `${categoryConfig.color}40`, color: categoryConfig.color }}
        >
          {rule.category}
        </span>
        <span
          className="severity-tag"
          style={{ background: severityConfig.bg, color: severityConfig.color }}
        >
          {rule.severity}
        </span>
        {rule.estimatedCost && <span className="cost-tag">~{rule.estimatedCost}</span>}
      </div>

      <style jsx>{`
        .rule-card {
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          transition: all 200ms ease;
        }

        .rule-card:hover {
          border-color: rgba(16, 185, 129, 0.3);
          background: rgba(255, 255, 255, 0.03);
          transform: translateY(-2px);
        }

        .rule-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .rule-id-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .category-icon {
          font-size: 1.25rem;
        }

        .rule-id {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 1rem;
          font-weight: 600;
          color: #10b981;
        }

        .rule-badges {
          display: flex;
          gap: 6px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .badge-ai {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
        }

        .badge-vision {
          background: rgba(139, 92, 246, 0.1);
          color: #a78bfa;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .badge-dot.ai {
          background: #10b981;
        }

        .badge-dot.vision {
          background: #8b5cf6;
        }

        .rule-description {
          margin: 0 0 16px;
          color: #a0aec0;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .rule-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .category-tag {
          padding: 4px 12px;
          border: 1px solid;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 500;
          text-transform: capitalize;
        }

        .severity-tag {
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 500;
          text-transform: capitalize;
        }

        .cost-tag {
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          font-size: 0.75rem;
          color: #718096;
        }
      `}</style>
    </div>
  );
}

export default function RulesPage() {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ai' | 'static'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/rules')
      .then((res) => res.json())
      .then((data) => {
        setRules(data.rules || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const categories = [...new Set(rules.map((r) => r.category))];

  const filteredRules = rules.filter((rule) => {
    if (filter === 'ai' && !rule.requiresAI) return false;
    if (filter === 'static' && rule.requiresAI) return false;
    if (selectedCategory && rule.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rule.id.toLowerCase().includes(query) ||
        rule.description.toLowerCase().includes(query) ||
        rule.category.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const aiCount = rules.filter((r) => r.requiresAI).length;
  const staticCount = rules.filter((r) => !r.requiresAI).length;

  return (
    <div className="rules-page">
      <div className="rules-header">
        <div className="header-content">
          <h1>Rule Explorer</h1>
          <p>
            Discover all {rules.length} accessibility rules available in a11y-ai. Each rule checks
            for specific accessibility issues using static analysis, AI, or both.
          </p>
        </div>

        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">{rules.length}</span>
            <span className="stat-label">Total Rules</span>
          </div>
          <div className="stat">
            <span className="stat-value">{aiCount}</span>
            <span className="stat-label">AI-Powered</span>
          </div>
          <div className="stat">
            <span className="stat-value">{staticCount}</span>
            <span className="stat-label">Static Analysis</span>
          </div>
          <div className="stat">
            <span className="stat-value">{categories.length}</span>
            <span className="stat-label">Categories</span>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-group">
          <div className="filter-tabs">
            <button
              onClick={() => setFilter('all')}
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            >
              All ({rules.length})
            </button>
            <button
              onClick={() => setFilter('ai')}
              className={`filter-tab ${filter === 'ai' ? 'active' : ''}`}
            >
              🤖 AI ({aiCount})
            </button>
            <button
              onClick={() => setFilter('static')}
              className={`filter-tab ${filter === 'static' ? 'active' : ''}`}
            >
              ⚡ Static ({staticCount})
            </button>
          </div>
        </div>

        <div className="category-filters">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`category-chip ${selectedCategory === null ? 'active' : ''}`}
          >
            All Categories
          </button>
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat] || { icon: '📋', color: '#718096' };
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                style={
                  selectedCategory === cat
                    ? { borderColor: config.color, background: `${config.color}15` }
                    : {}
                }
              >
                <span>{config.icon}</span>
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading rules...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔍</span>
          <h3>No rules found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="rules-grid">
          {filteredRules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}

      <style jsx>{`
        .rules-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px 24px 64px;
        }

        .rules-header {
          margin-bottom: 32px;
        }

        .header-content h1 {
          margin: 0 0 12px;
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #f0f4fc 0%, #a0aec0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header-content p {
          margin: 0;
          color: #718096;
          font-size: 1.1rem;
          max-width: 640px;
          line-height: 1.6;
        }

        .stats-row {
          display: flex;
          gap: 24px;
          margin-top: 28px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          padding: 16px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 800;
          color: #10b981;
          line-height: 1;
        }

        .stat-label {
          font-size: 0.85rem;
          color: #718096;
          margin-top: 4px;
        }

        .filters-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
        }

        .search-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 4px 4px 16px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          transition: all 150ms ease;
        }

        .search-wrapper:focus-within {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
        }

        .search-icon {
          font-size: 1rem;
        }

        .search-input {
          flex: 1;
          padding: 12px 0;
          background: transparent;
          border: none;
          color: #f0f4fc;
          font-size: 1rem;
        }

        .search-input:focus {
          outline: none;
        }

        .search-input::placeholder {
          color: #718096;
        }

        .search-clear {
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          border-radius: 8px;
          color: #718096;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .search-clear:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #f0f4fc;
        }

        .filter-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .filter-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }

        .filter-tab {
          padding: 10px 18px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #718096;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .filter-tab:hover {
          color: #a0aec0;
          background: rgba(255, 255, 255, 0.05);
        }

        .filter-tab.active {
          background: #10b981;
          color: white;
          font-weight: 600;
        }

        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .category-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          color: #a0aec0;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 150ms ease;
          text-transform: capitalize;
        }

        .category-chip:hover {
          border-color: rgba(255, 255, 255, 0.2);
          color: #f0f4fc;
        }

        .category-chip.active {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
        }

        .loading-state,
        .error-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          text-align: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #10b981;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-state p,
        .error-state p,
        .empty-state p {
          margin: 16px 0 0;
          color: #718096;
        }

        .error-icon,
        .empty-icon {
          font-size: 3rem;
          margin-bottom: 8px;
        }

        .error-state {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 16px;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 1.25rem;
        }

        .rules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 16px;
        }

        @media (max-width: 768px) {
          .rules-page {
            padding: 24px 16px 48px;
          }

          .header-content h1 {
            font-size: 1.75rem;
          }

          .stats-row {
            flex-wrap: wrap;
            gap: 12px;
          }

          .stat {
            flex: 1;
            min-width: 140px;
            padding: 12px 16px;
          }

          .stat-value {
            font-size: 1.5rem;
          }

          .filter-tabs {
            flex-wrap: wrap;
          }

          .rules-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
