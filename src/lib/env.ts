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
