# CORTEX LOCKDOWN ALPHA 10 — CRYPTOGRAPHIC ASSURANCE & RECOVERY SECURITY SPECIFICATION

Document Version: 1.0.0-rc3-alpha10  
Classification: Institutional Security Architecture Specification  
Target Audience: Security Officers, Cryptographic Auditors, System Administrators, Faculty Exam Directors  
Strict Policy: Zero Emojis  

---

## 1. Executive Summary

Cortex Lockdown Alpha 10 delivers cryptographic hardening of the examination recovery subsystem, eliminating remaining theoretical vulnerabilities in recovery code generation, storage, and redemption. 

In Alpha 9, the emergency-exit recovery code verification utilized an HMAC-SHA256 digest where a random per-authorization salt served as the HMAC key. While this prevented simple static dictionary attacks, the salt was stored in the same database row as the hash, creating a scenario where a complete database dump would expose both the salt and the digest, reducing the resistance of the 6-digit OTP space (10^6 combinations) to local offline brute-force attacks.

Alpha 10 resolves this risk by establishing a server-authoritative cryptographic pepper architecture combined with canonical context binding. The server pepper is an uncommitted 256-bit secret stored exclusively within backend secret-management infrastructure. Furthermore, canonical message binding tightly binds the salt, the hardware challenge, the authorization identifier, and the OTP into a single cryptographic input. A stolen database snapshot provides zero utility to an attacker because offline verification is impossible without the server-only cryptographic pepper.

---

## 2. Cryptographic Construction & Storage Architecture

### 2.1 Cryptographic Transition Analysis

| Property | Alpha 9 Implementation | Alpha 10 Hardened Implementation |
| :--- | :--- | :--- |
| Digest Algorithm | HMAC-SHA256 | HMAC-SHA256 with Server Pepper |
| HMAC Key | `code_salt` (Stored in database) | `SERVER_PEPPER` (Backend secret management only) |
| Message Input | Plaintext OTP string (`otp`) | Canonical Context Binding (`${salt}:${challenge}:${authId}:${otp}`) |
| Per-Authorization Entropy | 16-byte random hex salt | 16-byte random hex salt |
| Database Columns | `code_hash`, `code_salt` | `code_hash`, `code_salt` (Pepper never stored) |
| Plaintext OTP Exposure | Zero stored in database | Zero stored in database |
| Offline Brute-Force Resistance | Weak if database leaked (salt in DB) | Absolute: Computational infeasibility without `SERVER_PEPPER` |
| Cross-Challenge Replay | Prevented by database challenge index | Cryptographically bound into hash canonical message |
| Hash Comparison | Constant-time `crypto.timingSafeEqual` | Constant-time `crypto.timingSafeEqual` over 32-byte buffers |

### 2.2 Canonical Message Binding Construction

The recovery authorization digest is computed using the following strict canonical representation:

```
canonicalMessage = "${salt.trim()}:${challenge.trim().toUpperCase()}:${authorizationId.trim()}:${otp.trim()}";
codeHash = HMAC-SHA256(key = SERVER_PEPPER, message = canonicalMessage);
```

#### Cryptographic Rationale:
1. **Salt Binding (`salt`)**: Guarantees distinct digest outputs even if two proctors simultaneously issue identical OTPs for different candidates.
2. **Challenge Binding (`challenge`)**: Prevents challenge transplantation attacks, where an attacker intercepts an OTP intended for Workstation A and attempts redemption against Workstation B.
3. **Authorization ID Binding (`authorizationId`)**: Ensures that every redemption attempt is unique across time, even if a student re-enrolls in an examination with the same hardware challenge.
4. **OTP Binding (`otp`)**: Ensures the candidate-supplied 6-digit verification code is authenticated against the exact context of the emergency exit.

### 2.3 Server Secret Isolation & Non-Exposure

The server cryptographic pepper (`LOCKDOWN_SERVER_PEPPER`) is loaded directly from the hosting execution environment. It is subject to strict isolation boundaries:
- **Zero Client Exposure**: The pepper is never embedded in native binaries (CortexLockdown.exe, macOS Swift app), never transmitted over the network, and never exposed in launch grants.
- **Zero Database Exposure**: The database stores only `code_salt` (public entropy) and `code_hash` (the HMAC output). The pepper is never inserted into SQLite, Cloudflare D1, or transactional logs.
- **Zero Telemetry Leakage**: Event audit tables (`exam_integrity_events`, `pilot_audit_logs`) record challenge identifiers and authorization IDs, but never log peppers or raw OTP codes.
- **Fail-Closed Secret Absence**: If `LOCKDOWN_SERVER_PEPPER` is empty or missing in production environments, the engine immediately aborts and throws a critical exception (`CRITICAL: Server cryptographic pepper is not configured. Recovery authorization failed closed.`). It never degrades to an unkeyed hash or unpeppered digest.

---

## 3. Atomic Single-Winner Concurrency Enforcement

### 3.1 Concurrency Race Condition Elimination

In high-stakes examination halls, multiple network requests or malicious automated scripts might attempt concurrent redemptions of a single recovery token. Alpha 10 revalidates atomic single-use state transitions using ACID-compliant conditional updates.

```sql
UPDATE lockdown_emergency_authorizations
SET used = 1,
    redeemed_at = :now,
    updated_at = :now
WHERE challenge = :challenge
  AND exam_id = :examId
  AND used = 0
  AND failed_attempts < max_attempts
  AND expires_at > :now;
```

#### Invariant Guarantees:
- **Exactly One Winner**: When 10 simultaneous threads execute concurrent redemption requests with the identical valid OTP, the database conditional update matches rows where `used = 0`. The database engine guarantees that exactly one transaction succeeds (`changes === 1`). The winning thread is authorized; all 9 losing threads receive `Recovery authorization has already been redeemed (replay rejected)`.
- **Burn-on-Use**: Immediately upon successful redemption, `used` is set to 1. No secondary redemption can succeed under any condition.
- **Expiration Protection**: If `now >= expires_at`, the update matches 0 rows and fails closed with `Recovery authorization code has expired`.

### 3.2 Concurrent Brute Force Auto-Burn

To prevent rapid parallel brute-force attacks against 6-digit OTPs:
1. Any incorrect redemption attempt atomically increments `failed_attempts` via:
   ```sql
   UPDATE lockdown_emergency_authorizations
   SET failed_attempts = failed_attempts + 1,
       updated_at = :now
   WHERE challenge = :challenge;
   ```
2. When `failed_attempts >= max_attempts` (default: 3), the authorization is marked burned (`used = 1`).
3. Subsequent redemption attempts—even with the correct code—are unconditionally rejected.

---

## 4. Key Management, Secret Rotation & Disaster Recovery

### 4.1 Secret Rotation Protocol

The server pepper is a 256-bit symmetric key. To rotate the pepper without disrupting active examination halls:
1. **Maintenance Window Execution**: Key rotations must be scheduled outside active examination timeframes. Because emergency recovery authorizations have a maximum time-to-live of 180 seconds, draining active recovery authorizations requires at most 3 minutes.
2. **Dual-Key Rotation Phase (Optional)**: If zero-downtime rotation is required, the authorization engine can evaluate against `LOCKDOWN_SERVER_PEPPER_CURRENT` followed by `LOCKDOWN_SERVER_PEPPER_PREVIOUS` during a 5-minute transition window.
3. **Environment Injection**: The secret must be injected via secure environment variables (`wrangler secret put LOCKDOWN_SERVER_PEPPER` in Cloudflare Workers, or platform secret managers on Node.js hosts).

### 4.2 Disaster Recovery & Fail-Closed Guarantee

If backend database connectivity is interrupted during an emergency recovery redemption:
- The system defaults to fail-closed (`authorized: false`).
- No emergency exit is granted without verified database state transition.
- The proctor retains the physical ability to terminate the workstation via hardware power cycle if an immediate physical hazard exists.
- The candidate examination session remains safely preserved on the server up to the last synced answer response.

---

## 5. Verification Test Suite Results

The Alpha 10 cryptographic assurance test suite was executed via [test-lockdown-alpha10-assurance.ts](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/scripts/test-lockdown-alpha10-assurance.ts).

```
================================================================
CORTEX LOCKDOWN - ALPHA 10 CRYPTOGRAPHIC ASSURANCE & VALIDATION
================================================================

--- Section 1: Peppered Canonical OTP Storage & Cryptographic Assurance ---
[PASS] CRYP-01: Peppered Canonical HMAC-SHA256 Computation - HMAC-SHA256 digest generated successfully (length: 64, sample: 7db16cf664205c7f...)
[PASS] CRYP-02: Context Binding & Cross-Authorization Transplantation Resistance - Altering challenge, authorization ID, or salt completely changes digest output
[PASS] CRYP-03: Fail-Closed Behavior on Missing Server Pepper - Absence of server pepper secret throws fail-closed exception; never degrades to unkeyed hash
[PASS] CRYP-04: Cryptographic Pepper Isolation & Non-Exposure - Server pepper is held strictly in server memory; zero occurrences in issued objects or database rows

--- Section 2: Concurrency & Atomic Single-Winner Redemption ---
[PASS] RACE-01: 10 Simultaneous Concurrent Redemptions (Exactly One Winner) - Executed 10 concurrent requests: exactly 1 authorized, 9 replay rejections
[PASS] RACE-02: Concurrent Brute Force Auto-Burn and Lockout - Concurrent incorrect attempts automatically burned authorization; subsequent correct code rejected
[PASS] RACE-03: Durable Cryptographic Expiration Enforcement - Expired redemption rejected: Recovery authorization code has expired

--- Section 3: Multi-Isolate Durable Rate Limiting ---
[PASS] RATE-01: Distributed Shared-Store Rate Limit Boundary - Threshold 5 per window: exactly 5 allowed, 2 rejected
[PASS] RATE-02: Distributed Rate Limiter Window Expiration & Renewal - Window renewal permitted fresh request: current count reset to 1
```

All 7 cryptographic and concurrency test checks passed with zero errors.
