'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const navLinks = [
  { href: '/', label: 'Audit', icon: '🔍' },
  { href: '/editor', label: 'Editor', icon: '✏️' },
  { href: '/rules', label: 'Rules', icon: '📋' },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="theme-toggle" aria-label="Toggle theme">
        <span className="theme-icon-placeholder" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="5" strokeWidth="2" />
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          />
        </svg>
      ) : (
        <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <Link href="/" className="logo">
            <span className="logo-icon">♿</span>
            <span className="logo-text">a11y-ai</span>
            <span className="logo-badge">beta</span>
          </Link>

          <nav className="nav-desktop" aria-label="Main navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="nav-icon">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="header-right">
          <a
            href="https://www.npmjs.com/package/@a11y-ai/core"
            target="_blank"
            rel="noopener noreferrer"
            className="header-link npm-link"
            aria-label="View on npm"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="header-icon">
              <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z" />
            </svg>
          </a>

          <a
            href="https://github.com/vudayagirivaibhav/a11y-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="header-link"
            aria-label="View on GitHub"
          >
            <svg className="header-icon" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
          </a>

          <ThemeToggle />

          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="nav-mobile" aria-label="Mobile navigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-mobile-link ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-icon">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <style jsx>{`
        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(10, 13, 20, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .header-container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: inherit;
        }

        .logo-icon {
          font-size: 1.5rem;
        }

        .logo-text {
          font-family: ui-monospace, monospace;
          font-size: 1.25rem;
          font-weight: 700;
          background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .logo-badge {
          padding: 2px 8px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #34d399;
        }

        .nav-desktop {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          text-decoration: none;
          color: #a0aec0;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 150ms ease;
        }

        .nav-link:hover {
          color: #f0f4fc;
          background: rgba(255, 255, 255, 0.05);
        }

        .nav-link.active {
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        .nav-icon {
          font-size: 1rem;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          color: #a0aec0;
          transition: all 150ms ease;
        }

        .header-link:hover {
          color: #f0f4fc;
          background: rgba(255, 255, 255, 0.05);
        }

        .header-icon {
          width: 20px;
          height: 20px;
        }

        .npm-link .header-icon {
          width: 24px;
          height: 24px;
        }

        :global(.theme-toggle) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: #a0aec0;
          cursor: pointer;
          transition: all 150ms ease;
        }

        :global(.theme-toggle:hover) {
          color: #f0f4fc;
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
        }

        :global(.theme-icon) {
          width: 20px;
          height: 20px;
        }

        :global(.theme-icon-placeholder) {
          width: 20px;
          height: 20px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
        }

        .mobile-menu-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: #a0aec0;
          cursor: pointer;
        }

        .mobile-menu-btn svg {
          width: 20px;
          height: 20px;
        }

        .nav-mobile {
          display: none;
          flex-direction: column;
          padding: 12px 24px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .nav-mobile-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 10px;
          text-decoration: none;
          color: #a0aec0;
          font-size: 1rem;
          font-weight: 500;
          transition: all 150ms ease;
        }

        .nav-mobile-link:hover {
          color: #f0f4fc;
          background: rgba(255, 255, 255, 0.05);
        }

        .nav-mobile-link.active {
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        @media (max-width: 768px) {
          .header-container {
            padding: 0 16px;
          }

          .nav-desktop {
            display: none;
          }

          .mobile-menu-btn {
            display: flex;
          }

          .nav-mobile {
            display: flex;
          }

          .npm-link {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
