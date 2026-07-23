'use client';

import { useEffect } from 'react';

export default function WatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Watch Error]', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: 32, textAlign: 'center',
    }}>
      <div>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Failed to load episode
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          There was a problem loading this episode. Try refreshing or selecting a different server.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
              background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
              background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)', textDecoration: 'none',
            }}
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
