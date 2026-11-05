# CORTEX ONLINE EXAMINATION SYSTEM
# PRODUCTION OPERATIONS RUNBOOK

Document Version: 1.0.0  
Classification: Production Engineering & System Operations  
Primary Operator Role: Release Manager, Site Reliability Engineer, Exam Proctor  
Target Worker: `cortex-code-platform`  
Production URL: `https://cortex-code-platform.cortexbuild1.workers.dev`  
Target D1: `cortex-db` (`f756374b-0e9b-4112-b502-b703788dd86f`)

---

## 1. SYSTEM HEALTH MONITORING

### 1.1 Edge Health Probe
The primary health endpoint is publicly accessible and shielded from leaking internal server topology:
```powershell
curl -s https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/health
```
- Expected Status: HTTP 200
- Expected Payload: `{"status":"healthy","timestamp":<integer>}`
- Alert Trigger: Non-200 HTTP code or response latency exceeding 2,000 ms over 3 consecutive checks.

### 1.2 Database Connectivity Check
To confirm Cloudflare D1 query availability from the management CLI:
```powershell
npx wrangler d1 execute cortex-db --remote --command="SELECT count(*) as count FROM users;"
```

### 1.3 Cloudflare Worker Real-Time Logs
To tail live edge requests and uncaught errors:
```powershell
npx wrangler tail cortex-code-platform
```

---

## 2. EXAMINATION RUNTIME OPERATIONS

### 2.1 Pre-Examination Checklist (T-30 Minutes)
1. Verify system health returns HTTP 200.
2. Confirm no pending D1 migrations:
   ```powershell
   npx wrangler d1 migrations list cortex-db --remote
   ```
3. Take a pre-examination snapshot:
   ```powershell
   npx tsx scripts/run-production-backup.ts
   ```
4. Verify student access codes and join permissions are active.

### 2.2 Active Examination Window Operations (T-0 to T+End)
1. Monitor live proctoring dashboard (`/classroom/{roomId}/live/{sessionId}`).
2. Verify autosave latency remains under 300 ms across active candidates.
3. Handle student network disconnects:
   - Candidates retain local IndexedDB storage of answers.
   - Upon reconnection within the 30-second grace window, offline responses are flushed automatically.
   - In case of client hardware failure, candidate sessions can be resumed on a replacement machine using student credentials without loss of submitted state.

### 2.3 Post-Examination Operations (T+15 Minutes)
1. Lock examination to disallow subsequent submissions:
   ```powershell
   # Instructor triggers via UI or API endpoint
   POST /api/v1/classrooms/{id}/exams/{examId}/publish {"status":"closed"}
   ```
2. Trigger automated scoring for objective questions (MCQ, Multi-Select, Numerical).
3. Notify instructors that manual grading is open for subjective questions.
4. Take a post-examination database backup for archival.

---

## 3. SCHEDULED MAINTENANCE & BACKUPS

### 3.1 Daily Backup Routine
Backups are archived into `backups/d1/` with cryptographic SHA-256 manifests. The automated manager keeps the 10 most recent backups and prunes older artifacts:
```powershell
npx tsx scripts/run-production-backup.ts
```

### 3.2 Backup Integrity Audits (Weekly)
Verify that exported SQL files can restore cleanly into an isolated SQLite database without foreign key errors:
```powershell
npx tsx scripts/cortex-d1-backup.ts --action=verify --database=cortex-db --allow-production
```

---

## 4. DEPLOYMENT & UPGRADE PROCEDURES

Production deployments must follow strict fail-closed guardrails:
1. All changes must pass TypeScript linting and build validation:
   ```powershell
   npm run lint
   npm run build:vinext
   ```
2. Inspect `dist/server/wrangler.json` to confirm `cortex-code-platform` and `cortex-db`.
3. Apply schema migrations if pending:
   ```powershell
   npx wrangler d1 migrations apply cortex-db --remote
   ```
4. Deploy with authorization flags:
   ```powershell
   $env:ALLOW_PRODUCTION_DEPLOY="true"; node scripts/deploy-production.mjs --allow-production
   ```
5. Execute post-deployment smoke test:
   ```powershell
   $env:ALLOW_PRODUCTION_SMOKE="true"; npx tsx scripts/test-phase4-production-smoke.ts --target=production
   ```
