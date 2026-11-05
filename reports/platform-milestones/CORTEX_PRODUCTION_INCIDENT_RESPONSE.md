# CORTEX ONLINE EXAMINATION SYSTEM
# PRODUCTION INCIDENT RESPONSE PLAN

Document Version: 1.0.0  
Classification: Security, Reliability & Disaster Recovery  
Incident Commander: Lead Release Engineer / SRE  
Target Worker: `cortex-code-platform`  
Primary Database: Cloudflare D1 `cortex-db` (`f756374b-0e9b-4112-b502-b703788dd86f`)

---

## 1. INCIDENT SEVERITY CLASSIFICATION

| Severity | Definition | Target Response Time | Examples |
|---|---|---|---|
| SEV-1 (Critical) | Total platform outage during active university examination. Student answer data loss or inability to submit. | < 5 Minutes | Worker 5xx edge crashes; D1 database inaccessible; mass submission failures. |
| SEV-2 (High) | Degraded service affecting a subset of students. Core examination proceeds but proctoring or real-time sync is impacted. | < 15 Minutes | WebRTC signaling drops; slow autosave latency (> 2s); offline buffering alerts. |
| SEV-3 (Medium) | Non-blocking feature failure. Instructors unable to view analytics or edit drafts. | < 1 Hour | Reporting dashboard timeout; question bank import failure. |
| SEV-4 (Low) | Cosmetic or minor defect. No student examination impact. | Next Business Day | Minor layout clipping on unsupported resolution. |

---

## 2. SEV-1 INCIDENT TRIAGE & RESOLUTION WORKFLOW

```text
[ALERT DETECTED] (Monitor Probe / Student Report)
       │
       ▼
[CONFIRM SEVERITY] ──── Is active examination impacted?
       │ Yes
       ▼
[ASSESS DEPLOYMENT REGRESSION] ──── Did incident occur post-deployment?
       │ Yes
       ▼
[TRIGGER WORKER ROLLBACK] (Execution Latency: ~7.2s)
   npx wrangler rollback <previous-version> --config dist/server/wrangler.json -y
       │
       ▼
[VERIFY EDGE HEALTH] ──── curl /api/v1/health (HTTP 200)
       │
       ▼
[POST-INCIDENT REVIEW & LOG PRESERVATION]
```

---

## 3. SPECIFIC PLAYBOOKS

### Playbook A: Edge Worker Failure / 5xx Outage
1. Check edge logs:
   ```powershell
   npx wrangler tail cortex-code-platform
   ```
2. If caused by a bad release, execute instant rollback to last known stable version (`ec913f06-6550-41e0-aa88-8f145eba492d`):
   ```powershell
   npx wrangler rollback ec913f06-6550-41e0-aa88-8f145eba492d --config dist/server/wrangler.json -m "SEV-1 Rollback" -y
   ```
3. Verify public health:
   ```powershell
   curl -s https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/health
   ```

### Playbook B: Database Integrity Failure / Foreign Key Corruption
1. Verify database integrity:
   ```powershell
   npx wrangler d1 execute cortex-db --remote --command="PRAGMA integrity_check;"
   npx wrangler d1 execute cortex-db --remote --command="PRAGMA foreign_key_check;"
   ```
2. If schema corruption is verified, locate the pre-deployment backup in `backups/d1/`:
   `cortex-db_2026-10-31T11-09-59-404Z_manual.sql`
3. Execute SQL restoration to production D1:
   ```powershell
   npx wrangler d1 execute cortex-db --remote --file="backups/d1/cortex-db_2026-10-31T11-09-59-404Z_manual.sql"
   ```

### Playbook C: Mass Disconnect During Exam
1. Candidate client devices automatically switch to offline buffering mode in IndexedDB.
2. Direct proctors to instruct students not to close browser windows or refresh tabs.
3. The platform provides an automatic 30-second grace window after network restoration for client-buffered responses to flush with high priority.
4. If connectivity cannot be restored at the examination center before the time window elapses, the instructor can issue an examination deadline extension via the Teacher Dashboard (`/classroom/{roomId}/exams/{examId}`).

### Playbook D: Audio/Video Signaling Failure (Track B)
1. If WebRTC video fails, Track A examination data flow remains completely unaffected.
2. Students can continue taking exams without interruption.
3. Verify whether ICE candidate relay failed due to missing TURN secret configuration:
   `CORTEX_TURN_SECRET` is required for symmetric NAT traversal.
4. Instruct candidates to proceed with offline/online assessment while video proctoring is restarted.
