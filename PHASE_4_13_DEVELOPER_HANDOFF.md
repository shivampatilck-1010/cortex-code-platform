# PHASE 4.13: DEVELOPER HANDOFF & SYSTEM ARCHITECTURE GUIDE

**Document Version**: 1.0.0  
**Project**: Cortex Online Examination System & Universal Code Platform  
**Target Environments**: 
- Production: `cortex-code-platform` (`cortex-db`, UUID `f756374b-0e9b-4112-b502-b703788dd86f`)
- Staging: `cortex-code-platform-staging` (`cortex-staging-db`, UUID `e6375738-d9b2-4c5a-a3e5-3a34e892f49d`)
**Date**: 2026-10-31  
**Classification**: Engineering Handoff Documentation (Strictly Zero Emojis)

---

## 1. System Architecture Overview

Cortex is built on a modern distributed edge architecture leveraging the Cloudflare developer ecosystem:
- **Application Engine**: Next.js 14 App Router compiled to Cloudflare Workers via `@cloudflare/next-on-pages` / Cloudflare Worker isolates.
- **Relational Persistence**: Cloudflare D1 (Distributed SQLite engine with multi-region read replicas).
- **State Coordination & Real-Time Signaling**: Cloudflare Durable Objects (`ClassroomRoomDO`) providing single-instance coordination per classroom.
- **Client IDE & Examination UI**: React 18, Tailwind CSS, Monaco Editor, and KaTeX for mathematical rendering.

---

## 2. Database Schema & Migration Lineage

The database schema spans 33 tables managed through an immutable sequential migration lineage:

| Migration | Name | Description | Key Tables Introduced |
| :--- | :--- | :--- | :--- |
| `0001` | Initial Schema | Users, classrooms, memberships, assignments | `users`, `classrooms`, `classroom_members`, `assignments` |
| `0002` | Professional Identity | Institutional email validation, department mapping | Updates to `users` |
| `0003` | Whiteboard & Presentation | Real-time classroom media persistence | `whiteboard_snapshots`, `presentations` |
| `0004` | Question Bank Library | Modular question authoring repository | `question_bank` |
| `0005` | Examination Core | Exam scheduling, sections, and snapshots | `exams`, `exam_sections`, `exam_questions` |
| `0006` | Examination Sessions | Candidate attempt lifecycle and scoring | `exam_sessions`, `exam_question_responses` |
| `0007` | Adaptive Branching | Dynamic branching rules and paths | `exam_branch_rules` |
| `0008` | Safe Exam Browser (SEB) | Cryptographic BEK and quit password storage | Updates to `exams`, `exam_integrity_events` |
| `0009` | Distributed Rate Limiting | D1 rate limiting fallbacks across isolates | `classroom_rate_limits` |

All migrations (0001 through 0009) have been applied with 0 schema drift on `cortex-staging-db` and production `cortex-db`.

---

## 3. Examination Lifecycle State Machine

```
[Draft] ---> [Published] ---> [Student Starts Attempt] ---> [In Progress]
                                                                  |
                +-------------------------------------------------+
                | (Periodic Autosaves & Network Buffering)
                v
[Deadline Expiry (T_exp)]
        |
        +---> [Active 30s Grace Window] (Network Transit Only)
        |           |
        |           +---> [Submit Received <= T_exp + 30s] ---> [Status: submitted]
        |
        +---> [Post-Grace Expiry > T_exp + 30s]
                    |
                    +---> [Submit Received > T_exp + 30s]  ---> [Status: timed_out]
                                                                       |
+----------------------------------------------------------------------+
|
v
[Auto-Grading Engine] (MCQ, True/False, Numerical scored)
        |
        +---> Objective Only: [Score Computed]
        |
        +---> Has Subjective: [Status: Pending Manual Grading]
                    |
                    v
            [Teacher Manual Review] (Short Answers & Coding scored)
                    |
                    v
            [Score Publication] ---> [Student Scorecard & Analytics Generated]
```

---

## 4. Security & Cryptographic Implementation Reference

### 4.1 Safe Exam Browser Verification (`src/lib/classroom/seb-security.ts`)
- Verification follows the official SEB protocol:
  $$\text{X-SafeExamBrowser-RequestHash} = \text{SHA256}(\text{RequestURL} + \text{BrowserExamKey})$$
  $$\text{X-SafeExamBrowser-ConfigKeyHash} = \text{SHA256}(\text{RequestURL} + \text{ConfigKey})$$
- Request URLs are canonicalized: standard ports (80/443) stripped, trailing slashes handled bidirectionally, and forwarded host headers strictly checked against trusted domain whitelists.
- Hash comparison uses constant-time byte buffer comparison (`crypto.timingSafeEqual`) to eliminate timing side-channel leakage.

### 4.2 Logging & Credential Redaction (`src/lib/classroom/logger.ts`)
- Structured JSON output with correlation IDs.
- Deep object-level and string-level masking for passwords, authorization tokens, cookies, answer keys, and student response text.

---

## 5. Development & Testing Commands

```bash
# Execute TypeScript validation (0 type errors)
npm run lint

# Run Unit & Database Integration Tests
npx tsx scripts/test-phase4-9-network-integrity.ts
npx tsx scripts/test-phase4-10-seb-security.ts
npx tsx scripts/test-phase4-11-full-regression.ts
npx tsx scripts/test-phase4-12-monitoring-logging.ts

# Run Live Staging Benchmarks (Requires Staging Deployment)
$env:TEST_TARGET_URL="https://cortex-code-platform-staging.cortexbuild1.workers.dev"
npx tsx scripts/test-phase4-8-performance-benchmarks.ts
npx tsx scripts/test-phase4-deadline-offline-consistency.ts

# Deploy to Cloudflare Staging
npx wrangler deploy --env staging

# Inspect Staging Database
npx wrangler d1 execute cortex-staging-db --env staging --remote --command="SELECT COUNT(*) FROM users;"
```

---

## 6. Known Limitations & Conditional Prerequisites

1. **Track B: WebRTC TURN Relay**:
   - Status: **CONDITIONALLY VERIFIED**.
   - Condition: STUN peer-to-peer signaling operates out-of-the-box (`stun:stun.l.google.com:19302`). Symmetric NAT traversal requires provisioning the `CORTEX_TURN_SECRET` secret in Cloudflare for RFC 5766 dynamic ephemeral token generation.
2. **Physical Safe Exam Browser Desktop Launching**:
   - Status: **CONDITIONALLY VERIFIED**.
   - Condition: Cryptographic verification, headers validation, and `.seb` Apple Plist export are 100% verified. Physical execution requires the examinee to download and launch the Safe Exam Browser client on their physical workstation.
