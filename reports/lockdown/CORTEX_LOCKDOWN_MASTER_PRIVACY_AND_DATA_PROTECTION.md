# Cortex Lockdown v1.0 - Master Privacy, Ephemeral Media & Data Protection Framework

**Document Identifier:** CORTEX-LOCKDOWN-PRIV-V1-001  
**Classification:** Student Privacy, Edge Processing & Data Retention Standard  
**Baseline Release:** Cortex Lockdown v1.0 (v1.0.0-rc3 Engine)  
**Compliance Standards:** FERPA (34 CFR Part 99), GDPR (Regulation (EU) 2016/679), COPPA  
**Date of Publication:** November 2026  

---

## 1. Executive Privacy Architecture

Cortex Lockdown enforces a strict **Zero Raw Media Transmission Architecture**. Camera and microphone hardware sensors are utilized solely for local, edge-computed computer vision and acoustic anomaly detection executing directly in the client workstation's volatile browser DOM memory.

At no point during an examination session is video footage, audio recordings, or webcam photographic snapshots streamed to backend servers, saved to cloud storage buckets (Cloudflare R2), or transmitted to remote human proctors.

---

## 2. Comprehensive 11-Category Data Inventory

| # | Data Category | Collection Purpose | Collection Method | Local Processing | Network Transmission | Storage Location | Encryption (In-Transit & At-Rest) | Access Roles | Retention & Deletion Schedule | Audit Evidence Reference |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **Camera Frames** | Face presence & multi-person detection | `navigator.mediaDevices.getUserMedia` | Hidden HTMLCanvasElement (160x120) samples frame edge gradients | **NONE (Zero Transmission)** | **NONE (Never Stored)** | N/A (Volatile RAM) | Client Browser Only | Immediate per-frame garbage collection | `CortexLockdownApp.tsx:analyzeVideoFrame` |
| **02** | **Microphone Samples** | Acoustic anomaly & vocal detection | `getUserMedia({ audio: true })` | Web Audio API `AnalyserNode` computes FFT spectral bands | **NONE (Zero Transmission)** | **NONE (Never Stored)** | N/A (Volatile RAM) | Client Browser Only | Immediate buffer flush upon analysis | `CortexLockdownApp.tsx:analyzeAudioSpectrum` |
| **03** | **Derived Face Signals** | Visual integrity state (face count, absent/multiple) | Algorithmic analysis of local canvas pixel buffers | Evaluates face count integer (0, 1, 2+) in React state | **NONE (Zero Raw Signals)** | **NONE (Never Stored)** | N/A (Volatile RAM) | Client Browser Only | Discarded on session termination | `CortexLockdownApp.tsx:setFaceCount` |
| **04** | **Derived Audio Signals** | Environmental noise level & speech ratio | FFT spectral centroid calculation | Computes decibel level and speech energy ratio | **NONE (Zero Raw Signals)** | **NONE (Never Stored)** | N/A (Volatile RAM) | Client Browser Only | Discarded on session termination | `CortexLockdownApp.tsx:setAudioLevel` |
| **05** | **Integrity Events** | Flagging potential testing anomalies for human review | Threshold trigger (e.g., continuous speech > 2s) | Structured JSON object creation | Outbound HTTPS JSON to `/api/v1/lockdown/telemetry` | Cloudflare D1: `exam_integrity_events` | TLS 1.3 in-transit; AES-256 at rest | Proctor, Faculty, Institutional Admin | 90 Days (Automated purge after academic dispute window) | `src/lib/classroom/db/index.ts:cleanupExpiredIntegrityEvents` |
| **06** | **Device Metadata** | Hardware binding & anti-spoofing verification | Win32 native API / `kernel32.dll` | Computes SHA-256 hardware profile hash | Outbound HTTPS JSON to `/api/v1/lockdown/devices/enroll` | Cloudflare D1: `lockdown_devices` | TLS 1.3 in-transit; AES-256 at rest | Institutional Admin, Proctor | Active exam session lifetime | `src/lib/lockdown/security-policy.ts:signDeviceTrustToken` |
| **07** | **Network Telemetry** | Session connectivity & quota tracking | 30-second client heartbeat ping | Timestamp ping generation | Outbound HTTPS JSON to `/api/v1/classroom/.../heartbeat` | Cloudflare D1: `exam_sessions.last_heartbeat_at` | TLS 1.3 in-transit; AES-256 at rest | System, Proctor | Session lifetime | `src/lib/classroom/db/index.ts:getAuthoritativeActiveSessionCount` |
| **08** | **Proctor Records** | Invigilator attendance & incident notes | Proctor dashboard interactive input | Form validation in dashboard UI | Outbound HTTPS JSON to proctor management routes | Cloudflare D1: `classroom_proctors` | TLS 1.3 in-transit; AES-256 at rest | Chief Proctor, Institutional Admin | Permanent institutional audit record | `src/app/api/v1/lockdown/pilot/route.ts` |
| **09** | **Emergency Auth Records** | Kiosk recovery authorization & challenge codes | Proctor emergency release workflow | Generates salt, 4-hex challenge, and peppered hash | Outbound HTTPS JSON to `/api/v1/lockdown/emergency-exit` | Cloudflare D1: `lockdown_emergency_authorizations` | TLS 1.3 in-transit; AES-256 at rest | Chief Proctor, System Admin | 30 Days (Automated purge after exam closure) | `src/lib/classroom/db/index.ts:cleanupExpiredEmergencyAuthorizations` |
| **10** | **Examination Answers** | Assessment evaluation and academic grading | Monaco Editor / text inputs | Local IndexedDB encrypted write-ahead cache | Outbound HTTPS JSON to `/api/v1/classroom/.../responses` | Cloudflare D1: `exam_question_responses` | TLS 1.3 in-transit; AES-256 at rest | Faculty Grader, Student (Own Review) | Permanent institutional academic record | `src/lib/classroom/db/index.ts:saveQuestionResponse` |
| **11** | **Submission Receipts** | Non-repudiation proof of completed exam | Server cryptographic signature generation | Formatted on submission success screen | Displayed to student; stored on server | Cloudflare D1: `exam_sessions.submission_receipt` | TLS 1.3 in-transit; AES-256 at rest | Student, Proctor, Registrar | Permanent institutional academic record | `CortexLockdownApp.tsx:submissionReceipt` |

---

## 3. Hardware Sensor Release Lifecycle

Physical webcam and microphone hardware indicators (LED lights) must turn off immediately when testing concludes. The table below documents the enforcement point across all seven exit paths:

```
[Candidate Active Exam Workspace]
       |
       +---> Normal Submission: handleFinalSubmit() invokes stopHardwareMedia()
       |
       +---> Timer Expiration: Timer callback triggers handleFinalSubmit() at 00:00
       |
       +---> Navigation Away: useEffect([currentScreen]) calls stopHardwareMedia()
       |
       +---> Emergency Recovery: Native client kills WebView2; OS closes handles
       |
       +---> Client Unmount: React cleanup hook invokes stopHardwareMedia()
       |
       +---> Application Crash: Windows kernel reclaims camera/microphone handles
       |
       +---> Auth Failure: Kiosk terminates prior to sensor initialization
```

### Empirical Code Verification (`src/components/lockdown/CortexLockdownApp.tsx`):
```typescript
const stopHardwareMedia = () => {
  if (mediaStreamRef.current) {
    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }
  if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
    audioContextRef.current.close().catch(() => {});
    audioContextRef.current = null;
  }
  setIsUsingHardwareMedia(false);
  setCameraActive(false);
  setMicActive(false);
};
```

---

## 4. Proctoring Ethics: Mandatory Human Review

1. **Zero Automated Academic Sanctions:** Anomaly flags (`face_absent`, `multiple_faces_detected`, `audio_anomaly`, `window_blur`) are strictly informational signals displayed on the Proctor Dashboard for human verification.
2. **No Algorithmic Disqualification:** Cortex Lockdown contains zero logic to automatically cancel exams, terminate attempts, or alter candidate scores based on sensor telemetry.
3. **Appeals & Dispute Evidence:** Integrity event telemetry is preserved for 90 days to support formal institutional student appeals, after which all transient event metadata is purged permanently.
