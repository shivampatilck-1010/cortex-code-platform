# CORTEX ONLINE EXAMINATION SYSTEM
# FINAL OPERATIONS & MAINTENANCE HANDBOOK

**Target Audience**: DevOps Engineers, SREs, University IT Infrastructure Staff  
**Document Version**: 1.0.0  
**Date**: 2026-10-31  

---

## 1. Routine Operational Procedures

### 1.1 Daily Pre-Exam Readiness Checklist
1. Query public health probe:
   ```bash
   curl -s https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/health
   ```
   Ensure `{ status: "ok" }` and database latency $< 150\text{ms}$.
2. Verify pending migration state:
   ```bash
   npx wrangler d1 migrations list cortex-db --remote
   ```
   Ensure 0 pending migrations exist.
3. Review active candidate sessions:
   ```bash
   npx wrangler d1 execute cortex-db --remote --command="SELECT status, COUNT(*) FROM exam_sessions GROUP BY status;"
   ```

### 1.2 Automated Remote D1 Database Backups
Execute daily offsite backup prior to peak examination windows:
```powershell
npx tsx scripts/run-production-backup.ts
```
Backups are exported as raw SQL files with SHA-256 checksums and stored under `backups/production/`.

---

## 2. Emergency Operational Interventions

### 2.1 Fast Worker Version Rollback
If a regression occurs post-deployment:
```powershell
npx wrangler rollback --version <STABLE_VERSION_ID>
```
Rollback takes effect at the Cloudflare edge in $< 5\text{ seconds}$.

### 2.2 Extending Exam Window for Affected Candidates
If a university connectivity failure occurs:
```sql
UPDATE exam_sessions
SET expires_at = expires_at + (30 * 60 * 1000), updated_at = unixepoch() * 1000
WHERE exam_id = '<EXAM_ID>' AND status = 'in_progress';
```
Examinee clients dynamically synchronize the extended deadline on the next heartbeat.
