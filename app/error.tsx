'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="error-page">
      <div className="error-content">
        <div className="error-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-error, #ef4444)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="error-title">Something went wrong</h2>
        <p className="error-message">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="error-digest">Error ID: {error.digest}</p>
        )}
        <button onClick={reset} className="error-button">
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
            <path d="M21 12a9 9 0 11-6.22-8.56" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          Try Again
        </button>
      </div>

      <style jsx>{`
        .error-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: var(--bg-base, #0a0a0f);
          font-family: 'Inter', 'Space Grotesk', system-ui, sans-serif;
        }
        .error-content {
          text-align: center;
          padding: 0 24px;
          max-width: 480px;
        }
        .error-icon {
          margin-bottom: 24px;
        }
        .error-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary, #f5f5f7);
          margin: 0 0 8px;
          font-family: 'Space Grotesk', system-ui, sans-serif;
        }
        .error-message {
          font-size: 1rem;
          color: var(--text-secondary, #a1a1aa);
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .error-digest {
          font-size: 0.75rem;
          color: var(--text-muted, #71717a);
          margin-bottom: 24px;
          font-family: monospace;
        }
        .error-button {
          display: inline-flex;
          align-items: center;
          padding: 12px 28px;
          background-color: var(--primary, #3b82f6);
          color: var(--text-primary, #ffffff);
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 500;
          font-family: 'Inter', system-ui, sans-serif;
          border: none;
          cursor: pointer;
          transition: background-color 150ms ease, box-shadow 150ms ease;
        }
        .error-button:hover {
          background-color: var(--primary-hover, #2563eb);
        }
      `}</style>
    </main>
  );
}
