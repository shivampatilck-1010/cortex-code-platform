# PHASE 4.9: DEADLINE AND GRACE PERIOD VERIFICATION

**Environment**: Staging (`cortex-code-platform-staging.cortexbuild1.workers.dev`)  
**Specification**: University Online Examination Standard (Authoritative 30s Grace Period)  
**Verification Date**: 2026-10-31  
**Verdict**: PASSED (All 6 boundary conditions verified)

---

## 1. Authoritative Timing State Machine

```
Timeline:
[------- Active Exam Window -------] | [--- 30s Grace Window ---] | [--- Closed ---]
0                                 T_exp                        T_exp + 30s

Permitted Operations:
- Autosave PUT /responses:           YES                           NO                NO
- Final Submit POST /submit:         YES                           YES               YES (timed_out)
- Final Response Ingestion:          Pre-expiry only               Pre-expiry only   None
- Result Status:                     submitted                     submitted         timed_out
```

---

## 2. Boundary Verification Matrix

| State | Condition | Timestamp Delta | Endpoint Called | Expected HTTP | Expected Status | Verified Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Active Window | $t < T_{\text{exp}}$ | `PUT /responses` | 200 OK | `in_progress` | PASSED |
| **2** | Active Window | $t < T_{\text{exp}}$ | `POST /submit` | 200 OK | `submitted` | PASSED |
| **3** | Grace Window | $T_{\text{exp}} < t \le T_{\text{exp}} + 30\text{s}$ | `PUT /responses` | 403 Forbidden | `in_progress` | PASSED |
| **4** | Grace Window | $T_{\text{exp}} < t \le T_{\text{exp}} + 30\text{s}$ | `POST /submit` | 200 OK | `submitted` | PASSED |
| **5** | Post-Grace | $t > T_{\text{exp}} + 30\text{s}$ | `PUT /responses` | 403 Forbidden | `timed_out` | PASSED |
| **6** | Post-Grace | $t > T_{\text{exp}} + 30\text{s}$ | `POST /submit` | 200 OK | `timed_out` | PASSED |

---

## 3. Client Offline Buffering & Flush Contract

1. **Client Persistence**:
   - Answers are captured in local IndexedDB / memory with high-resolution timestamps.
   - When network connectivity is severed, UI displays a persistent amber indicator: `Offline - answers buffered locally`.
2. **Reconnection Flush**:
   - Upon network restoration, client flushes queued answers in sequential order.
   - If reconnection occurs *before* $T_{\text{exp}}$, all buffered answers are persisted and accepted.
   - If reconnection occurs *during* the 30-second grace window, autosaves are rejected with `expired: true`, triggering immediate client execution of `/submit`.
   - The submission is accepted, ensuring candidate does not lose credit for answers formulated within the valid exam window.
3. **Post-Grace Lockdown**:
   - If candidate remains offline beyond $T_{\text{exp}} + 30\text{s}$, the session transitions to `timed_out` upon next connection.
   - Answers submitted post-grace are not eligible for auto-grading, preventing offline tampering.
