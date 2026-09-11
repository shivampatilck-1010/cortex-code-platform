/**
 * In-memory rate and concurrency limiter for execution endpoints.
 * Protects execution resources against volumetric abuse, infinite loops, and DoS.
 */

interface RateLimitRecord {
  timestamps: number[];
  concurrent: number;
}

class ExecutionRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxConcurrent: number;

  constructor(windowMs = 60_000, maxRequests = 20, maxConcurrent = 3) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.maxConcurrent = maxConcurrent;

    // Periodic cleanup of stale records every 2 minutes
    setInterval(() => this.cleanup(), 120_000).unref?.();
  }

  private getRecord(key: string): RateLimitRecord {
    let rec = this.records.get(key);
    if (!rec) {
      rec = { timestamps: [], concurrent: 0 };
      this.records.set(key, rec);
    }
    return rec;
  }

  /**
   * Checks whether the client is within request frequency limits.
   */
  public checkRateLimit(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const rec = this.getRecord(key);

    // Remove timestamps outside the sliding window
    rec.timestamps = rec.timestamps.filter((t) => now - t < this.windowMs);

    if (rec.timestamps.length >= this.maxRequests) {
      const oldest = rec.timestamps[0];
      const resetMs = Math.max(0, this.windowMs - (now - oldest));
      return { allowed: false, remaining: 0, resetMs };
    }

    rec.timestamps.push(now);
    const remaining = Math.max(0, this.maxRequests - rec.timestamps.length);
    return { allowed: true, remaining, resetMs: this.windowMs };
  }

  /**
   * Attempts to acquire an execution slot for concurrent limits.
   */
  public acquireSlot(key: string): boolean {
    const rec = this.getRecord(key);
    if (rec.concurrent >= this.maxConcurrent) {
      return false;
    }
    rec.concurrent++;
    return true;
  }

  /**
   * Releases an execution slot upon completion.
   */
  public releaseSlot(key: string): void {
    const rec = this.records.get(key);
    if (rec && rec.concurrent > 0) {
      rec.concurrent--;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    this.records.forEach((rec, key) => {
      rec.timestamps = rec.timestamps.filter((t) => now - t < this.windowMs);
      if (rec.timestamps.length === 0 && rec.concurrent === 0) {
        this.records.delete(key);
      }
    });
  }
}

export const executionRateLimiter = new ExecutionRateLimiter(60_000, 20, 3);
