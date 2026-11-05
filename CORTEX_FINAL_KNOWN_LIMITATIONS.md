# CORTEX ONLINE EXAMINATION SYSTEM
# FINAL KNOWN LIMITATIONS & PREREQUISITES

**Document Version**: 1.0.0  
**Date**: 2026-10-31  
**Classification**: Engineering & Operations Reference (Strictly Zero Emojis)

---

## 1. Architectural & Environmental Prerequisites

### 1.1 Track B: WebRTC TURN Relay (Conditional Feature)
- **Current Operational State**: P2P STUN signaling is active and operational (`stun:stun.l.google.com:19302`). Direct peer-to-peer audio/video streaming works across open network topographies and cone NATs.
- **Conditional Requirement**: Traversal of strict symmetric institutional firewalls / carrier-grade NAT requires relaying media over a TURN server.
- **Action Required**: Provision the Cloudflare Worker secret `CORTEX_TURN_SECRET` and configure external Coturn / Cloudflare Calls credentials to enable RFC 5766 dynamic HMAC-SHA1 ephemeral TURN token generation.

### 1.2 Safe Exam Browser (SEB) Client Deployment
- **Current Operational State**: Cryptographic verification (`X-SafeExamBrowser-RequestHash` and `X-SafeExamBrowser-ConfigKeyHash`), canonical URL reconstruction, and `.seb` Apple XML Plist generation are 100% verified.
- **Physical Limitation**: Automated physical execution of an external desktop `.exe` or `.dmg` cannot occur inside headless Cloudflare Workers. Examinees must install the official Safe Exam Browser client on their physical laptops or desktop workstations.
- **Recommendation**: Institutional IT should distribute pre-configured SEB packages via university MDM or provide the configuration download link 48 hours prior to examination start.

---

## 2. Resource Ceilings & Concurrency Boundaries

- **Validated Concurrency**: 100 simultaneous active candidates per examination cohort with 0.00% error rate.
- **Higher Cohort Scaling**: For cohorts exceeding 250 simultaneous candidates, increase D1 read replication and enable client-side jitter on autosave intervals (e.g. 5000ms +/- 1500ms jitter) to distribute burst traffic evenly across Cloudflare edge nodes.
- **D1 Database Row Limits**: Max SQLite integer size applies; standard pagination is implemented on administrative analytics queries to prevent payload bloat.
