export default function Loading() {
  return (
    <>
      <style>{`@keyframes nex-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.container}>
        <div style={styles.spinner} />
        <p style={styles.text}>Loading NexAnime...</p>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#0a0a0f',
    fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif",
  },
  spinner: {
    width: 44,
    height: 44,
    marginBottom: 20,
    borderRadius: '50%',
    border: '3px solid rgba(59, 130, 246, 0.15)',
    borderTopColor: '#3b82f6',
    animation: 'nex-spin 0.8s linear infinite',
  },
  text: {
    fontSize: '0.95rem',
    color: '#a1a1aa',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
};
