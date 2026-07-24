import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content" style={styles.container}>
      <div style={styles.content}>
        <p style={styles.code} aria-hidden="true">404</p>
        <h1 style={styles.title}>Page Not Found</h1>
        <p style={styles.description}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={styles.button}>
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
          <Link href="/browse" style={{ ...styles.button, backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>
            Browse Anime
          </Link>
        </div>
      </div>
    </main>
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
  },
  code: {
    fontSize: '8rem',
    fontWeight: 700,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    lineHeight: 1,
    margin: 0,
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#f5f5f7',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  description: {
    fontSize: '1rem',
    color: '#a1a1aa',
    lineHeight: 1.6,
    maxWidth: 420,
    margin: '0 auto 32px',
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
    textDecoration: 'none',
    transition: 'background-color 150ms ease, box-shadow 150ms ease',
  },
};
