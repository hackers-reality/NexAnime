export default function Loading() {
  return (
    <div style={styles.container}>
      <div style={styles.spinner} />
      <p style={styles.text}>Loading NexAnime...</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-base)',
    fontFamily: 'var(--font-sans)',
  },
  spinner: {
    width: 44,
    height: 44,
    marginBottom: 20,
    borderRadius: '50%',
    border: '3px solid var(--primary-muted)',
    borderTopColor: 'var(--primary)',
    animation: 'spin 0.8s linear infinite',
  },
  text: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
};
