/**
 * Safe Exam Browser (SEB) Client-Side JavaScript API & Utilities
 * Provides browser-safe key extraction, header generation, protocol URI conversion,
 * hex color validation, theme preset definitions, and client-side password hashing.
 */

export interface SebClientKeys {
  isSeb: boolean;
  configKey: string | null;
  browserExamKey: string | null;
}

export interface BuildSebHeadersOptions {
  configKey?: string | null;
  browserExamKey?: string | null;
  launchToken?: string | null;
  additionalHeaders?: Record<string, string>;
}

declare global {
  interface Window {
    SafeExamBrowser?: {
      security?: {
        browserExamKey?: string;
        configKey?: string;
        appVersion?: string;
        updateKeys?: (callback?: () => void) => void | Promise<void>;
      };
      version?: string;
    };
  }
}

/**
 * Theme preset definitions matching system specifications
 */
export const THEME_PRESETS = [
  { id: 'cortex-dark', name: 'Cortex Dark', accent: '#FF9100', bg: '#08080a', cardBg: '#101116', border: '#242732', text: '#ffffff' },
  { id: 'slate-dark', name: 'Slate Dark', accent: '#0ea5e9', bg: '#0f172a', cardBg: '#1e293b', border: '#334155', text: '#f8fafc' },
  { id: 'midnight-blue', name: 'Midnight Blue', accent: '#6366f1', bg: '#090d16', cardBg: '#131b2e', border: '#1e2942', text: '#e2e8f0' },
  { id: 'classic-light', name: 'Classic Light', accent: '#2563eb', bg: '#f8fafc', cardBg: '#ffffff', border: '#e2e8f0', text: '#0f172a' },
] as const;

export type ThemePresetId = 'cortex-dark' | 'slate-dark' | 'midnight-blue' | 'classic-light';

export const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Validates a color string against the strict hex color regex (^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$).
 */
export function validateHexColor(color: string): boolean {
  if (typeof color !== 'string') return false;
  return HEX_COLOR_REGEX.test(color.trim());
}

/**
 * Converts an HTTP/HTTPS configuration URL to a Safe Exam Browser protocol URI (seb:// or sebs://).
 * Supports relative and absolute URLs.
 */
export function getSebProtocolUri(configUrl: string): string {
  if (!configUrl) return '';
  const trimmed = configUrl.trim();

  if (trimmed.startsWith('sebs://') || trimmed.startsWith('seb://')) {
    return trimmed;
  }

  if (trimmed.startsWith('https://')) {
    return 'sebs://' + trimmed.slice(8);
  }

  if (trimmed.startsWith('http://')) {
    return 'seb://' + trimmed.slice(7);
  }

  // Relative URL (e.g. /api/v1/...)
  if (typeof window !== 'undefined' && window.location) {
    const isHttps = window.location.protocol === 'https:';
    const proto = isHttps ? 'sebs://' : 'seb://';
    const cleanPath = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
    return `${proto}${window.location.host}${cleanPath}`;
  }

  // Fallback for SSR
  return 'sebs://' + trimmed.replace(/^\/+/, '');
}

/**
 * Client-side SHA-256 hex hashing helper for quit passwords.
 * Uses Web Crypto API when available in browser, with Node crypto fallback.
 */
export async function hashQuitPassword(password: string): Promise<string> {
  const trimmed = password.trim();
  if (!trimmed) return '';

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const data = new TextEncoder().encode(trimmed);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback below
    }
  }

  // In Node.js / SSR environment or Web Crypto fallback
  try {
    const cryptoMod = await import('crypto');
    return cryptoMod.createHash('sha256').update(trimmed).digest('hex').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Safely extracts Browser Exam Key and Config Key from the SEB JavaScript API.
 * Supports sync, callback, and promise implementations of updateKeys with a safe timeout guard.
 */
export async function getSebClientKeys(timeoutMs = 1000): Promise<SebClientKeys> {
  if (typeof window === 'undefined') {
    return { isSeb: false, configKey: null, browserExamKey: null };
  }

  const seb = window.SafeExamBrowser;
  const isSebUserAgent = typeof navigator !== 'undefined' && /SafeExamBrowser/i.test(navigator.userAgent || '');

  if (!seb || !seb.security) {
    return { isSeb: isSebUserAgent, configKey: null, browserExamKey: null };
  }

  const sec = seb.security;

  if (typeof sec.updateKeys === 'function') {
    try {
      await new Promise<void>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, timeoutMs);

        try {
          const ret = sec.updateKeys!(() => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve();
            }
          });

          if (ret && typeof (ret as any).then === 'function') {
            (ret as Promise<void>)
              .then(() => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  resolve();
                }
              })
              .catch(() => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  resolve();
                }
              });
          }
        } catch {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        }
      });
    } catch {
      // Fall through to read whatever keys exist
    }
  }

  const rawBek = sec.browserExamKey;
  const rawCk = sec.configKey;

  const bek = rawBek && typeof rawBek === 'string' && /^[a-f0-9]{64}$/i.test(rawBek.trim())
    ? rawBek.trim().toLowerCase()
    : null;

  const ck = rawCk && typeof rawCk === 'string' && /^[a-f0-9]{64}$/i.test(rawCk.trim())
    ? rawCk.trim().toLowerCase()
    : null;

  return {
    isSeb: true,
    configKey: ck,
    browserExamKey: bek,
  };
}

/**
 * Builds HTTP headers containing SEB launch token and client keys for API calls.
 */
export function buildSebHeaders(options?: BuildSebHeadersOptions): Record<string, string> {
  const headers: Record<string, string> = {
    ...(options?.additionalHeaders || {}),
  };

  if (options?.launchToken) {
    headers['x-seb-launch-token'] = options.launchToken;
  }

  if (options?.configKey) {
    headers['x-seb-client-config-key'] = options.configKey;
  }

  if (options?.browserExamKey) {
    headers['x-seb-client-browser-exam-key'] = options.browserExamKey;
  }

  return headers;
}
