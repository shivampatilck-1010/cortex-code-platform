# Project: Cortex Live Classroom Overhaul

## Architecture
The Live Classroom system transforms into a production-grade, Google Meet-class collaborative workspace utilizing Cloudflare Edge (Workers & Durable Objects) and client-side P2P WebRTC mesh:
1. **Signaling & Edge Layer (`ClassroomRoomDO`)**:
   - Cloudflare Workers WebSocket Hibernation API (`state.acceptWebSocket`) for zero-cost, persistent multi-client room routing.
   - Targeted unicast routing for WebRTC signaling envelopes (`WEBRTC_OFFER`, `WEBRTC_ANSWER`, `WEBRTC_ICE_CANDIDATE`).
   - In-memory authoritative snapshot caching and atomic catch-up hydration for late joiners (`SESSION_HYDRATION_SNAPSHOT`).
2. **WebRTC Media & Adaptive Stage Grid (`ClassroomContext` & `MeetingStageModule`)**:
   - W3C Perfect Negotiation state machine with deterministic politeness (`isPolite = myUserId.localeCompare(peerId) > 0`) and rollback.
   - Asynchronous ICE candidate buffer queue (`iceCandidateQueue`).
   - Real media stream attachment to `<video autoPlay>` and mounted `<audio autoPlay>` elements (preventing self-echo via `muted={true}` on local video).
   - Dynamic track replacement (`sender.replaceTrack()`) for seamless camera toggle and screen share focus.
   - Web Audio API RMS energy meter for dynamic active speaker highlighting.
   - Responsive Google Meet-class stage grid (1, 2, 3-4, 5-9 participants, screen share stage + filmstrip).
3. **Collaborative Code & Whiteboard Synchronization**:
   - Monaco Editor CRDT: Yjs binary updates (`Y.applyUpdate`, `Y.encodeStateAsUpdate`) over WebSocket, multi-cursor awareness, and Follow Instructor viewport lock.
   - Vector Whiteboard: Incremental stroke streaming (`STROKE_START`, `STROKE_POINT` 16ms rAF, `STROKE_END`) and conflict-free shape deltas.
4. **Access Resilience & Ephemeral Guest Gating**:
   - Automatic ephemeral guest provisioning (`Guest Student [ID]`) to eliminate 401/403 blocks on shared links.
   - Case-insensitive classroom ID normalization (`cs-201` -> `CS-201`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | DO WebSocket Hibernation | Implement `state.acceptWebSocket()` and hibernation lifecycle handlers in `ClassroomRoomDO` | M1 | Survey (Explorer 1) |
| 2 | Unicast WebRTC Signaling | Targeted routing of `WEBRTC_OFFER`, `WEBRTC_ANSWER`, `WEBRTC_ICE_CANDIDATE` to `targetUserId` | M1 | Survey (Explorer 1) |
| 3 | Atomic State Hydration Snapshot | Dispatch snapshot containing code Yjs state vector, whiteboard canvas, active slide, and AV presence on `JOIN_CLASSROOM` | M1 | Survey (Explorer 1) |
| 4 | Database Schema Repair | Fix `live_sessions` SQLite schema in D1 to support `state_json` or persistent snapshot state without throwing SQLite errors | M1 | Survey (Explorer 1) |
| 5 | Ephemeral Guest Provisioning | Auto-generate guest student identity (`Guest Student [ID]`) with valid token when unauthenticated user joins | M2 | Survey (Explorer 1) |
| 6 | URL Normalization | Case-insensitive classroom routing and session identifier normalization across Worker, routes, and client | M2 | Survey (Explorer 1) |
| 7 | Frictionless Link Access | Eliminate 401/403 barrier in Worker pre-upgrade and session route for unauthenticated public links | M2 | Survey (Explorer 1) |
| 8 | W3C Perfect Negotiation | Implement deterministic politeness, collision detection, and rollback on `RTCPeerConnection` to eliminate offer glare | M3 | Survey (Explorer 2) |
| 9 | Asynchronous ICE Queuing | Buffer ICE candidates in `iceCandidateQueue` until `setRemoteDescription` resolves, preventing dropped candidates | M3 | Survey (Explorer 2) |
| 10 | Dynamic STUN/TURN Fallback | Fetch authoritative ICE servers dynamically with public STUN and TURN fallback support | M3 | Survey (Explorer 2) |
| 11 | Dynamic Track Hot-Swapping | Support seamless mute/unmute via `track.enabled` and screen sharing via `sender.replaceTrack()` without glare | M3 | Survey (Explorer 2) |
| 12 | Real Audio/Video Binding | Mount real `<video>` elements in grid and unmuted `<audio>` elements for remote streams with local self-mute | M4 | Survey (Explorer 2) |
| 13 | Web Audio Active Speaker Detection | Attach `AudioContext` and `AnalyserNode` to calculate RMS energy every 100ms; pulse border on speaking | M4 | Survey (Explorer 2) |
| 14 | Google Meet Adaptive Grid Math | Dynamic responsive layout (1, 2, 3-4, 5-9 participants) with 16:9 aspect-ratio preservation | M4 | Survey (Explorer 2) |
| 15 | Screen Share Presentation Layout | 80% stage viewport for active screen share with right-rail filmstrip carousel for participants | M4 | Survey (Explorer 2) |
| 16 | Tile Pinning & In-Meeting Controls | Pin participant to stage, camera/mic toggles, raise hand indicator, and connection status | M4 | Survey (Explorer 2) |
| 17 | Monaco Yjs CRDT Binding | Connect Monaco editor to shared `Y.Doc` and `Y.Text` via `bindMonacoToYDoc` | M5 | Survey (Spec Miner 3) |
| 18 | CRDT Binary Update Protocol | Stream binary Yjs updates (`Y.applyUpdate`, `Y.encodeStateAsUpdate`) over WebSocket, terminating `BroadcastChannel` reliance | M5 | Survey (Spec Miner 3) |
| 19 | Multi-Cursor & Nametag Awareness | Propagate collaborator carets, selections, and color-coded nametag tooltips across peers | M5 | Survey (Spec Miner 3) |
| 20 | Follow Instructor Mode | Synchronize instructor's active file tab, scroll line, and cursor position to student viewers | M5 | Survey (Spec Miner 3) |
| 21 | Dual Workspace Segregation | Maintain Teacher Authoritative Broadcast view vs Student Private Scratchpad with copy demo capability | M5 | Survey (Spec Miner 3) |
| 22 | Whiteboard Stroke Delta Streaming | Stream incremental vector strokes (`STROKE_START`, `STROKE_POINT` 16ms rAF, `STROKE_END`) | M6 | Survey (Spec Miner 3) |
| 23 | Conflict-Free Shape Updates | Transmit element-level patches for move, resize, and color changes instead of monolithic canvas JSON | M6 | Survey (Spec Miner 3) |
| 24 | In-Flight Stroke 60fps Rendering | Render active drawing path on remote student canvases in real time during pen movement | M6 | Survey (Spec Miner 3) |
| 25 | Authoritative Canvas Snapshotting | Cache whiteboard state in Durable Object memory/storage and hydrate late-joining participants | M6 | Survey (Spec Miner 3) |
| 26 | Automated E2E Mesh & CRDT Test Suite | Implement automated test harness for WebRTC connection, CRDT convergence, and whiteboard streaming | Test Track / M7 | Survey (Spec Miner 3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Signaling & DO Hibernation Engine | Durable Object WebSocket hibernation, targeted unicast signaling routing, atomic session hydration, D1 schema fix | none | DONE (convId: fbf58466-c7ee-4820-ad3e-dea41bc70a23, verified clean) |
| M2 | Resilient Access & Ephemeral Guest Gating | Ephemeral guest identity provisioning, 401/403 bypass for valid session links, URL normalization | M1 | IN_PROGRESS (gen2 convId: 3e6e9f72-133a-45e9-bc16-920a660ab335) |
| M3 | W3C Perfect Negotiation & Media Mesh | W3C Perfect Negotiation, deterministic politeness, ICE candidate queuing, dynamic STUN/TURN, track replacement | M1 | IN_PROGRESS (gen2 convId: 85b7b561-ff99-43d7-b07c-f092d2bc0d32) |
| M4 | Adaptive Stage Grid & Audio Pipeline | ParticipantVideoTile with real `<video>` and mounted `<audio>`, Web Audio active speaker detection, Google Meet adaptive grid math, presentation stage | M3 | PLANNED |
| M5 | Monaco Editor Yjs CRDT Synchronization | Connect Monaco to Yjs CRDT binary updates via WebSocket, multi-cursor awareness, Follow Instructor viewport sync | M1 | IN_PROGRESS (gen2 convId: e70c0945-6fcd-4709-8629-349341dc72d6) |
| M6 | Delta-Encoded Vector Whiteboard Sync | Incremental stroke streaming (start, points, end), element-level deltas, in-flight 60fps rendering, DO snapshot catch-up | M1 | IN_PROGRESS (gen2 convId: 4ee0c91f-52b5-4fab-aaf9-fdf85a0affc5) |
| M7 | Final Integration & Multi-Client Verification | Pass 100% of E2E test suite (Tiers 1-4), adversarial coverage hardening (Tier 5), build & typecheck validation | M1, M2, M3, M4, M5, M6, Test Track | PLANNED |

## E2E Testing Track (Parallel)
| Track | Scope | Deliverable | Status |
|-------|-------|-------------|--------|
| E2E Testing Track | Independent requirement-driven opaque-box test suite: WebRTC mesh negotiation, CRDT concurrent editing convergence, whiteboard delta streaming, guest access, and reconnection hydration | `TEST_INFRA.md` & `TEST_READY.md` | DONE (convId: b662e622-722a-430f-b33d-2325c56412af, 57 tests passing) |

## Interface Contracts

### M1 ↔ M3: WebRTC Signaling Brokerage Contract
- **Envelopes**:
  - `WEBRTC_OFFER`: `{ targetUserId: string, sdp: string, type: 'offer', senderId: string }`
  - `WEBRTC_ANSWER`: `{ targetUserId: string, sdp: string, type: 'answer', senderId: string }`
  - `WEBRTC_ICE_CANDIDATE`: `{ targetUserId: string, candidate: RTCIceCandidateInit, senderId: string }`
- **Routing**: `ClassroomRoomDO` checks `targetUserId` and delivers strictly to the matching WebSocket connection. If `targetUserId` not found, drops packet safely without throwing.

### M1 ↔ M5: Monaco CRDT Update Contract
- **Envelopes**:
  - `MONACO_CRDT_UPDATE`: `{ fileId: string, update: string /* base64 uint8Array */, senderId: string }`
  - `MONACO_AWARENESS_UPDATE`: `{ fileId: string, awarenessData: string /* base64 uint8Array */, senderId: string }`
  - `TEACHER_EDITOR_VIEWPORT`: `{ fileId: string, lineNumber: number, column: number, scrollTop: number }`
- **DO Handler**: `ClassroomRoomDO` applies binary update to its cached `Y.Doc` for `fileId` via `Y.applyUpdate(ydoc, update, senderId)` and broadcasts to other participants.

### M1 ↔ M6: Vector Whiteboard Delta Streaming Contract
- **Envelopes**:
  - `WHITEBOARD_STROKE_START`: `{ strokeId: string, tool: string, color: string, strokeWidth: number, strokeDash?: number[], startPoint: { x: number, y: number }, pageIndex: number, senderId: string }`
  - `WHITEBOARD_STROKE_POINT`: `{ strokeId: string, points: Array<{ x: number, y: number, pressure?: number }>, pageIndex: number }`
  - `WHITEBOARD_STROKE_END`: `{ strokeId: string, element: WhiteboardElement, pageIndex: number }`
  - `WHITEBOARD_ELEMENT_DELTA`: `{ action: 'UPDATE' | 'DELETE', elementId: string, patch?: Partial<WhiteboardElement>, elementIds?: string[], pageIndex: number }`
- **Hydration**: On `JOIN_CLASSROOM`, DO sends `WHITEBOARD_SNAPSHOT` containing all pages and elements.

### M2 ↔ Client Gating Contract
- **Guest Identity**:
  - Unauthenticated access to `/classroom/[roomId]/live/[sessionId]` automatically provisions `Guest Session { userId: 'guest_[random]', displayName: 'Guest Student [random]', role: 'student', isGuest: true }`.
  - Generates signed session token accepted by `src/worker.ts` WebSocket upgrader.

### M3 ↔ M4: Media Stream Delivery Contract
- **Context API (`useClassroom()`)**:
  - `remoteStreams: Map<string, MediaStream>` (maps `peerId` to active `MediaStream` containing audio and video tracks).
  - `remoteAudioLevels: Map<string, number>` (maps `peerId` to sampled RMS audio level 0-100).
  - `activeSpeakerId: string | null` (dynamically updated by audio energy meter with 1.5s hysteresis).
  - `screenShareStream: MediaStream | null` and `activeScreenSharePeerId: string | null`.

## Code Layout
```
src/
├── app/
│   ├── api/v1/classrooms/[id]/
│   │   ├── live/
│   │   │   ├── session/route.ts       (M2: Guest token generation & session route)
│   │   │   └── ice-servers/route.ts   (M3: Dynamic STUN/TURN fallback credentials)
│   │   └── whiteboard/route.ts        (M6: Whiteboard snapshot persistence API)
│   └── classroom/[roomId]/live/[sessionId]/
│       ├── page.tsx                   (M2: URL normalization & page wrapper)
│       └── LiveClassroomClient.tsx    (M2: Guest entry & classroom shell)
├── components/live-class/
│   ├── context/
│   │   └── ClassroomContext.tsx       (M3: Perfect Negotiation, ICE queue, track hot-swapping)
│   └── modules/
│       ├── codestudio/
│       │   └── CodeStudioModule.tsx   (M5: Yjs Monaco CRDT binding, multi-cursor, follow mode)
│       ├── meeting/
│       │   ├── MeetingStageModule.tsx (M4: Stage orchestration, Google Meet adaptive grid)
│       │   └── ParticipantVideoTile.tsx (M4: Real <video> + unmuted <audio>, active speaker pulse)
│       └── whiteboard/
│           └── WhiteboardModule.tsx   (M6: Incremental stroke streaming & canvas sync)
├── lib/classroom/
│   ├── auth.ts                        (M2: Ephemeral guest authentication & token signing)
│   ├── db/index.ts                    (M1: D1 database schema and persistence fixes)
│   ├── durable-object.ts              (M1: Cloudflare DO WebSocket hibernation & signaling broker)
│   ├── ice-servers.ts                 (M3: Authoritative STUN/TURN configuration)
│   ├── protocol.ts                    (M1: Message types & signaling envelope definitions)
│   ├── whiteboard-sync.ts             (M6: Delta stroke serialization & protocol helpers)
│   └── yjs-binding.ts                 (M5: Monaco Yjs binding & remote cursor styles)
├── worker.ts                          (M1, M2: URL normalization, WebSocket upgrade, guest bridge)
tests/
├── run-e2e.ts                         (Existing test runner)
└── live-classroom-mesh.ts             (Test Track: Headless multi-client WebRTC, CRDT & delta tests)
```
