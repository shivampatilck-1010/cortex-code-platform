'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

export interface CloudflareTurnstileRef {
  reset: () => void;
}

interface CloudflareTurnstileProps {
  siteKey?: string;
  onSuccess: (token: string) => void;
  onError?: (err: string) => void;
  onExpire?: () => void;
  className?: string;
}

// Real Cloudflare Turnstile Sitekey for cortex-code-platform.cortexbuild1.workers.dev
export const CLOUDFLARE_PRODUCTION_SITE_KEY = '0x4AAAAAAGF-NJJkbzT1RhYe';
export const CLOUDFLARE_TEST_SITE_KEY = CLOUDFLARE_PRODUCTION_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: 'dark' | 'light' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          callback?: (token: string) => void;
          'error-callback'?: (err: any) => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export const CloudflareTurnstile = forwardRef<CloudflareTurnstileRef, CloudflareTurnstileProps>(
  ({ siteKey, onSuccess, onError, onExpire, className = '' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'verified' | 'error'>('loading');

    const effectiveSiteKey =
      siteKey ||
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      CLOUDFLARE_TEST_SITE_KEY;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.reset(widgetIdRef.current);
            setStatus('ready');
          } catch (e) {
            console.warn('[Turnstile] Reset failed:', e);
          }
        }
      },
    }));

    useEffect(() => {
      let isMounted = true;

      const initTurnstile = () => {
        if (!containerRef.current || !window.turnstile) return;

        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: effectiveSiteKey,
            theme: 'dark',
            size: 'normal',
            callback: (token: string) => {
              if (isMounted) {
                setStatus('verified');
                onSuccess(token);
              }
            },
            'error-callback': (err: any) => {
              if (isMounted) {
                setStatus('error');
                if (onError) onError(String(err || 'Verification challenge failed'));
              }
            },
            'expired-callback': () => {
              if (isMounted) {
                setStatus('ready');
                if (onExpire) onExpire();
              }
            },
          });

          widgetIdRef.current = id;
          if (isMounted) setStatus('ready');
        } catch (e: any) {
          console.error('[Turnstile] Render error:', e);
          if (isMounted) setStatus('error');
        }
      };

      if (typeof window === 'undefined') return;

      if (window.turnstile) {
        initTurnstile();
      } else {
        const existingScript = document.querySelector('script[src*="turnstile/v0/api.js"]');
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            initTurnstile();
          };
          script.onerror = () => {
            if (isMounted) setStatus('error');
          };
          document.head.appendChild(script);
        } else {
          const checkInterval = setInterval(() => {
            if (window.turnstile) {
              clearInterval(checkInterval);
              initTurnstile();
            }
          }, 100);
          return () => clearInterval(checkInterval);
        }
      }

      return () => {
        isMounted = false;
        if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
      };
    }, [effectiveSiteKey, onSuccess, onError, onExpire]);

    return (
      <div className={`p-3 rounded-xl bg-[#0f1015] border border-[#242732] flex flex-col items-center justify-center space-y-2 text-center ${className}`}>
        {/* Verification Status Header */}
        <div className="flex items-center justify-between w-full px-1 text-[11px] font-medium text-gray-400">
          <div className="flex items-center gap-1.5">
            {status === 'loading' && <Loader2 className="w-3.5 h-3.5 text-[#FF9100] animate-spin" />}
            {status === 'ready' && <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />}
            {status === 'verified' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
            {status === 'error' && <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}
            <span className={status === 'verified' ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
              {status === 'verified' ? 'Verified' : 'Verification'}
            </span>
          </div>

          <span className="text-[10px] text-gray-500 font-mono">
            {status === 'verified' ? 'Protected' : 'Secure'}
          </span>
        </div>

        {/* Turnstile Mounted Widget Container */}
        <div className="min-h-[65px] flex items-center justify-center w-full">
          <div ref={containerRef} className="cf-turnstile-wrapper" />
        </div>

        {status === 'error' && (
          <p className="text-[11px] text-rose-400">
            Verification check failed. Please refresh the page or try again.
          </p>
        )}
      </div>
    );
  }
);

CloudflareTurnstile.displayName = 'CloudflareTurnstile';
