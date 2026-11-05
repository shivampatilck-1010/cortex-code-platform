# Cortex Online Examination System — Phase 3.9.1 Distributed Rate Limiting & Authentication Audit

## 1. Executive Summary

This audit assesses the rate limiting and authentication security architecture implemented in `src/lib/classroom/rate-limiter.ts` and `src/app/api/v1/auth/login/route.ts`.

While the sliding window rate limiter effectively throttles single-isolate Node.js execution, empirical testing confirms critical vulnerabilities when deployed across distributed Cloudflare Workers edge nodes.

---

## 2. Tested Architecture & Implementation Inspection

The current rate limiter (`InMemoryRateLimiter`) uses an in-memory `Map<string, RateLimitRecord>`:
```typescript
interface RateLimitRecord {
  timestamps: number[];
  lockoutUntil?: number;
  failedCount?: number;
}
```
* **IP Throttling**: Restricts client IP to 20 requests per 60,000ms.
* **Progressive Lockout**: Locks out an account identifier after 5 failures (60s) and 10 failures (15m).
* **Reset**: Resets counters on successful authentication.

---

## 3. Empirical Test Findings & Vulnerability Reproductions

The audit script `scripts/audit-phase3-9-1-rate-limiter.ts` produced the following findings:

### Finding 1: Distributed State Partitioning (Multi-Isolate Bypass)
* **Severity**: High
* **Status**: Confirmed
* **Root Cause**: Cloudflare Workers executes across hundreds of edge locations (PoPs). An in-memory JavaScript `Map` resides exclusively in the private V8 isolate of a single Worker process.
* **Reproduction**: When an adversary issues 12 failed authentication attempts distributed across 3 concurrent isolates (4 per isolate), none of the isolates reach the 5-attempt threshold. The attacker successfully executes 12 brute-force attempts without triggering lockout.
* **Impact**: Distributed credential stuffing attacks bypass in-memory account lockouts.

### Finding 2: Ephemeral State Loss on Isolate Recycling
* **Severity**: High
* **Status**: Confirmed
* **Root Cause**: Serverless isolates recycle during idle periods, code deployments, or memory pressure.
* **Reproduction**: An account locked out for 15 minutes was verified to be locked. Upon isolate restart/recycle (`rateLimiter.reset()`), all lockout timestamps were completely wiped, allowing immediate re-attack.
* **Impact**: Lockout enforcement is non-deterministic and can be cleared whenever isolates recycle.

### Finding 3: Account Lockout Denial of Service (Unauthenticated Targeted DOS)
* **Severity**: High
* **Status**: Confirmed
* **Root Cause**: Account lockout locks `user:<normalizedIdentifier>` globally regardless of the source IP address.
* **Reproduction**: An attacker knowing a student's public university email (`student@university.edu`) intentionally submits 5 wrong passwords from an attacker machine. The student attempting to log in with the correct password is then blocked with HTTP 429 Too Many Requests.
* **Impact**: Adversaries can purposefully lock out entire cohorts of students or professors immediately before an examination, causing widespread disruption.

### Finding 4: IP Rate Limiting Bypass via Header Mutation in Non-CF Proxies
* **Severity**: Medium
* **Status**: Confirmed
* **Root Cause**: `req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim()` allows `x-forwarded-for` fallback. In non-Cloudflare local proxies or staging environments without Cloudflare header enforcement, rotating `x-forwarded-for` headers generates distinct IP keys.

---

## 4. Architecture Evaluation: Supported Cloudflare Solutions

| Architectural Approach | Global Coordination | State Durability | Complexity | Suitability for Cortex |
| :--- | :--- | :--- | :--- | :--- |
| **A. Pure In-Memory (Current)** | None (Partitioned per isolate) | None (Lost on isolate recycle) | Low | Unsuitable for production |
| **B. Cloudflare Durable Objects** | Strong Global Coordination | High (Durable storage & alarms) | Medium | Excellent for real-time live exam sync; higher subrequest overhead for simple logins |
| **C. Cloudflare D1 Persistent Security Table** | Globally Replicated Read/Write | High (Transactional SQLite) | Low-Medium | **Recommended for Auth Lockout**: Uses existing D1 binding; consistent across all edge PoPs |
| **D. Cloudflare WAF Rate Limiting** | Edge-Enforced across PoPs | High (Cloudflare Anycast edge) | Low (Config) | **Recommended for IP Flood**: Offloads Layer 7 DoS before worker execution |

---

## 5. Recommended Remediation Plan (Phase 3.9.2)

1. **Persistent Lockout in D1 (`auth_lockouts` table)**:
   Store account failed attempt counters, `locked_until`, and `last_failed_at` in D1 so all Worker isolates share a single source of truth.
2. **Compound Lockout Keying (Account + IP) & CAPTCHA/Backoff**:
   Prevent targeted account denial-of-service by applying progressive delay to the specific offending IP, while allowing legitimate users with correct passwords to authenticate.
3. **Strict Header Sanitization**:
   Prioritize `cf-connecting-ip` strictly in production, ignoring spoofable client headers.
