import { validateProjectFiles } from '@/lib/execution/path-sanitizer';
import { ProjectFile } from '@/lib/execution/types';

export const ARENA_MAX_FILE_CONTENT_BYTES = 1024 * 1024;
export const ARENA_MAX_REQUEST_BYTES = 2 * 1024 * 1024;

export type ArenaFilesValidation =
  | { valid: true; files: ProjectFile[] }
  | { valid: false; status: 400 | 413; error: string };

/** Validates files before an Arena route can update its persisted workspace. */
export function validateArenaAutosaveFiles(value: unknown): ArenaFilesValidation {
  if (!Array.isArray(value)) {
    return { valid: false, status: 400, error: 'files must be an array' };
  }

  let totalBytes = 0;
  for (const file of value) {
    if (!file || typeof file !== 'object' || typeof (file as ProjectFile).content !== 'string') {
      return { valid: false, status: 400, error: 'Each file must include string content' };
    }
    totalBytes += new TextEncoder().encode((file as ProjectFile).content).byteLength;
    if (totalBytes > ARENA_MAX_FILE_CONTENT_BYTES) {
      return { valid: false, status: 413, error: 'File content too large (max 1MB total)' };
    }
  }

  const validation = validateProjectFiles(value as ProjectFile[]);
  if (!validation.valid || !validation.sanitizedFiles) {
    return { valid: false, status: 400, error: validation.error || 'Invalid project files' };
  }
  return { valid: true, files: validation.sanitizedFiles };
}
