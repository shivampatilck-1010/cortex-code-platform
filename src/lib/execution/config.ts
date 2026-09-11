import { ExecutionLimits, ExecutionMode } from './types';

/**
 * Centrally managed execution security configuration and resource limits.
 */

export const EXECUTION_LIMITS: ExecutionLimits = {
  maxCpuTimeSec: 10,
  maxWallTimeSec: 15,
  maxMemoryMb: 256,
  maxProcesses: 30,
  maxFileSizeBytes: 512 * 1024,      // 512 KB per file
  maxProjectSizeBytes: 2 * 1024 * 1024, // 2 MB total project size
  maxFileCount: 20,                  // Max 20 files per project
  maxOutputSizeBytes: 1 * 1024 * 1024,  // 1 MB max stdout/stderr (capped with truncation indicator)
};

export const ALLOWED_LANGUAGES = new Set([
  'python',
  'javascript',
  'typescript',
  'cpp',
  'c',
  'java',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'kotlin',
  'swift',
  'r',
  'dart',
  'sql',
]);

/**
 * Whitelist of environment variables permitted in sandboxed child processes.
 * Absolutely NO application secrets, API keys, or database credentials are ever included.
 */
export const ALLOWED_ENV_VARS = [
  'PATH',
  'PYTHONPATH',
  'LANG',
  'LC_ALL',
  'PYTHONIOENCODING',
  'PYTHONUTF8',
  'NODE_PATH',
  'TZ',
  'TERM',
] as const;

/**
 * Resolves the active execution mode.
 * In production (NODE_ENV === 'production'), unsafe modes (e.g. 'development')
 * are strictly forbidden and automatically fall back to 'cloud'.
 */
export function getExecutionMode(): ExecutionMode {
  const configured = (process.env.EXECUTION_MODE || '').toLowerCase().trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (configured === 'docker') {
    return 'docker';
  }

  if (configured === 'development') {
    if (isProduction) {
      console.error('[Security Alert] Attempted to use "development" execution mode in production environment. Forcing "cloud" mode.');
      return 'cloud';
    }
    return 'development';
  }

  // Default mode for production and edge isolates
  return 'cloud';
}

/**
 * Returns Judge0 configuration settings.
 */
export function getJudge0Config() {
  const apiUrl = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
  const apiKey = process.env.JUDGE0_API_KEY || '';
  const apiHost = process.env.JUDGE0_API_HOST || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    // Support RapidAPI or direct Judge0 token
    if (apiHost) {
      headers['X-RapidAPI-Key'] = apiKey;
      headers['X-RapidAPI-Host'] = apiHost;
    } else {
      headers['X-Auth-Token'] = apiKey;
    }
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    headers,
  };
}

/**
 * Sanitized user-facing error message when execution infrastructure fails,
 * preventing any leakage of host paths, internal IPs, or secrets.
 */
export const SAFE_SYSTEM_ERROR_MESSAGE =
  'Execution service is temporarily unavailable. Please try again in a few moments.';
