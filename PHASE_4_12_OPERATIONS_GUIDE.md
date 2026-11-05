# PHASE 4.12: SYSTEM OPERATIONS & OBSERVABILITY GUIDE

**Audience**: DevOps, University Sysadmins, SREs  
**Date**: 2026-10-31  

---

## 1. Cloudflare Edge Architecture & Endpoints

- **Platform Runtime**: Cloudflare Workers (Edge V8 isolates)
- **Database Layer**: Cloudflare D1 (Distributed SQLite)
- **Primary Production URL**: `https://cortex-code-platform.cortexbuild1.workers.dev`
- **Staging URL**: `https://cortex-code-platform-staging.cortexbuild1.workers.dev`
- **Public Health Endpoint**: `/api/v1/health`
- **Privileged Diagnostics Endpoint**: `/api/v1/health/internal`

---

## 2. Telemetry & Log Monitoring

### Log Sampling via Wrangler Tail
To monitor real-time production or staging traffic:
```bash
# Monitor staging logs
npx wrangler tail --name cortex-code-platform-staging

# Filter for error-level structured events
npx wrangler tail --name cortex-code-platform-staging --format=json | jq 'select(.level=="error")'
```

### Key Performance Indicators & Alert Thresholds
1. **Autosave Latency**: p95 $< 3000\text{ms}$; alert if p95 $> 5000\text{ms}$ over 3 consecutive minutes.
2. **HTTP Error Rate**: Alert if 5xx responses exceed 1% over a 5-minute evaluation window.
3. **Database Health Latency**: Probe latency $< 150\text{ms}$; alert if probe latency $> 800\text{ms}$.
4. **WebSocket Connection Drop Rate**: Alert if reconnect disconnect storm occurs during exam starts.
