# CORTEX LOCKDOWN — EMERGENCY RECOVERY & CRYPTOGRAPHIC VERIFICATION

Document Identifier: CL-MRE-EMG-01
Programme: Cortex Lockdown v1.0
Baseline: Release Candidate v1.0.0-rc3 (Master Programme Complete)
Target Subsystems: Emergency Exit API, Cryptographic Policy Engine, Cloudflare D1
Classification: Cryptographic Security, Concurrency Engineering & Recovery Verification

---

## 1. EXECUTIVE SUMMARY & THREAT MODEL

During high-stakes computerized examinations, medical emergencies, workstation hardware crashes, or lab evacuations can occur. In such situations, the examination application must provide an emergency recovery exit that unlocks the workstation cleanly and safely.

However, an emergency exit mechanism is also a prime attack target. If students can guess, intercept, replay, or brute-force recovery codes, the containment boundary is void.

This document details the server-authoritative, peppered challenge-response architecture, mathematical construction, atomic single-winner concurrency model, and empirical test verification of the Cortex Lockdown emergency recovery engine.

---

## 2. CRYPTOGRAPHIC PEPPER & CANONICAL BINDING ARCHITECTURE

```
+-------------------------------------------------------------------------------------------------------+
|                                    EMERGENCY EXIT CANONICAL BINDING                                   |
+-------------------------------------------------------------------------------------------------------+
|                                                                                                       |
|  [ Workstation Screen ]                                  [ Cloudflare Worker Backend ]                |
|  Ctrl+Alt+F10 generates                                  Holds Secret: LOCKDOWN_SERVER_PEPPER         |
|  Challenge: "A7X9-4K2P"                                  (Held exclusively in backend RAM)            |
|            |                                                            |                             |
|            | Candidate calls Proctor                                    |                             |
|            v                                                            v                             |
|  [ Proctor Authenticates ] ------------ (POST Challenge) --------> [ Issue Authorization ]            |
|                                                                     Generate 16-byte random Salt      |
|                                                                     Generate 6-digit numeric OTP      |
|                                                                     Generate unique AuthorizationId   |
|                                                                                 |                     |
|                                                                                 v                     |
|                                                                     [ Canonical Message String ]      |
|                                                                     salt:challenge:authId:otp         |
|                                                                                 |                     |
|                                                                                 v                     |
|                                                                     HMAC-SHA256(canonical, PEPPER)   |
|                                                                                 |                     |
|                                                                                 +---> DB: Stores HASH |
|                                                                                 |     (Never plaintext|
|                                                                                 +---> Proctor: OTP    |
+-------------------------------------------------------------------------------------------------------+
```

### 2.1. Mathematical Construction
The authorization engine in [`src/lib/lockdown/security-policy.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/security-policy.ts#L75-L84) defines:
```typescript
canonical = `${params.salt.trim()}:${params.challenge.trim().toUpperCase()}:${params.authorizationId.trim()}:${params.otp.trim()}`;
codeHash = crypto.createHmac('sha256', SERVER_PEPPER).update(canonical).digest('hex');
```

- **Salt**: 16 cryptographically random bytes (`crypto.randomBytes(16).toString('hex')`) generated per authorization.
- **Server Pepper**: Minimum 32-character high-entropy secret provisioned in the Cloudflare Worker secret environment (`LOCKDOWN_SERVER_PEPPER`). It is **never** written to database records, source maps, client configuration, or execution logs.
- **Challenge Binding**: The uppercase alphanumeric challenge code displayed on the physical monitor.
- **Authorization ID**: Unique timestamped identifier (`recov_<timestamp>_<random>`).
- **OTP**: 6-digit numeric code (`100000` to `999999`) with a 180-second TTL.

Even if an attacker gains read access to the Cloudflare D1 database, they cannot reverse the stored `code_hash` to compute the valid 6-digit OTP without the server pepper.

---

## 3. ATOMIC D1 SINGLE-WINNER REDEMPTION & CONCURRENCY CONTROL

To prevent race conditions where a candidate attempts to share an OTP or redeem it across multiple workstations simultaneously, state transitions are enforced using atomic conditional SQL in Cloudflare D1:

```sql
UPDATE lockdown_emergency_authorizations
SET used = 1,
    redeemed_at = ?
WHERE challenge = ? AND used = 0;
```

### 3.1. Concurrency Execution Flow

```
[ Parallel Request A ]                           [ Parallel Request B ]
         |                                                 |
         v                                                 v
(Begins D1 Conditional Update)                   (Begins D1 Conditional Update)
         |                                                 |
         v                                                 v
  [ Lock Obtained ]                                 [ Waits / Follows ]
  Row matched: used == 0                            Row matched: used == 1
  Changes: 1                                        Changes: 0
         |                                                 |
         v                                                 v
  STATUS: AUTHORIZED (WINNER)                       STATUS: REJECTED (409 CONFLICT)
  Workstation Restores Desktop                      Request Denied; Event Logged
```

- When two concurrent redemption requests arrive at the same millisecond:
  - Exactly one request obtains `changes === 1`.
  - The losing request observes `changes === 0` and is immediately rejected with:
    `Recovery authorization has already been redeemed (replay rejected)`.

---

## 4. MULTI-DIMENSIONAL SCOPE BINDING & BRUTE-FORCE LOCKOUT

### 4.1. Failed Attempt Auto-Burn
Every incorrect OTP entry atomically increments `failed_attempts` in D1:
```sql
UPDATE lockdown_emergency_authorizations
SET failed_attempts = failed_attempts + 1
WHERE challenge = ?;
```
- Maximum permitted attempts: Exactly 3.
- If `failed_attempts >= 3`, the authorization record is immediately transitioned to `burned = true`.
- Total search space tested before complete challenge burn: 3 guesses out of 900,000 possibilities (0.00033% success probability).

### 4.2. Fail-Closed Resilience
If the Cloudflare D1 database is unreachable, network connectivity is severed, or an internal exception occurs:
```typescript
catch (err: any) {
  // Database failures FAIL CLOSED
  return NextResponse.json({ authorized: false, error: 'Emergency exit database unavailable: request denied (fail-closed)' }, { status: 500 });
}
```
The application fails closed: unauthorized exit is strictly denied.

---

## 5. NATIVE DESKTOP RESTORATION PROTOCOL

Once the server returns `{ authorized: true }`:
1. The native Windows client invokes `KeyboardHook.Uninstall()`.
2. Windows low-level hook (`WH_KEYBOARD_LL`) is unhooked via `Win32Native.UnhookWindowsHookEx`.
3. Windows Taskbar and Start button are unhidden (`ShowWindow(taskbarHwnd, SW_SHOW)`).
4. Full-screen kiosk window closes gracefully, returning the user to the standard Windows desktop.

---

## 6. EMPIRICAL VERIFICATION EVIDENCE

| Verification Metric | Test Check | Target Standard | Observed Result | Verdict |
|---|---|---|---|---|
| Pepper Absence from Client | `MCP-09` | Zero secret strings in PE binary | 0 occurrences in disasm | PASS |
| Deterministic HMAC-SHA256 | `RC-07` | Identical inputs produce identical hash | `hash1 === hash2` | PASS |
| Atomic Single Winner | `RC-08` | 1 Winner, 1 Rejected | Attempt 1: Auth, Attempt 2: Replay Rej | PASS |
| Failed Attempt Lockout | `A15-13` | Burn after 3 failures | State set to BURNED after 3 bad OTPs | PASS |
| Distributed Rate Limit | `RC-09` | Rate limit enforced in D1 table | Blocked with 429 when quota exceeded | PASS |

---
*End of Emergency Recovery & Cryptographic Verification.*
