# TEST INFRASTRUCTURE SPECIFICATION: CORTEX LIVE CLASSROOM

## 1. Test Philosophy: Opaque-Box Requirement-Driven Testing

The Cortex Live Classroom testing infrastructure adheres strictly to an opaque-box, requirement-driven methodology. Tests validate system behavior, wire protocol compliance, state convergence, and interface contracts derived exclusively from user requirements (R1-R6) and architectural specifications in `ORIGINAL_REQUEST.md` and `PROJECT.md`.

Key tenets:
1. **Behavioral Invariance**: Tests exercise public interfaces, WebSocket protocol frames, WebRTC negotiation states, Yjs CRDT binary updates, and vector delta streams. Internal helper methods and implementation details are treated as opaque.
2. **Zero Facade / High-Fidelity Verification**: No synthetic pass-throughs or hardcoded results. Every assertion evaluates actual state transitions, mathematical calculations (e.g. RMS audio energy, bounding box geometry), or byte-level binary diffs.
3. **Hermetic & Deterministic Execution**: Multi-client interactions run in-memory with zero external cloud, browser binary, or external network dependencies, ensuring rapid (<5s), deterministic, and air-gapped CI/CD execution.
4. **Zero-Emoji Governance**: All test suites and documentation strictly enforce standard ASCII diagnostic badges (`[PASS]`, `[FAIL]`, `[RUN]`, `[OK]`, `[INFO]`) to comply with repository governance policies (TC4.1).

---

## 2. Feature Inventory Mapping

The testing harness provides end-to-end verification across all 9 core Live Classroom functional areas:

| Feature ID | Category | Feature Name | Specification Scope | Primary Assertions |
|------------|----------|--------------|---------------------|--------------------|
| F1 | WebRTC Signaling | W3C Perfect Negotiation | Deterministic politeness (`localeCompare`), glare collision resolution, rollback | No `InvalidStateError`, stable signaling state reached |
| F2 | WebRTC Signaling | ICE Candidate Handling & Queuing | Asynchronous candidate buffering before remote description, FIFO queue draining | Zero dropped candidates, candidates applied in FIFO order |
| F3 | WebRTC Media | Dynamic Track Hot-Swapping | Track muting via `track.enabled`, hardware camera replacement via `replaceTrack` | Zero SDP glare renegotiation, stream continuity |
| F4 | Stage Media | Web Audio Active Speaker Detection | RMS energy calculation ($\sqrt{\frac{1}{N} \sum x^2}$), threshold gating, 1.5s hysteresis | Speaking flag activation, smooth highlight persistence |
| F5 | Resilient Access | Ephemeral Guest Identity Gating | Auto-provisioning `Guest Student [ID]` and signed live session tokens for unauthenticated users | HTTP 200 session, valid HMAC signature, student role cap |
| F6 | Resilient Access | URL Routing & Normalization | Case-insensitive room ID normalization (`cs-201` -> `CS-201`), session ID routing | Single authoritative Durable Object instance binding |
| F7 | Collaborative Code | Monaco Editor Yjs CRDT Sync | Binary update protocol (`Y.applyUpdate`), state vector exchange, multi-cursor awareness | Byte-exact convergence across peers, zero lost keystrokes |
| F8 | Vector Whiteboard | Whiteboard Stroke Delta Streaming | 3-stage stroke protocol (`START`, 16ms rAF `POINT`, `END`), element patches, eraser | In-flight path streaming, delta patch application |
| F9 | State Catch-up | Authoritative Snapshot Hydration | In-memory DO state caching, atomic late-joiner catch-up snapshot (`SESSION_HYDRATION_SNAPSHOT`) | Immediate state recovery for newly joined participants |

---

## 3. Test Architecture & Directory Layout

The Live Classroom verification harness is integrated into the native `tsx` execution pipeline without heavyweight external browser automation dependencies.

```
universal-code-platform/
├── package.json                   # Scripts: "test", "test:e2e", "lint"
├── tsconfig.json                  # DOM + Node globals, clean typecheck
├── TEST_INFRA.md                  # Test architecture & methodology specification
├── src/
│   ├── components/live-class/     # Classroom UI, context, and media modules
│   └── lib/classroom/             # Edge signaling, protocol, auth, and Yjs bindings
└── tests/
    ├── run-e2e.ts                 # Master sequential multi-tier test runner
    ├── test-utils.ts              # TestHarness class, assertion primitives, emoji scanner
    ├── live-classroom-mesh.ts     # Live Classroom Multi-Client E2E Suite (Tiers 1-4)
    ├── tier1-feature-coverage.ts  # Base platform Tier 1 tests
    ├── tier2-boundary-corner.ts   # Base platform Tier 2 tests
    ├── tier3-cross-feature.ts     # Base platform Tier 3 tests
    └── tier4-governance-workload.ts # Repository governance & zero-emoji scanner
```

### Headless Multi-Client Virtual Mesh Architecture

To enable complete multi-client peer verification inside Node.js, `tests/live-classroom-mesh.ts` implements a high-fidelity virtual test harness:

1. **`VirtualClassroomEdge`**:
   - Simulates Cloudflare Durable Object WebSocket Hibernation.
   - Handles unicast signaling envelopes (`WEBRTC_OFFER`, `WEBRTC_ANSWER`, `WEBRTC_ICE_CANDIDATE`) with targeted delivery.
   - Caches authoritative Yjs documents and canvas snapshots.
   - Dispatches `SESSION_HYDRATION_SNAPSHOT` upon peer connection.
2. **`HeadlessParticipant`**:
   - Represents an autonomous client peer (Teacher, Student 1, Student 2, Late Joiner).
   - Manages local `Y.Doc`, local whiteboard canvas state, and active peer connections.
   - Connects to the virtual edge via bi-directional event emitters simulating WebSocket pairs.
3. **`MockRTCPeerConnection`**:
   - Implements the complete W3C Perfect Negotiation state machine.
   - Deterministic politeness: `isPolite = myUserId.localeCompare(peerId) > 0`.
   - Offers, answers, signaling states (`stable`, `have-local-offer`, `have-remote-offer`), rollback handling.
   - Asynchronous candidate buffer queue (`iceCandidateQueue`).
   - Track sender management and `replaceTrack()` hot-swapping.
4. **`MockAudioEnergyMeter`**:
   - Calculates true RMS energy from PCM/frequency sample buffers.
   - Simulates 100ms sampling ticks and 1500ms active speaker decay hysteresis.

---

## 4. Multi-Tier Test Methodology

The test suite is structured into 4 hierarchical validation tiers:

### Tier 1: Feature Coverage (>=5 Test Cases per Feature Group)
Covers the core functional requirements across 9 distinct feature domains (45 test cases total):
- **WebRTC Negotiation & Signaling (TC1.1.1 - TC1.1.5)**: Deterministic politeness role assignment, unilateral impolite offer/answer, unilateral polite offer/answer, renegotiation needed trigger, signaling state validation.
- **ICE Candidate Handling & Queuing (TC1.2.1 - TC1.2.5)**: Pre-SDP buffering in queue, post-SDP automatic queue drain, in-flight direct addition, FIFO delivery guarantee, malformed candidate error handling.
- **Dynamic Track Hot-Swapping & Media Stream Binding (TC1.3.1 - TC1.3.5)**: Microphone mute via `track.enabled = false`, unmute restore, camera swap via `replaceTrack()`, screen share display media ingest, sender cleanup on stop.
- **Active Speaker Detection (TC1.4.1 - TC1.4.5)**: Analyser node binding, RMS energy formula verification, active speaker threshold activation, 1.5s hysteresis persistence, local mute suppression.
- **Ephemeral Guest Identity & Token Validation (TC1.5.1 - TC1.5.5)**: Ephemeral identity generation (`guest_`), HMAC-SHA256 live token creation and verification, tamper detection, clock skew tolerance (60s), student role boundary enforcement.
- **URL Routing & Case-Insensitive Normalization (TC1.6.1 - TC1.6.5)**: Lowercase to uppercase room normalization, whitespace trimming, mixed-case session binding, consistent Durable Object routing, invalid character sanitization.
- **Monaco Yjs CRDT Binary Updates & State Vectors (TC1.7.1 - TC1.7.5)**: Yjs binary encoding roundtrip, state vector catch-up exchange (`doc_sync_step1` / `doc_sync_step2`), multi-client WebSocket delta sync, awareness multi-cursor nametag propagation, follow instructor viewport synchronization.
- **Whiteboard Stroke Delta Streaming (TC1.8.1 - TC1.8.5)**: 3-stage stroke lifecycle (`START` -> `POINT` -> `END`), in-flight path rendering, conflict-free shape update delta (`action: 'UPDATE'`), element deletion delta (`action: 'DELETE'`), micro-click (<4px) discard.
- **Authoritative Snapshot Hydration for Late Joiners (TC1.9.1 - TC1.9.5)**: DO snapshot payload generation, multi-module state encapsulation (code, whiteboard, presentation, presence), late-joiner state recovery, desynced client state vector diffing, snapshot persistence integrity.

### Tier 2: Boundary & Corner Cases (Adversarial Stress Verification)
Tests extreme conditions, race conditions, and network faults:
- **TC2.1 — Offer Collision Glare Resolution with Rollback**: True simultaneous offer generation by both polite and impolite peers; verifies polite peer rolls back to receive remote offer without `InvalidStateError`.
- **TC2.2 — Early ICE Candidate Flooding**: Delivery of 50 asynchronous candidates before SDP exchange; verifies queue buffer capacity and FIFO application upon remote description resolution.
- **TC2.3 — High-Speed Drawing Burst (>100 points/second)**: Stylus coordinate stream bursting 200 points in 500ms; verifies 16ms rAF coalescing and smooth curve integrity.
- **TC2.4 — Concurrent CRDT Edits at Identical String Offset**: Simultaneous text insertion at index 0 by two clients; verifies deterministic client ID ordering and convergence with zero lost characters.
- **TC2.5 — Network Partition & 3-Second Disconnect Rehydration**: Simulated 3000ms network blackout; verifies reconnection, `resync_request`, event catch-up, and state reconciliation.

### Tier 3: Cross-Feature Combinations
Tests emergent behavior across interacting subsystems:
- **TC3.1 — Screen Share Presentation Layout + Monaco Split View**: Presenter streams screen share while 4 participants concurrently edit code; verifies dual channel isolation between media RTP and WebSocket CRDT.
- **TC3.2 — Web Audio Energy Sampling During Active Whiteboard Drawing**: High-frequency audio energy evaluation (100ms) operating concurrently with 60fps canvas vector stroke streaming without thread blocking.
- **TC3.3 — Guest Joining During Active Code Broadcast**: Unauthenticated guest joins mid-broadcast via shared URL; verifies automatic guest token issuance, instant code hydration, and immediate entry into follow-instructor mode.

### Tier 4: Real-World Application Scenarios
End-to-end multi-client lifecycle simulations representing authentic classroom operations:

| Scenario ID | Scenario Name | Participant Topology | Workflow Sequence | Success Criteria |
|-------------|---------------|----------------------|-------------------|------------------|
| TC4.1 | Google Meet-Class 4-Party Classroom Lecture Lifecycle | 1 Teacher (`usr_teacher`), 3 Students (`usr_student_1`, `usr_student_2`, `guest_student_3`) | 1. Teacher starts session; 2. Students join sequentially; 3. Full P2P mesh (6 pairs) negotiated; 4. Teacher turns on camera/mic; 5. Teacher shares screen (presentation layout); 6. Student asks question with active speaker pulse; 7. Late guest joins and catches up | All peer connections stable; active speaker detected with 1.5s hysteresis; late joiner hydrates all tracks and documents |
| TC4.2 | Restrictive Symmetric NAT Traversal via Ephemeral HMAC TURN | 2 Peers behind restrictive NAT | 1. Direct host/srflx candidates fail; 2. Request authoritative ICE servers; 3. Generate dynamic RFC 5766 HMAC credentials; 4. Relay candidate exchange (`typ relay`) | Connection establishes via TURN relay; media streams bind without loss |
| TC4.3 | Late-Joining Student Multi-Module State Catch-up | 1 Active Room (Teacher + Student), 1 Late Joiner | 1. Room actively running code broadcast and whiteboard drawing; 2. Late joiner connects; 3. `SESSION_HYDRATION_SNAPSHOT` delivered; 4. Yjs doc and canvas hydrate | Late joiner document matches active room state byte-for-byte in <500ms |
| TC4.4 | Transient Network Partition (3s Blackout) & Full Session Recovery | 2 Connected Peers | 1. Active call with ongoing code collaboration; 2. Peer connection drops for 3000ms; 3. WebSocket auto-reconnects; 4. Re-negotiation and sequence resync triggered | Audio/video resume; uncommitted CRDT edits merge cleanly |

---

## 5. Coverage Thresholds & Quality Gates

To ensure software delivery integrity, the Live Classroom test suite enforces the following automated quality gates:

1. **Pass Rate**: 100% of tests must pass (0 failures, 0 critical errors).
2. **Assertion Density**: Average >= 3 assertions per test case across all tiers.
3. **Execution Duration**: Complete test suite execution must complete in <= 10.0 seconds.
4. **TypeScript Safety**: Exits with code 0 under `npm run lint` (`tsc --noEmit`) with zero type errors.
5. **Zero-Emoji Compliance**: Zero unicode emoji characters in `src/`, `tests/`, and documentation files.
6. **Air-Gapped Isolation**: No outbound HTTP requests to external cloud services or STUN/TURN servers during test execution.
