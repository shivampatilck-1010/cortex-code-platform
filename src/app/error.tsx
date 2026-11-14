'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError] Unhandled page error:', error.message, error.digest);
  }, [error]);

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
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ff4444' }}>
        An unexpected error occurred
      </h1>
      <p style={{ color: '#94a3b8', maxWidth: '480px' }}>
        {error.message || 'The page encountered an error and could not be displayed.'}
      </p>
      {error.digest && (
        <p style={{ fontSize: '0.75rem', color: '#475569' }}>
          Reference: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1.5rem',
          background: '#ff9100',
          color: '#000',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
