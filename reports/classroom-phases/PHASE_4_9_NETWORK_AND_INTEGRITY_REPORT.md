# PHASE 4.9: NETWORK RESILIENCE, OFFLINE BUFFERING & INTEGRITY REPORT

**Environment**: Staging (`cortex-code-platform-staging.cortexbuild1.workers.dev`)  
**Database**: `cortex-staging-db` (`e6375738-d9b2-4c5a-a3e5-3a34e892f49d`)  
**Audit Date**: 2026-10-31  
**Status**: PASSED  
**Test Suites**: 
- `scripts/test-phase4-9-network-integrity.ts` (14/14 Passed)
- `scripts/test-phase4-deadline-offline-consistency.ts` (31/31 Passed)
**Total Verifications**: 45/45 Passed (0 Failed)

---

## 1. Executive Summary

Phase 4.9 rigorously evaluated the server-authoritative integrity of the Cortex Online Examination System under severe network conditions, packet delays, client clock tampering, network dropouts, out-of-order deliveries, and race conditions.

All 45 verification assertions across database-level primitives and live HTTP endpoints passed without defect. The server strictly enforces monotonic timestamp progression, rejects post-expiry answer mutations during the 30-second network grace window, enforces atomic submission locking, and logs proctor telemetry without automated punitive disqualifications.

---

## 2. Core Architectural Principles Verified

### 2.1 Server-Authoritative 30-Second Grace Window
The Cortex examination architecture establishes that the 30-second grace window after `session.expiresAt` exists solely for **network transit of previously buffered answers**, never for answering or editing:
- **During Active Window (`now <= session.expiresAt`)**:
  - `PUT /responses` accepted (HTTP 200).
  - `POST /submit` accepted (HTTP 200, status: `submitted`).
- **During Grace Window (`session.expiresAt < now <= session.expiresAt + 30000`)**:
  - `PUT /responses` strictly rejected (HTTP 403, `{ error: "...", expired: true }`).
  - `POST /submit` accepted (HTTP 200, status: `submitted`). Any answers in the submit body are evaluated strictly against answers captured prior to `expiresAt`.
- **Post-Grace Period (`now > session.expiresAt + 30000`)**:
  - `PUT /responses` strictly rejected (HTTP 403, `{ expired: true }`).
  - `POST /submit` accepted but recorded strictly as `timed_out` (HTTP 200, status: `timed_out`).

### 2.2 Monotonic Write Ordering & Out-of-Order Rejection
Candidate autosaves can be delayed by intermittent cellular or Wi-Fi drops. If packet B (updated at $t_1$) arrives at the server *after* packet C (updated at $t_2$, where $t_2 > t_1$), packet B must not overwrite packet C.
- Enforced in SQLite/D1 via conditional conflict resolution:
  ```sql
  INSERT INTO exam_question_responses (id, session_id, question_id, response_json, flagged_for_review, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id, question_id) DO UPDATE SET
    response_json = excluded.response_json,
    flagged_for_review = excluded.flagged_for_review,
    updated_at = excluded.updated_at
  WHERE excluded.updated_at >= exam_question_responses.updated_at;
  ```
- Stale payloads with older timestamps are silently ignored by the database engine without crashing the client request.

### 2.3 Atomic Submission Locking
Concurrent or double submissions (e.g. rapid double-clicking or simultaneous autosave and final submission) are serialized atomically:
- Session status transitions from `in_progress` to `submitted` using atomic conditional updates:
  ```sql
  UPDATE exam_sessions
  SET status = 'submitted', submitted_at = ?
  WHERE id = ? AND status = 'in_progress';
  ```
- If two requests attempt submission concurrently, exactly one succeeds; the second receives an atomic lock rejection and cannot re-grade or overwrite session records.
- Autosave requests arriving after final submission are strictly rejected with HTTP 400.

---

## 3. Test Evidence Summary

| Boundary Suite | Tests | Assertions Passed | Error Rate | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| Boundary 1: Normal Persistence Before Expiry | Case 1 | 4 / 4 | 0.00% | PASSED |
| Boundary 2 & 4: Offline Buffering & Flush | Case 2 & 4 | 3 / 3 | 0.00% | PASSED |
| Boundary 7: Out-of-Order & Stale Sync Rejection | Case 7 | 2 / 2 | 0.00% | PASSED |
| Boundary 3 & 5: Deadline Expiry & Grace Window | Case 3 & 5 | 7 / 7 | 0.00% | PASSED |
| Boundary 6: Post-Grace Submission Expiration | Case 6 | 3 / 3 | 0.00% | PASSED |
| Boundary 8: Concurrent Submission & Autosave | Case 8 | 4 / 4 | 0.00% | PASSED |
| Database Monotonic & Integrity Audit | Unit/DB | 14 / 14 | 0.00% | PASSED |
| Setup and Candidate Lifecycle Handshakes | Setup | 8 / 8 | 0.00% | PASSED |
| **Total** | | **45 / 45** | **0.00%** | **PASSED** |

---

## 4. Integrity Telemetry & Non-Punitive Auditing

All client-side proctoring events (e.g. fullscreen exit, tab blur, focus change) are recorded to `exam_integrity_events`:
- Events are tagged with `session_id`, `event_type`, `timestamp`, and detailed metadata.
- Automated punitive actions (e.g. wiping answers or terminating sessions) are prohibited.
- Events populate proctor analytics dashboards so teachers and invigilators can review anomalies with human discretion.
