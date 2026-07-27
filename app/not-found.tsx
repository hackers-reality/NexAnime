'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content" className="notfound-page">
      <div className="notfound-content">
        <p className="notfound-code" aria-hidden="true">404</p>
        <h1 className="notfound-title">Page Not Found</h1>
        <p className="notfound-description">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="notfound-buttons">
          <Link href="/" className="notfound-button">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: 6 }}
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <Link href="/browse" className="notfound-button notfound-button--outline">
            Browse Anime
          </Link>
        </div>
      </div>

      <style jsx>{`
        .notfound-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: var(--bg-base, #0a0a0f);
          font-family: 'Inter', 'Space Grotesk', system-ui, sans-serif;
        }
        .notfound-content {
          text-align: center;
          padding: 0 24px;
        }
        .notfound-code {
          font-size: 8rem;
          font-weight: 700;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          line-height: 1;
          margin: 0;
          background: linear-gradient(135deg, var(--primary, #3b82f6), var(--accent-purple, #8b5cf6));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .notfound-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary, #f5f5f7);
          margin-top: 16px;
          margin-bottom: 8px;
          font-family: 'Space Grotesk', system-ui, sans-serif;
        }
        .notfound-description {
          font-size: 1rem;
          color: var(--text-secondary, #a1a1aa);
          line-height: 1.6;
          max-width: 420px;
          margin: 0 auto 32px;
        }
        .notfound-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .notfound-button {
          display: inline-flex;
          align-items: center;
          padding: 12px 28px;
          background-color: var(--primary, #3b82f6);
          color: var(--text-primary, #ffffff);
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 500;
          font-family: 'Inter', system-ui, sans-serif;
          text-decoration: none;
          transition: background-color 150ms ease, box-shadow 150ms ease;
        }
        .notfound-button:hover {
          background-color: var(--primary-hover, #2563eb);
        }
        .notfound-button--outline {
          background-color: transparent;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
        }
        .notfound-button--outline:hover {
          background-color: var(--bg-card-hover, rgba(255, 255, 255, 0.05));
        }
      `}</style>
    </main>
  );
}
