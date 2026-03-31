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

const CATEGORY_COLORS: Record<string, string> = {
  images: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  links: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  forms: 'bg-green-500/20 text-green-300 border-green-500/30',
  structure: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  contrast: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  aria: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  language: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  media: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  serious: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  moderate: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  minor: 'bg-green-500/20 text-green-300 border-green-500/30',
};

export default function RulesPage() {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ai' | 'static'>('all');

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

  const filteredRules = rules.filter((rule) => {
    if (filter === 'ai') return rule.requiresAI;
    if (filter === 'static') return !rule.requiresAI;
    return true;
  });

  const categories = [...new Set(rules.map((r) => r.category))];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Rule Explorer</h1>
        <p className="text-slate-400">
          Browse all {rules.length} accessibility rules available in a11y-ai.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-accent text-slate-900'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            All ({rules.length})
          </button>
          <button
            onClick={() => setFilter('ai')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'ai'
                ? 'bg-accent text-slate-900'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            AI-Powered ({rules.filter((r) => r.requiresAI).length})
          </button>
          <button
            onClick={() => setFilter('static')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'static'
                ? 'bg-accent text-slate-900'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Static ({rules.filter((r) => !r.requiresAI).length})
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <span
              key={cat}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                CATEGORY_COLORS[cat] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'
              }`}
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p className="mt-4 text-slate-400">Loading rules...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
          {error}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-accent/30 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold font-mono text-accent">{rule.id}</h2>
                  <p className="text-slate-300 mt-1">{rule.description}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      CATEGORY_COLORS[rule.category] ||
                      'bg-slate-500/20 text-slate-300 border-slate-500/30'
                    }`}
                  >
                    {rule.category}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      SEVERITY_COLORS[rule.severity] ||
                      'bg-slate-500/20 text-slate-300 border-slate-500/30'
                    }`}
                  >
                    {rule.severity}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {rule.requiresAI && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent"></span>
                    <span className="text-slate-400">AI-Powered</span>
                  </div>
                )}
                {rule.supportsVision && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span className="text-slate-400">Vision Support</span>
                  </div>
                )}
                {rule.estimatedCost && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Cost:</span>
                    <span className="text-slate-400">{rule.estimatedCost}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
