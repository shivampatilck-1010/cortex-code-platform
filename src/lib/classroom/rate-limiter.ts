/**
 * Cortex Online Examination System — Sliding Window Rate Limiter
 *
 * Implements token bucket and sliding window rate limiting to protect authentication
 * endpoints from credential stuffing, brute-force dictionary attacks, and denial of service.
 * Supports both fast-path isolate-local checks and distributed D1-backed coordination.
 *
 * Strictly zero emojis.
 */

import { classroomDb } from './db';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
}

interface RateLimitRecord {
  timestamps: number[];
  lockoutUntil?: number;
  failedCount?: number;
}

class HybridRateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();
  private lastPruneTime: number = Date.now();
  private pruneIntervalMs: number = 60 * 1000; // Prune every 60 seconds

  /**
   * Prunes entries with empty timestamps or expired lockouts to prevent memory leaks.
   */
  private prune(): void {
    const now = Date.now();
    if (now - this.lastPruneTime < this.pruneIntervalMs) {
      return;
    }
    this.lastPruneTime = now;

    for (const [key, record] of this.store.entries()) {
      const isLocked = record.lockoutUntil && record.lockoutUntil > now;
      const validTimestamps = record.timestamps.filter((ts) => now - ts < 15 * 60 * 1000);
      if (!isLocked && validTimestamps.length === 0) {
        this.store.delete(key);
      } else {
        record.timestamps = validTimestamps;
      }
    }
  }

  /**
   * Fast isolate-local sliding window check.
   *
   * @param key Unique identifier (e.g., client IP or username)
   * @param maxRequests Maximum allowed requests within window
   * @param windowMs Window duration in milliseconds (default: 60,000ms = 1 minute)
   */
  public check(key: string, maxRequests: number = 60, windowMs: number = 60000): RateLimitResult {
    this.prune();
    const now = Date.now();
    let record = this.store.get(key);

    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Check if key is explicitly locked out
    if (record.lockoutUntil && record.lockoutUntil > now) {
      const retryAfterSec = Math.ceil((record.lockoutUntil - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetMs: record.lockoutUntil - now,
        retryAfterSec,
      };
    }

    // Filter out timestamps outside the active window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const resetMs = Math.max(0, oldest + windowMs - now);
      const retryAfterSec = Math.ceil(resetMs / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetMs,
        retryAfterSec,
      };
    }

    // Permitted: record this request
    record.timestamps.push(now);
    const remaining = maxRequests - record.timestamps.length;
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);

    return {
      allowed: true,
      remaining,
      resetMs,
      retryAfterSec: 0,
    };
  }

  /**
   * Distributed rate limit check backed by Cloudflare D1.
   * Ensures coordinated rate limiting across multiple edge Worker isolates.
   */
  public async checkDistributed(key: string, maxRequests: number = 60, windowMs: number = 60000): Promise<RateLimitResult> {
    // 1. Fast local check
    const local = this.check(key, maxRequests, windowMs);
    if (!local.allowed) {
      return local;
    }

    // 2. Distributed coordination via database
    try {
      const db = await (classroomDb as any).getDb();
      if (!db) return local;

      // Ensure table exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key TEXT PRIMARY KEY,
          request_count INTEGER NOT NULL DEFAULT 1,
          window_start INTEGER NOT NULL,
          lockout_until INTEGER,
          updated_at INTEGER NOT NULL
        );
      `);

      const now = Date.now();
      const row: any = await db.prepare('SELECT request_count, window_start, lockout_until FROM rate_limits WHERE key = ?').get(key);

      if (row) {
        if (row.lockout_until && row.lockout_until > now) {
          const retryAfterSec = Math.ceil((row.lockout_until - now) / 1000);
          return {
            allowed: false,
            remaining: 0,
            resetMs: row.lockout_until - now,
            retryAfterSec,
          };
        }

        if (now - row.window_start < windowMs) {
          if (row.request_count >= maxRequests) {
            const resetMs = Math.max(0, row.window_start + windowMs - now);
            const retryAfterSec = Math.ceil(resetMs / 1000);
            return {
              allowed: false,
              remaining: 0,
              resetMs,
              retryAfterSec,
            };
          }

          const newCount = row.request_count + 1;
          await db.prepare('UPDATE rate_limits SET request_count = ?, updated_at = ? WHERE key = ?').run(newCount, now, key);
          return {
            allowed: true,
            remaining: maxRequests - newCount,
            resetMs: Math.max(0, row.window_start + windowMs - now),
            retryAfterSec: 0,
          };
        }
      }

      // First request or window expired
      await db.prepare(`
        INSERT OR REPLACE INTO rate_limits (key, request_count, window_start, lockout_until, updated_at)
        VALUES (?, 1, ?, NULL, ?)
      `).run(key, now, now);

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetMs: windowMs,
        retryAfterSec: 0,
      };
    } catch {
      // Fallback gracefully to local in-memory decision
      return local;
    }
  }

  /**
   * Records a failed authentication attempt and applies progressive lockout.
   * Lockout rules:
   * - 5 consecutive failures: 1 minute lockout
   * - 10 consecutive failures: 15 minutes lockout
   */
  public recordAuthFailure(key: string): { locked: boolean; lockoutUntil?: number; retryAfterSec?: number } {
    const now = Date.now();
    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [], failedCount: 0 };
      this.store.set(key, record);
    }

    record.failedCount = (record.failedCount || 0) + 1;

    if (record.failedCount >= 10) {
      record.lockoutUntil = now + 15 * 60 * 1000; // 15 minutes
      return { locked: true, lockoutUntil: record.lockoutUntil, retryAfterSec: 15 * 60 };
    } else if (record.failedCount >= 5) {
      record.lockoutUntil = now + 60 * 1000; // 1 minute
      return { locked: true, lockoutUntil: record.lockoutUntil, retryAfterSec: 60 };
    }

    return { locked: false };
  }

  /**
   * Resets failure counter upon successful authentication.
   */
  public recordAuthSuccess(key: string): void {
    const record = this.store.get(key);
    if (record) {
      record.failedCount = 0;
      delete record.lockoutUntil;
    }
  }

  /**
   * Clears state for testing.
   */
  public reset(): void {
    this.store.clear();
  }
}

export const rateLimiter = new HybridRateLimiter();
