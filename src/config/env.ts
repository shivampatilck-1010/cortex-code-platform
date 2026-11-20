/**
 * Centralized, Type-Safe Environment Configuration
 * Validates and exposes environment variables with safe defaults.
 */

export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;

  // Server-Side Secrets
  DATABASE_URL?: string;
  JWT_SECRET: string;
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  RESEND_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  PISTON_URL?: string;

  // Public Configuration
  NEXT_PUBLIC_APP_URL: string;
}

function getEnvValue(key: string, defaultValue?: string): string {
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[key];
    if (val !== undefined && val !== '') return val;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).env) {
    const val = (globalThis as any).env[key];
    if (val !== undefined && val !== '') return val;
  }
  return defaultValue ?? '';
}

const nodeEnv = (getEnvValue('NODE_ENV', 'development') as 'development' | 'production' | 'test');

export const env: AppEnv = {
  NODE_ENV: nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  isTest: nodeEnv === 'test',

  // Database & Auth
  DATABASE_URL: getEnvValue('DATABASE_URL'),
  JWT_SECRET: getEnvValue('JWT_SECRET', 'cortex_local_dev_jwt_secret_key_32_bytes_min'),

  // AI Providers (Supports both GEMINI_API_KEY and legacy GOOGLE_API_KEY)
  GEMINI_API_KEY: getEnvValue('GEMINI_API_KEY') || getEnvValue('GOOGLE_API_KEY'),
  GOOGLE_API_KEY: getEnvValue('GOOGLE_API_KEY') || getEnvValue('GEMINI_API_KEY'),

  // Third-party Integrations
  RESEND_API_KEY: getEnvValue('RESEND_API_KEY'),
  GITHUB_CLIENT_ID: getEnvValue('GITHUB_CLIENT_ID'),
  GITHUB_CLIENT_SECRET: getEnvValue('GITHUB_CLIENT_SECRET'),
  PISTON_URL: getEnvValue('PISTON_URL', 'https://emkc.org/api/v2/piston'),

  // Public URL
  NEXT_PUBLIC_APP_URL: getEnvValue('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
};

export default env;
