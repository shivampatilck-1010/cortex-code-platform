# PHASE 4.12: INCIDENT RESPONSE RUNBOOK

**Target Environment**: Production (`cortex-code-platform`) & Staging (`cortex-code-platform-staging`)  
**Classification**: University Online Examination SRE Runbook  
**Last Revised**: 2026-10-31  

---

## 1. Incident Severity Definitions

- **SEV-1 (Critical)**: Platform unavailable during an active university examination window; database unreachable; examinees unable to submit answers.
- **SEV-2 (Major)**: Partial degradation affecting autosave latencies (>5s); WebSocket signaling intermittent; real-time proctor video stream disrupted (standard exams unaffected).
- **SEV-3 (Minor)**: Non-blocking reporting anomalies; instructor analytics slow; cosmetic UI layout issues on specific legacy viewports.

---

## 2. Emergency Operational Playbooks

### Playbook 1: Production Worker Rollback (SEV-1 / SEV-2)
When a newly deployed Worker release introduces unhandled exceptions:
1. Identify the prior known stable version ID (e.g. `7d8b2f0a-053c-4159-ad0a-e954df8549cb`).
2. Execute immediate deployment rollback via Wrangler:
   ```bash
   npx wrangler rollback --version <STABLE_VERSION_ID>
   ```
3. Verify public health probe:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/health
   ```
   Confirm HTTP 200 returned in $< 500\text{ms}$.

### Playbook 2: Cloudflare D1 Database Recovery (SEV-1)
In the event of accidental schema corruption or catastrophic data corruption:
1. Locate the latest verified timestamped backup (stored in `backups/production/`).
2. Restore to an isolated D1 recovery target:
   ```bash
   npx wrangler d1 execute cortex-recovery-db --file=backups/production/cortex-db_<TIMESTAMP>.sql
   ```
3. Execute integrity check on recovered database:
   ```bash
   npx wrangler d1 execute cortex-recovery-db --command="PRAGMA integrity_check; PRAGMA foreign_key_check;"
   ```
4. Update worker binding to point to recovery instance once verified.

### Playbook 3: Active Exam Deadline Emergency Extension (SEV-1)
If a campus network disruption impacts candidates during an active examination:
1. Instructors can issue an authoritative window extension via API or D1 execute:
   ```sql
   UPDATE exam_sessions 
   SET expires_at = expires_at + (15 * 60 * 1000), updated_at = unixepoch() * 1000
   WHERE exam_id = '<EXAM_ID>' AND status = 'in_progress';
   ```
2. Candidates' local timers dynamically refresh upon next polling heartbeat or autosave.
