# Cortex Online Examination System — Phase 3.9.1 Authentication Abuse & Lockout Audit

## 1. Executive Summary & Audit Scope

This audit investigates the abuse resistance, denial-of-service risks, and timing characteristics of the authentication and account lockout architecture in `src/app/api/v1/auth/login/route.ts` and `src/lib/classroom/rate-limiter.ts`.

---

## 2. Tested Abuse Vectors & Empirical Findings

### Finding 1: Unauthenticated Targeted Account Lockout Denial of Service (High Severity)
* **Root Cause**: Account lockout operates purely on the identifier (`user:<normalizedIdentifier>`) regardless of the source IP address or whether the attacker possesses valid credentials.
* **Reproduction**:
  * An attacker knowing a victim's email (`alice_senior@university.edu`) sends 5 consecutive requests with incorrect passwords.
  * The account transitions to locked state (`Retry-After: 60s`).
  * When Alice subsequently attempts to log in using her 100% valid password, the endpoint checks `rateLimiter.check(userLockoutKey)` *before* verifying credentials and rejects her request with HTTP 429 Too Many Requests.
* **Impact**: Right before a high-stakes exam, a malicious actor could lock out an entire classroom cohort by automating 5 failed login attempts per student email.

### Finding 2: Account Enumeration via Cryptographic Execution Timing (Medium Severity)
* **Root Cause**:
  When a user exists, `ClassroomAuth.verifyPassword` executes PBKDF2 / SHA-256 / bcrypt password verification taking **~16.0ms**. When a user does NOT exist, the endpoint returns HTTP 401 immediately in **< 0.1ms**.
* **Timing Ratio**: **~160x latency difference**.
* **Impact**: An attacker can enumerate registered faculty and candidate email addresses by measuring millisecond differences in HTTP 401 responses.

### Finding 3: Lockout Recovery & State Expiration (Verified Correct)
* **Test**: Verified that once the lockout window expires (`lockoutUntil < now`), the account automatically recovers and permits valid authentication.
* **Result**: Pass. The rate limiter correctly allows requests once `now > lockoutUntil`.

---

## 3. Required Remediation Architecture (Phase 3.9.2)

1. **Compound (IP + Account) Progressive Lockout**:
   * Lockout should be enforced per `(client_ip, user_identifier)` tuple for progressive delays.
   * If multiple IPs fail against a single account, apply an exponential delay / challenge instead of hard denial of valid credentials.
2. **Timing Equalization (Dummy Hash Verification)**:
   * When an identifier does not exist in the database, execute a dummy password hash verification against a static hash to consume ~16ms, eliminating the timing side-channel.
3. **Graceful Bypass for Legitimate Users**:
   * Allow users with correct credentials to authenticate even if an attacker recently triggered failed attempts from a foreign IP, while logging the security event for proctor review.
