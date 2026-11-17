/**
 * Safe Exam Browser Single-Use Launch Token Registry
 * Combines fast in-memory caching with persistent SQLite database backing for atomic replay defense.
 */
import { classroomDb } from './db/index';

export interface ConsumedTokenRecord {
  nonce: string;
  userId: string;
  assessmentId: string;
  consumedAt: number;
  expiresAt: number;
}

// In-memory hot cache for fast replay rejection
const memoryRegistry = new Map<string, ConsumedTokenRecord>();

/**
 * Attempts to atomically consume a single-use token nonce.
 * Rejects duplicate attempts across both in-memory cache and persistent SQLite store.
 * Returns true if the nonce was successfully consumed, false if already consumed or expired.
 */
export async function consumeTokenNonce(
  nonce: string,
  userId: string,
  assessmentId: string,
  expiresAt: number
): Promise<boolean> {
  if (!nonce || typeof nonce !== 'string') return false;

  const now = Date.now();
  if (expiresAt <= now) {
    return false; // Token already expired
  }

  // Check in-memory cache first for immediate rejection of duplicate hits
  const cached = memoryRegistry.get(nonce);
  if (cached) {
    return false; // Replay detected in memory
  }

  // Attempt atomic database insert
  const persisted = await classroomDb.consumeSebToken(nonce, userId, assessmentId, expiresAt);
  if (!persisted) {
    return false; // Replay detected in database (unique constraint failed)
  }

  // Update in-memory cache
  memoryRegistry.set(nonce, {
    nonce,
    userId,
    assessmentId,
    consumedAt: now,
    expiresAt,
  });

  return true;
}

/**
 * Checks whether a token nonce has already been consumed in memory or in the persistent database.
 */
export async function isTokenNonceConsumed(nonce: string): Promise<boolean> {
  if (!nonce || typeof nonce !== 'string') return true;

  if (memoryRegistry.has(nonce)) {
    return true;
  }

  return await classroomDb.isSebTokenConsumed(nonce);
}

/**
 * Purges expired token records from both in-memory cache and persistent database store.
 */
export async function purgeExpiredNonces(now = Date.now()): Promise<{ memoryPurged: number; dbPurged: number }> {
  // Purge expired from memory
  let memoryPurged = 0;
  for (const [nonce, record] of memoryRegistry.entries()) {
    if (record.expiresAt <= now) {
      memoryRegistry.delete(nonce);
      memoryPurged++;
    }
  }

  // Purge expired from DB
  const dbPurged = await classroomDb.cleanupExpiredSebTokens(now);

  return { memoryPurged, dbPurged };
}

/**
 * Resets the in-memory cache. Useful for test isolation.
 */
export function resetTokenRegistry(): void {
  memoryRegistry.clear();
}
