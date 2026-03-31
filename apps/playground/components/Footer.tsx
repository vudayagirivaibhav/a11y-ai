'use client';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-left">
          <span className="footer-logo">♿ a11y-ai</span>
          <span className="footer-divider">·</span>
          <span className="footer-text">AI-powered accessibility auditing</span>
        </div>

        <div className="footer-right">
          <a
            href="https://github.com/vudayagirivaibhav/a11y-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            GitHub
          </a>
          <span className="footer-divider">·</span>
          <a
            href="https://www.npmjs.com/package/@a11y-ai/core"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            npm
          </a>
          <span className="footer-divider">·</span>
          <span className="footer-text">MIT License</span>
        </div>
      </div>

      <style jsx>{`
        .footer {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(10, 13, 20, 0.5);
        }

        .footer-container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .footer-left,
        .footer-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .footer-logo {
          font-family: ui-monospace, monospace;
          font-weight: 600;
          color: #a0aec0;
        }

        .footer-text {
          color: #718096;
          font-size: 0.9rem;
        }

        .footer-divider {
          color: #4a5568;
        }

        .footer-link {
          color: #a0aec0;
          text-decoration: none;
          font-size: 0.9rem;
          transition: color 150ms ease;
        }

        .footer-link:hover {
          color: #10b981;
        }

        @media (max-width: 640px) {
          .footer-container {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}
