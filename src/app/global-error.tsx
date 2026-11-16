'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError] Uncaught root layout/hydration error:', error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Cortex — System Recovery</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                margin: 0;
                padding: 0;
                background-color: #08090A;
                color: #F8FAFC;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .recovery-card {
                max-width: 480px;
                margin: 24px;
                padding: 32px;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(18, 20, 24, 0.95);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                text-align: left;
              }
              .logo {
                font-family: monospace;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 0.15em;
                color: #FF9100;
                margin-bottom: 16px;
              }
              .title {
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 12px 0;
                color: #FFFFFF;
              }
              .description {
                font-size: 14px;
                color: #94A3B8;
                line-height: 1.5;
                margin: 0 0 24px 0;
              }
              .button-group {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
              }
              .btn-primary {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 10px 20px;
                border-radius: 8px;
                background: #FF9100;
                color: #000000;
                font-weight: 600;
                font-size: 13px;
                text-decoration: none;
                border: none;
                cursor: pointer;
                transition: opacity 0.15s;
              }
              .btn-primary:hover {
                opacity: 0.9;
              }
              .btn-secondary {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 10px 18px;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.08);
                color: #F8FAFC;
                font-weight: 500;
                font-size: 13px;
                text-decoration: none;
                border: 1px solid rgba(255, 255, 255, 0.15);
                cursor: pointer;
              }
              .btn-secondary:hover {
                background: rgba(255, 255, 255, 0.12);
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="recovery-card">
          <div className="logo">CORTEX // PLATFORM RECOVERY</div>
          <h1 className="title">Session Initialized in Safe Mode</h1>
          <p className="description">
            The platform encountered a client initialization warning and isolated the active view to ensure uninterrupted workflow. All cloud runtimes, assignments, and workspaces remain operational.
          </p>
          <div className="button-group">
            <button className="btn-primary" onClick={() => reset()}>
              Reload View
            </button>
            <a href="/ide" className="btn-secondary">
              Open Cloud IDE
            </a>
            <a href="/classroom" className="btn-secondary">
              Classroom Hub
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
