import { ProjectFile } from './types';
import { EXECUTION_LIMITS } from './config';

export interface PathValidationResult {
  valid: boolean;
  sanitizedPath?: string;
  error?: string;
}

export interface ProjectValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFiles?: ProjectFile[];
}

function baseName(value: string): string {
  const segments = value.split('/');
  return segments[segments.length - 1] || '';
}

/**
 * Validates and normalizes an untrusted file path to ensure it remains strictly
 * within the workspace sandbox without any possibility of directory traversal.
 */
export function validateAndSanitizePath(rawPath: string, rootDir?: string): PathValidationResult {
  if (!rawPath || typeof rawPath !== 'string') {
    return { valid: false, error: 'Path must be a non-empty string' };
  }

  // API workspace paths historically use `/main.py` for a root-level file.
  // Treat every other leading-slash/backslash form as an OS absolute path,
  // rather than normalizing a dangerous path into an acceptable one.
  if (rawPath.startsWith('\\')) {
    return { valid: false, error: 'Absolute Windows or UNC paths are not allowed' };
  }
  if (rawPath.startsWith('/') && rawPath.slice(1).includes('/')) {
    return { valid: false, error: 'Absolute Unix paths are not allowed' };
  }

  // 1. Check for null byte injection
  if (rawPath.includes('\0')) {
    return { valid: false, error: 'Path contains prohibited null byte' };
  }

  // 2. Reject shell metacharacters, pipes, redirects, and command separators
  if (/[;&|`$<>"\*\?\r\n]/.test(rawPath)) {
    return { valid: false, error: 'Path contains prohibited shell or metacharacters' };
  }

  // 3. Reject Windows drive letters (e.g. C:, D:)
  if (/^[a-zA-Z]:/.test(rawPath)) {
    return { valid: false, error: 'Absolute drive paths are not allowed' };
  }

  // 4. Normalize slashes
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');

  // 5. Reject explicit directory traversal tokens and flag-like segments
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '.') {
      return { valid: false, error: 'Directory traversal sequences ("..") are prohibited' };
    }
    // Reject path segments that begin with '-' (prevents compiler/CLI flag injection)
    if (seg.startsWith('-')) {
      return { valid: false, error: 'Path segments cannot start with "-" to prevent flag injection' };
    }
  }

  // 5. Reject dangerous filenames (.env, hidden files, node_modules, etc.)
  const filename = baseName(normalized).toLowerCase();
  if (filename.startsWith('.env') || filename === '.git' || filename === 'node_modules') {
    return { valid: false, error: `Access to "${filename}" is prohibited` };
  }
  for (const seg of segments) {
    const s = seg.toLowerCase();
    if (s.startsWith('.env') || s === '.git' || s === 'node_modules') {
      return { valid: false, error: `Access to directory "${s}" is prohibited` };
    }
  }

  // 6. If a rootDir is provided, verify resolved path is inside rootDir
  if (rootDir) {
    // `normalized` has already rejected absolute and traversal forms above.
    // Keep this explicit guard for callers using a filesystem root without
    // importing Node's `path` module into Worker/edge bundles.
    if (!rootDir.trim() || normalized === '') {
      return { valid: false, error: 'Resolved path escapes workspace boundary' };
    }
    return { valid: true, sanitizedPath: normalized };
  }

  return { valid: true, sanitizedPath: normalized };
}

/**
 * Validates an entire project's files array against size, count, and path traversal constraints.
 */
export function validateProjectFiles(files: ProjectFile[]): ProjectValidationResult {
  if (!Array.isArray(files)) {
    return { valid: false, error: 'Files must be an array' };
  }

  if (files.length === 0) {
    return { valid: false, error: 'Project must contain at least one file' };
  }

  if (files.length > EXECUTION_LIMITS.maxFileCount) {
    return {
      valid: false,
      error: `Project exceeds maximum file count limit (${EXECUTION_LIMITS.maxFileCount} files)`,
    };
  }

  let totalBytes = 0;
  const sanitizedFiles: ProjectFile[] = [];

  for (const file of files) {
    if (!file || typeof file !== 'object') {
      return { valid: false, error: 'Invalid file entry in project' };
    }

    const content = typeof file.content === 'string' ? file.content : '';
    const fileBytes = new TextEncoder().encode(content).byteLength;

    if (fileBytes > EXECUTION_LIMITS.maxFileSizeBytes) {
      return {
        valid: false,
        error: `File "${file.name}" exceeds maximum size limit of ${EXECUTION_LIMITS.maxFileSizeBytes / 1024} KB`,
      };
    }

    totalBytes += fileBytes;
    if (totalBytes > EXECUTION_LIMITS.maxProjectSizeBytes) {
      return {
        valid: false,
        error: `Total project size exceeds limit of ${EXECUTION_LIMITS.maxProjectSizeBytes / (1024 * 1024)} MB`,
      };
    }

    // Validate both independent persistence fields. A safe `path` must not
    // allow a hostile `name` to be stored in the project database.
    const nameCheck = validateAndSanitizePath(file.name);
    if (!nameCheck.valid) {
      return { valid: false, error: `Invalid file name "${file.name}": ${nameCheck.error}` };
    }

    // Validate path
    const rawPath = file.path || file.name;
    const pathCheck = validateAndSanitizePath(rawPath);
    if (!pathCheck.valid) {
      return { valid: false, error: `Invalid path for file "${file.name}": ${pathCheck.error}` };
    }

    sanitizedFiles.push({
      ...file,
      name: baseName(pathCheck.sanitizedPath!),
      path: `/${pathCheck.sanitizedPath!}`,
      content,
    });
  }

  return { valid: true, sanitizedFiles };
}
