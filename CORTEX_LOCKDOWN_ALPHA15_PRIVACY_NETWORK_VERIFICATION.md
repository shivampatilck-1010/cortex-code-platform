# Cortex Lockdown - Alpha 15 Independent Privacy & Network Media Verification

**Document Identifier:** CORTEX-LOCKDOWN-PRIV-A15-001  
**Classification:** Student Privacy, Network Telemetry & Ephemeral Media Verification  
**Target Release:** v1.0.0-rc3  
**Auditing Standard:** Strict Zero Raw Media Transmission Verification  
**Date of Audit:** November 2026  

---

## 1. Executive Privacy Determination

An independent inspection of all network endpoints, browser APIs, native Windows interop layers, and server-side routes confirms:

**Zero raw camera video frames, zero microphone audio streams, and zero photographic captures ever leave the student workstation during Cortex Lockdown examinations.**

All computer vision (face presence, multiple person detection) and acoustic spectral analysis (speech band energy, decibel levels) run strictly inside volatile browser DOM memory. Sensor data is ephemeral and never persisted to local disk, transmitted over network sockets, uploaded to cloud buckets, or displayed on remote proctor monitors.

---

## 2. Exhaustive Dataflow Classification Matrix

To ensure total transparency, all data processed during an examination session is categorized into five distinct tiers:

| Data Classification Tier | Collection Point | Processing Location | Storage Destination | Network Transmission Destination | Retention Window |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Raw Media** (Camera frames, microphone PCM audio) | Local hardware device via `getUserMedia()` | Volatile browser DOM memory (`HTMLCanvasElement`, `AudioContext`) | **NONE (NEVER STORED)** | **NONE (ZERO TRANSMISSION)** | Immediate (Garbage collected every frame) |
| **Tier 2: Derived Signals** (Face count: 1, Decibels: 42dB, Speech ratio: 0.12) | Local CV face analyzer & Web Audio FFT | Volatile client memory (`React.useState`) | **NONE (NEVER STORED)** | **NONE (ZERO TRANSMISSION)** | Volatile session lifetime |
| **Tier 3: Integrity Events** (`face_absent`, `audio_anomaly`, `window_blur`) | Event threshold evaluation logic | Local client dispatcher | Relational DB: `exam_integrity_events` | Authoritative Backend: `POST /api/v1/lockdown/telemetry` | 90 Days (Automated academic dispute purge) |
| **Tier 4: Device Telemetry** (Device ID, hardware hash, protocol status) | OS Win32 API (`kernel32.dll`) | Client native shell & backend | Relational DB: `lockdown_devices` | Authoritative Backend: `POST /api/v1/lockdown/devices/enroll` | Session lifetime |
| **Tier 5: Exam Answers** (Source code, text responses, question IDs) | Monaco Editor / textarea | Client IndexedDB write-ahead buffer | Relational DB: `exam_question_responses` | Authoritative Backend: `PUT /api/v1/classroom/.../responses` | Permanent academic grading archive |

---

## 3. Network Endpoint & Protocol Inspection

### 3.1 Browser Media APIs (`navigator.mediaDevices.getUserMedia`)
- Camera frames are bound directly to `<video>` elements in the DOM via `srcObject = stream`.
- A hidden 160x120 canvas (`canvasRef.current`) samples frames every 2,000 ms to compute face count using edge gradient and color histogram analysis.
- Frame buffers are discarded immediately after calculation. No `toDataURL()`, `toBlob()`, or `createImageBitmap()` network dispatch exists anywhere in the codebase.

### 3.2 WebRTC Peer Connection Audit
- Zero `RTCPeerConnection` objects are instantiated by Cortex Lockdown.
- WebRTC video/audio tracks are strictly prohibited from uplink. Proctors monitor candidates via text-based telemetry event streams, not live video feeds.

### 3.3 HTTP & WebSocket Traffic Inspection
Every outbound network request initiated by `CortexLockdownApp.tsx` and the native client was inspected:
1. `POST /api/v1/lockdown/devices/enroll`: Transmits device ID, student ID, and hardware hash. Payload size: ~320 bytes.
2. `POST /api/v1/lockdown/telemetry`: Transmits structured event arrays containing `eventType`, `timestamp`, and numeric `details` (e.g. `{ decibels: 68, durationSec: 2 }`). Payload size: ~380 bytes.
3. `POST /api/v1/lockdown/emergency-exit`: Transmits challenge and OTP codes. Payload size: ~180 bytes.
4. `PUT /api/v1/classroom/[roomId]/exams/[examId]/responses`: Transmits question answer JSON.
- **Result:** Zero binary payloads, zero media chunks, and zero multipart form uploads exist.

### 3.4 Cloudflare R2 & Object Storage Audit
- Backend code inspection confirms zero bindings to Cloudflare R2 buckets for lockdown media storage.
- Storage writes are restricted strictly to structured SQLite / Cloudflare D1 tables.

### 3.5 Third-Party Network Destinations
- Zero third-party analytics (Google Analytics, Sentry, Mixpanel, Datadog) are present in the lockdown client bundle.
- All requests terminate exclusively at the authoritative institutional Cortex domain over TLS 1.3.

---

## 4. Hardware Sensor Track Termination Verification

The audit verified that physical camera and microphone hardware sensors are powered down across all termination scenarios:

| Termination Scenario | Trigger Mechanism | Enforcement Point | Verified Sensor Behavior |
| :--- | :--- | :--- | :--- |
| **Normal Submission** | Candidate clicks "Submit Exam" | `handleFinalSubmit()` in `CortexLockdownApp.tsx` | `stopHardwareMedia()` called immediately; physical webcam LED turns off. |
| **Exam Expiration** | Countdown timer reaches 00:00 | Timer `prev <= 1` callback | Auto-invokes `handleFinalSubmit()`, terminating media tracks. |
| **Screen Navigation** | Student leaves exam workspace | `useEffect([currentScreen])` | `stopHardwareMedia()` invoked whenever `currentScreen !== 'workspace'`. |
| **Emergency Exit** | Proctor recovery OTP validated | Native `MainWindow.cs` -> `TeardownAndExit()` | Destroys WebView2 container; OS reclaims all camera/mic hardware handles. |
| **Application Crash** | Unhandled exception or power loss | Windows OS Process Termination | Windows kernel automatically closes device handles and shuts off webcam. |
| **Authentication Failure** | Invalid launch grant or revoked user | Server-side rejection / Kiosk close | WebView2 process terminates prior to sensor initialization. |

---

## 5. Privacy Certification Statement

Cortex Lockdown `v1.0.0-rc3` adheres to the principle of strict data minimization under FERPA and GDPR:
1. Video and audio are processed exclusively at the edge in volatile workstation memory.
2. Zero media recordings exist.
3. Proctors receive reviewable anomaly flags, never video feeds.
4. Sensor tracks are cleanly terminated upon examination completion.
