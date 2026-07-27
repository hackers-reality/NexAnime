export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-base)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        width: 44,
        height: 44,
        marginBottom: 20,
        borderRadius: '50%',
        border: '3px solid var(--primary-muted)',
        borderTopColor: 'var(--primary)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{
        fontSize: '0.95rem',
        color: 'var(--text-secondary)',
        fontWeight: 500,
      }}>Loading watchlist...</p>
    </div>
  );
}
