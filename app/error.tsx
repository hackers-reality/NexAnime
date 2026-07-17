'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.icon}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={styles.title}>Something went wrong</h2>
        <p style={styles.message}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p style={styles.digest}>Error ID: {error.digest}</p>
        )}
        <button onClick={reset} style={styles.button}>
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#0a0a0f',
    fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif",
  },
  content: {
    textAlign: 'center',
    padding: '0 24px',
    maxWidth: 480,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#f5f5f7',
    margin: '0 0 8px',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  message: {
    fontSize: '1rem',
    color: '#a1a1aa',
    lineHeight: 1.6,
    marginBottom: 8,
  },
  digest: {
    fontSize: '0.75rem',
    color: '#71717a',
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 28px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderRadius: 10,
    fontSize: '0.95rem',
    fontWeight: 500,
    fontFamily: "'Inter', system-ui, sans-serif",
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 150ms ease, box-shadow 150ms ease',
  },
};
