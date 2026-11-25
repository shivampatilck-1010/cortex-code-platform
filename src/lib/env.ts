import type { Env } from '@/worker';

let _env: Env | undefined;

/**
 * Stores the Cloudflare Worker runtime environment bindings.
 * Automatically synchronizes with globalThis.env for backwards compatibility.
 */
export function setEnv(env: Env): void {
  _env = env;
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).env = env;
  }
}

/**
 * Retrieves the strongly typed Cloudflare Worker environment bindings.
 * Falls back to globalThis.env if setEnv() was not called directly.
 */
export function getEnv(): Env {
  if (_env) {
    return _env;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).env) {
    return (globalThis as any).env as Env;
  }
  throw new Error('Environment not initialized');
}

/**
 * Safely retrieves a runtime environment variable from Cloudflare Worker
 * bindings (_env / globalThis.env) first, falling back to process.env.
 */
export function getRuntimeVar(key: string): string {
  const fromWorkerEnv =
    (_env && typeof (_env as any)[key] === 'string' ? (_env as any)[key] : undefined) ??
    (typeof globalThis !== 'undefined' &&
    (globalThis as any).env &&
    typeof (globalThis as any).env[key] === 'string'
      ? (globalThis as any).env[key]
      : undefined);

  if (typeof fromWorkerEnv === 'string' && fromWorkerEnv.trim().length > 0) {
    return fromWorkerEnv.trim();
  }

  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    return process.env[key]!.trim();
  }

  return '';
}

/**
 * Determines whether the incoming request arrived over HTTPS so cookie
 * Secure flags work accurately across Cloudflare HTTPS and HTTP localhost.
 */
export function isSecureRequest(
  req?: { url?: string; headers?: { get(name: string): string | null } } | null
): boolean {
  if (req?.headers) {
    const forwardedProto = req.headers.get('x-forwarded-proto');
    if (forwardedProto) {
      return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
    }
    const cfVisitor = req.headers.get('cf-visitor');
    if (cfVisitor && cfVisitor.includes('"https"')) {
      return true;
    }
  }
  if (req?.url) {
    if (req.url.startsWith('https://')) return true;
    if (req.url.startsWith('http://')) return false;
  }
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
}

/**
 * Validates and normalizes internal redirect targets to prevent open-redirect
 * vulnerabilities while preserving relative query parameters.
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = '/classroom'
): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    /[\r\n\0]/.test(trimmed)
  ) {
    return fallback;
  }
  return trimmed;
}
