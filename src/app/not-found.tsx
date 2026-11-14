export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#05050a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>404</h1>
      <p style={{ color: '#94a3b8' }}>Page not found.</p>
      <a
        href="/"
        style={{ color: '#ff9100', textDecoration: 'underline', marginTop: '0.5rem' }}
      >
        Return to home
      </a>
    </div>
  );
}
