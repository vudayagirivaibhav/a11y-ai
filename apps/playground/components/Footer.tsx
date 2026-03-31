export function Footer() {
  return (
    <footer className="border-t border-white/10 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-accent">a11y-ai</span>
            <span>— AI-powered accessibility auditing</span>
          </div>

          <div className="flex items-center gap-4">
            <span>Open source</span>
            <span className="text-slate-600">·</span>
            <span>MIT License</span>
            <span className="text-slate-600">·</span>
            <a
              href="https://github.com/vudayagirivaibhav/a11y-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
