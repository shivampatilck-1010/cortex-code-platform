# Cortex Classroom — Architecture & Repository Audit

## Executive Summary
This document provides the foundational architecture audit for integrating the complete **Cortex Classroom** real-time educational platform into the existing Cortex Cloud IDE and compiler ecosystem.

---

## 1. Current Architecture

### 1.1 Application Framework & Entrypoints
- **Framework**: Next.js 15.2.0 with React 19 (App Router in `/src/app`)
- **Compilation & Bundling**: Next.js with SWC/Webpack, Node.js 22.23.2 runtime
- **Edge Deployment Target**: Cloudflare Workers / Pages via `@vinext/cloudflare` (`wrangler.jsonc`)
- **Main App Entrypoints**:
  - `/` — Online Cloud IDE (Monaco Editor, multi-language compiler, test runner, AI auto-fix)
  - `/[compiler]` — SEO dynamic compiler landing pages (Python, C++, Java, Rust, Go, etc.)
  - `/challenges` & `/challenges/[id]` — Algorithmic programming challenges
  - `/learn` & `/learn/[courseId]` — Interactive programming courses
  - `/compare` — Multi-language benchmarking suite
  - `/dashboard` — Developer execution and analytics dashboard
  - `/admin` — System status and administrative overview
  - `/classroom` & `/classroom/[roomId]` — Classroom arena / collaborative workspace

### 1.2 Existing Execution Architecture
- **Endpoint**: `/api/v1/execute`
- **Supported Languages**: 16+ languages (Python, C++, C, Java, JavaScript, TypeScript, Rust, Go, SQL, Bash, PHP, Ruby, etc.)
- **Execution Engine**: Local container sandbox with strict CPU, memory (128MB default), timeout (5000ms default), and process isolation
- **Format**: Returns JSON with `{ status, exitCode, stdout, stderr, execution_time, memory, diagnostics }`

### 1.3 Existing AI Architecture
- **Endpoints**:
  - `/api/v1/ai/chat` — AI assistant for coding queries
  - `/api/v1/ai/autofix` — Automated code error correction with unified diff generation
  - `/api/v1/ai/suggest` — Real-time contextual code completions
  - `/api/v1/ai/verify-key` — API key validation
- **Backend Provider**: Server-side Google Gemini API (`@google/genai` / server proxy) with client key override capability

### 1.4 Existing Classroom State & Real-Time Setup
- **Current State**: Initial 2-user collaborative workspace prototype located in `/src/app/classroom` and `/src/lib/classroom`.
- **Strengths**: Contains CRDT Yjs synchronizer (`collab-sync.ts`), WebSocket transport protocol definitions (`protocol.ts`), and SSE event streamer (`/api/v1/classroom/[roomId]/events/route.ts`).
- **Gaps to Address**:
  - Lacks multi-role relational entities (Teachers vs Students, Classroom membership, invites, attendance, grading, rubrics, submissions, announcements, and resources).
  - Lacks assignment test case runner and auto-grader pipeline.
  - Lacks event resynchronization / sequence replay for network drops.
  - Relied on ephemeral in-memory records without relational schema persistence.

---

## 2. Reusable Components & Modules
The following battle-tested Cortex systems will be reused directly:
1. **Monaco Editor Component**: High-performance editor with theme bindings, diagnostics markers, and diff editors.
2. **Code Execution Pipeline (`/api/v1/execute`)**: Used by the submission test runner to compile and execute student code against public and hidden test cases securely.
3. **Gemini AI Auto-Fix & Error Explainer**: Bound to teacher-configurable AI policies (Full AI, Hints Only, Explain Errors Only, Disabled).
4. **Cortex Design System**: Tailored dark-mode UI with `#0b0c0e` canvas, `#141518` elevated containers, `#ff9100` signature accents, and Lucide icons.
5. **Real-time Event Transport (`protocol.ts` & SSE / WebSockets)**: Extended to support structured classroom event messages.

---

## 3. Required Changes & Upgrades

1. **Relational Data Model & Storage Engine**:
   - Implement an ACID relational database (`/src/lib/classroom/db/`) supporting full persistence for Classrooms, Members, Assignments, Submissions, Grades, Announcements, Attendance, Messages, Resources, and Events.
   - Built with transactional consistency, auto-generated sequence IDs, and foreign key relations.

2. **Authentication & Authorization Guard**:
   - Session & token manager with verifiable role permissions (`teacher`, `student`, `admin`).
   - Server-side authorization verifying classroom membership, resource ownership, and assignment deadlines on every request.

3. **Multi-Tab Classroom Navigation**:
   - Stream (announcements, feed)
   - Assignments (builder, test cases, code workspace, submit pipeline)
   - Code Lab (live collaborative session, teacher code broadcasting, student workspaces)
   - Grades & Feedback (rubrics, manual review, grade release)
   - People & Attendance (active roster, presence, roll call check-in)
   - Resources (organized by units/weeks)
   - Leaderboard & Analytics (class performance, pass rates, risk signals)
   - Settings (policies, join codes, permissions)

4. **Real-Time Event Engine**:
   - Event broadcast mechanism with persistent sequence logging (`ClassroomEvents`).
   - Client reconnection protocol with sequence catchup (`RESYNC`) to prevent state desynchronization.
   - Real-time indicator (`● Live`, `↻ Reconnecting`, `○ Offline`).

5. **Assignment Execution & Auto-Grading Pipeline**:
   - Automated test runner iterating through test cases (public and hidden).
   - Strict time and memory limit enforcement.
   - Partial score computation, weighted grading, and rubric attachment.

---

## 4. Risks & Mitigation Strategies

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Hidden test case leakage** | Critical academic integrity compromise | Separate public test cases from hidden test cases on the server; never transmit hidden inputs/outputs to student clients. |
| **Network disconnection during live session** | Missed announcements or code edits | Incremental event sequence logging with automatic client reconnect and replay. |
| **Infinite loops or resource exhaustion in student submissions** | Server degradation | Enforce strict per-process execution limits (timeout: 5s, memory: 128MB) in sandbox runner. |
| **Stale React renders on frequent updates** | Inconsistent UI state | Scoped event handlers updating only the affected slice (e.g. `assignment.created` only updates assignments list). |

---

## 5. Cloudflare & Edge Deployment Compatibility
- Database abstraction designed to support both Node.js environment (local/Cloud Run) and Cloudflare D1 / Durable Objects via unified SQL/ORM interface.
- SSE and WebSocket handlers structured with native `WebSocketPair` and standard HTTP streams for seamless zero-downtime execution.
