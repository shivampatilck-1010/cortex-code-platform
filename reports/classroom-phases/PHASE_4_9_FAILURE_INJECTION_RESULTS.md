# PHASE 4.9: FAILURE INJECTION & RESILIENCE RESULTS

**Audit Date**: 2026-10-31  
**Target Environment**: Staging Worker (`cortex-code-platform-staging.cortexbuild1.workers.dev`)  
**Verdict**: PASSED (Resilient across all 5 fault vectors)

---

## 1. Fault Vector Matrix

| Fault Code | Failure Injection Scenario | Injected Condition | Expected System Behavior | Observed Behavior | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FI-01** | Out-of-Order Packet Delivery | Packet with $t = t_1 - 5000\text{ms}$ sent after packet with $t = t_1$ | Database rejects stale update via `ON CONFLICT ... WHERE excluded.updated_at >= ...` | Stale write ignored; newer answer preserved; HTTP 200 returned | PASSED |
| **FI-02** | Grace Period Late Answer Mutation | `PUT /responses` dispatched at $t = \text{expiresAt} + 2000\text{ms}$ | Server rejects modification with HTTP 403 (`expired: true`) | Rejected with HTTP 403, error: `Examination duration has ended. Please submit your answers.` | PASSED |
| **FI-03** | In-Grace Answer Injection in Submit Payload | `POST /submit` includes `{ finalResponses: { q: { value: 999 } } }` post-deadline | Server ignores late answers; scores pre-expiry answers | Exam scored strictly from pre-expiry answer ($10/10$); late injection discarded | PASSED |
| **FI-04** | Post-Grace Reconnection Submission | `POST /submit` dispatched at $t = \text{expiresAt} + 31000\text{ms}$ | Server accepts request but marks session status `timed_out` | HTTP 200 returned; session status committed as `timed_out` | PASSED |
| **FI-05** | Double Submission Race Condition | Concurrent execution of `POST /submit` and `PUT /responses` | Exactly one submit succeeds; subsequent saves rejected | First submit commits `submitted`; subsequent save returns HTTP 400 | PASSED |

---

## 2. Injected Scenarios & Empirical Evidence

### FI-01: Out-of-Order Packet Delivery
- Candidate Alpha answered Question 1 with `opt_kyoto` at $t_1$.
- Delayed network queue subsequently transmitted an earlier offline draft (`opt_osaka` at $t_0 < t_1$).
- Response from server:
  - Stale write processed safely without throwing an exception.
  - Final database inspection confirmed `opt_kyoto` remained committed.

### FI-02 & FI-03: Grace Period Answer Tampering
- Candidate Beta completed Question 2 before deadline with correct answer `25`.
- At deadline $+ 2$ seconds, client attempted to modify Question 2 to `999`.
  - HTTP 403 was immediately returned with `expired: true`.
- Client then called `/submit` during grace period with inline injected response `999`.
  - Server auto-grader computed score from verified pre-expiry response `25`.
  - Final score recorded: `10 / 10` (points for `25`), proving late injection payload was cleanly disregarded.

### FI-04: Post-Grace Expiration
- Candidate Alpha initiated Exam 3 with 5-minute duration and short closing time.
- After session expired and an additional 38 seconds elapsed ($> 30\text{s}$ grace period), candidate submitted answers.
- Server response:
  - HTTP 200 returned with message confirming `Examination timed out`.
  - Session status authoritatively set to `timed_out`.
  - Candidate prohibited from further submissions.

### FI-05: Double Submission & Save Race Condition
- Candidate Beta submitted session while simultaneously dispatching an autosave request.
- Database execution serialized via atomic conditional `UPDATE ... WHERE status = 'in_progress'`.
- First request succeeded, sealing session.
- Concurrent autosave request returned:
  ```json
  { "error": "Cannot save responses to a submitted session" }
  ```
- HTTP status 400 returned, guaranteeing no dirty writes occur post-finalization.
