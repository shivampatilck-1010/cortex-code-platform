# Cortex Online Examination System — Phase 3.9 Operational Monitoring, Telemetry & Incident Response Runbook

## 1. Purpose & Observability Architecture

The **Cortex Online Examination System** provides high-concurrency, low-latency online examinations. Operational reliability requires end-to-end observability, real-time health inspection, structured telemetry with sensitive-data masking, and actionable incident response procedures.

### Core Observability Pillars
1. **Active Probes**: HTTP endpoint `/api/v1/health` probing Cloudflare Workers edge nodes and Cloudflare D1 query health.
2. **Structured JSON Telemetry**: High-cardinality JSON logs emitted by `CortexLogger` with distributed correlation IDs (`x-request-id`), execution duration metrics (`latencyMs`), and recursive credential redaction.
3. **Live Proctoring Telemetry**: Bidirectional heartbeat ping mechanism tracking candidate connection status, focus shifts, and device state in real time.

---

## 2. Health Check Probe Specification (`/api/v1/health`)

The health probe is exposed at `GET /api/v1/health` with `no-store, no-cache` headers:

### Probe Response Payload
```json
{
  "status": "healthy",
  "timestamp": 1793435183439,
  "isoTime": "2026-10-31T08:26:23.439Z",
  "environment": "staging",
  "totalLatencyMs": 17,
  "version": "1.0.0-phase3.9",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 16,
      "reachable": true,
      "stats": {
        "userCount": 115,
        "examCount": 43,
        "sessionCount": 34
      }
    }
  }
}
```

### SLA & Threshold Criteria
* **Status `healthy` (HTTP 200)**: Database reachable, total latency < 2000ms.
* **Status `degraded` (HTTP 200)**: Database reachable, but latency exceeds 2000ms.
* **Status `unhealthy` (HTTP 503)**: Database query throws an exception or fails connection probe.

---

## 3. Structured Logging Architecture

The logging engine (`src/lib/classroom/logger.ts`) formats all log statements as single-line structured JSON objects:

```json
{
  "timestamp": 1793435183439,
  "isoTime": "2026-10-31T08:26:23.439Z",
  "level": "info",
  "message": "database_query_benchmark completed",
  "component": "health_monitor",
  "eventType": "database_query_benchmark",
  "outcome": "success",
  "latencyMs": 26,
  "correlationId": "probe_corr_test_999"
}
```

### Sensitive Data Masking Policy
`redactSensitiveData()` recursively inspects log attributes. Any key matching credentials, hashes, session tokens, SEB keys, or question answer keys is replaced with `"[REDACTED]"`. Bearer authentication headers are sanitized via pattern replacement.

---

## 4. Operational Alerting Thresholds

| Metric | Warning Threshold | Critical Threshold | Automated Action |
| :--- | :--- | :--- | :--- |
| **HTTP 5xx Error Rate** | > 1.0% over 5m | > 5.0% over 2m | Trigger PagerDuty Sev-1, initiate Runbook A |
| **Health Probe Latency** | > 200ms | > 1000ms / 503 | Page Database on-call, test D1 read/write |
| **Autosave P95 Latency** | > 800ms | > 2500ms | Notify proctors, throttle non-essential queries |
| **Rate Limiter (429) Spike** | > 30/min from single IP | > 200/min across IPs | Cloudflare WAF block IP / ASN |
| **Heartbeat Misses** | > 5% of candidates | > 15% of candidates | Announce network check, extend exam time |

---

## 5. Incident Response Protocols

### Scenario A: Cloudflare D1 Database Outage / 503 Probe Failures
1. **Triage**: Confirm probe failure on `/api/v1/health` and verify Cloudflare Status Dashboard.
2. **Mitigation**:
   * Activate maintenance mode banner.
   * Client-side runner automatically detects disconnection, prevents submission, and holds student answers in `localStorage` buffer.
3. **Recovery**:
   * If database corruption occurred, initiate D1 time-travel restore:
     ```bash
     npx wrangler d1 time-travel restore cortex-staging-db --timestamp="YYYY-MM-DDTHH:MM:SSZ"
     ```
   * As soon as `/api/v1/health` returns HTTP 200, disable maintenance mode. Client browsers reconnect and flush queued answers.

### Scenario B: Elevated API Latency (> 1500ms) or Worker Throttling
1. **Triage**: Check Cloudflare Analytics for CPU time spikes and subrequest counts.
2. **Mitigation**:
   * Verify D1 query performance and index usage.
   * Increase candidate autosave debounce from 750ms to 1500ms via Remote Config or update to distribute database writes.
3. **Escalation**: If edge isolate execution limits are reached, deploy fast rollback or provision additional Cloudflare Worker capacity.

### Scenario C: Credential Stuffing / Denial of Service (DoS) Flood
1. **Triage**: Monitor `/api/v1/auth/login` for elevated HTTP 429 and 401 logs.
2. **Mitigation**:
   * Review sliding window logs for offending IP ranges.
   * Add Cloudflare WAF IP Access Rule to block malicious ASNs/IP blocks.
   * Verify affected candidate accounts have triggered progressive lockout (15 minutes).

### Scenario D: Edge Regional Network Partition
1. **Triage**: Candidate telemetry flags offline state in a specific geographic cluster.
2. **Mitigation**:
   * Instruct affected students to remain in the browser tab. (Local buffer retains answers indefinitely).
   * Grant proactive 15-minute time extension to affected candidates via Teacher Live Dashboard.

### Scenario E: Active Examination Catastrophic Crash (Mid-Exam Freeze)
1. **Triage**: Proctor receives multiple simultaneous failure notifications.
2. **Execution**:
   * Proctor executes "Broadcast Announcement" via Live Classroom signaling students to pause.
   * Verify database consistency and restore service if needed.
   * Proctor clicks "Add Time Extension" (e.g. +20 minutes) across the classroom.
   * Students refresh browser. Server-authoritative state recovery restores exact session ID, attempt count, and answers saved prior to crash.
