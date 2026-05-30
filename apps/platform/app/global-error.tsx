'use client';

export default function GlobalError({
  _error,
  reset,
}: {
  _error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          backgroundColor: '#F8F9FA',
        }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '16px', color: '#1A1A1A' }}>
            System Error.
          </h2>
          <p style={{ color: '#6B7280', marginBottom: '32px' }}>
            A critical error occurred in the dashboard. Please try refreshing.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '12px 32px',
              backgroundColor: '#1A1A1A',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              borderRadius: '16px',
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
