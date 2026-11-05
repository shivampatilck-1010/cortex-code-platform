# CORTEX ONLINE EXAMINATION SYSTEM
# UNIVERSITY PILOT: ADMINISTRATOR & SRE HANDBOOK

Document Version: 1.0.0  
Target Audience: Department Heads, IT Administrators, Site Reliability Engineers  
Classification: Pilot Operational Documentation  
Platform: Cortex Online Examination System

---

## 1. PLATFORM ARCHITECTURE & ACCESS TIERS

The Cortex Online Examination System operates on a multi-tiered distributed edge architecture:
- Edge Ingestion & API Layer: Cloudflare Workers edge network.
- Relational Storage: Cloudflare D1 distributed database (`cortex-db` / `cortex-staging-db`).
- Coordination & State: Cloudflare Durable Objects (`ClassroomRoomDO`).
- Role-Based Access Control: `student`, `teacher`, `admin`.

---

## 2. PILOT SYSTEM HEALTH & TELEMETRY PROBES

### 2.1 Public Health Verification
External monitoring services probe the public health endpoint:
```powershell
curl -s https://cortex-code-platform-staging.cortexbuild1.workers.dev/api/v1/health
```
- Status: HTTP 200 OK
- Telemetry: Returns operational status and epoch timestamp while withholding sensitive internal server topology.

### 2.2 Database Audit & Migration History
Confirm that zero migrations are pending on the active database target:
```powershell
npx wrangler d1 migrations list cortex-staging-db --env staging --remote
```

---

## 3. PILOT ONBOARDING & PROVISIONING

### 3.1 Department and Faculty Onboarding
1. Provide authorized faculty members with the university teacher invite code (`cortex-prof-2026`).
2. Faculty accounts register at `/register` with their official university email (`@pilot.cortex.edu`).
3. Verify that new courses and join codes populate properly.

### 3.2 Audit Log Inspection
Administrative oversight includes inspecting candidate integrity events:
- Focus loss (`window_blur`)
- Fullscreen exits (`fullscreen_exit`)
- Client reconnections (`reconnect`)
- Proctor annotations (`proctor_action`)

Audit records are queried via the administrative database interface:
```sql
SELECT session_id, event_type, datetime(timestamp / 1000, 'unixepoch') as logged_at, details_json
FROM exam_integrity_events
ORDER BY timestamp DESC
LIMIT 50;
```

---

## 4. INCIDENT ESCALATION & RECOVERY PROTOCOLS

### 4.1 Candidate Hardware Failure
If a candidate's laptop or workstation fails during an examination:
1. Provide a replacement device at the testing center.
2. The candidate logs into Cortex with their credentials.
3. Upon clicking "Start Examination", the server resumes the existing active attempt, restoring all previously synchronized responses.

### 4.2 Edge Worker Rollback
In the event of an operational regression:
```powershell
npx wrangler rollback <stable-version-id> --config dist/server/wrangler.json -y
```
- Mean execution benchmark: 7.25 seconds.
