# CORTEX LOCKDOWN
# EDGE API SPECIFICATION & INTEGRATION PROTOCOL
## Endpoints, Payloads, Cryptographic Attestation & Telemetry

**Document Version:** 1.0.0  
**Transport Security:** TLS 1.3 Mandatory (HTTPS/WSS)  
**Host URL:** `https://cortex-code-platform.cortexbuild1.workers.dev`  
**Authentication Scheme:** Dual Cookie + Bearer Attestation Token  
**Author:** Principal Platform Architect & Senior API Engineer  
**Date:** October 31, 2026  

---

## 1. API ARCHITECTURE & ENDPOINT CATALOG

The Cortex Lockdown API provides a unified, server-authoritative interface connecting native desktop clients to the Cortex Online Examination System. All endpoints are hosted on Cloudflare Workers with direct Cloudflare D1 persistence.

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/lockdown/devices/enroll` | `POST` | Student | Enrolls and attests a student's desktop computer, returning a persistent device trust token. |
| `/api/v1/lockdown/authorize-launch` | `POST` | Student | Requests an ephemeral, cryptographically signed launch grant for an active examination. |
| `/api/v1/lockdown/policy` | `GET` | Student/Teacher | Retrieves the compiled security policy and requirements for a specific assessment. |
| `/api/v1/lockdown/telemetry` | `POST` | Student | Ingests real-time integrity events (focus blur, external app detection, face tracking flags). |
| `/api/v1/lockdown/heartbeat` | `POST` | Student | Synchronizes candidate alive state, active window metrics, and sensor status every 15s. |
| `/api/v1/lockdown/downloads` | `GET` | Public | Returns download links, platform versions, and SHA-256 release hashes for desktop installers. |

---

## 2. DETAILED ENDPOINT SPECIFICATIONS

### 2.1 Device Enrollment & Hardware Attestation
- **Route:** `POST /api/v1/lockdown/devices/enroll`
- **Authentication:** Cortex Session Cookie (`cortex_session`)

#### Request Headers:
```http
Content-Type: application/json
X-Cortex-Client-Platform: windows | macos
X-Cortex-Client-Version: 1.0.0
```

#### Request Payload:
```json
{
  "hardwareFingerprint": "a8f3b92c4d1e0f8a9271c56391d8e40b3c2a1f09e8d7c6b5a4938271605f4e3d",
  "deviceModel": "ThinkPad P1 Gen 5",
  "osVersion": "Windows 11 Enterprise 23H2 (Build 22631.3880)",
  "arch": "x64",
  "displayCount": 1,
  "clientBinaryHash": "3f79a2c18d09e5b84c31278f901234567890abcdef1234567890abcdef123456"
}
```

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "deviceId": "dev_win_89a3f2b1c0d4",
  "deviceTrustToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfbXVs...",
  "registeredAt": 1793467200000,
  "status": "trusted"
}
```

---

### 2.2 Examination Launch Authorization
- **Route:** `POST /api/v1/lockdown/authorize-launch`
- **Authentication:** Cortex Session Cookie + Device Trust Token

#### Request Payload:
```json
{
  "classroomId": "CLS_1792819623330_ZF01",
  "examId": "EXAM_CSE276_ACTIVE_MIDTERM",
  "deviceId": "dev_win_89a3f2b1c0d4",
  "hardwareFingerprint": "a8f3b92c4d1e0f8a9271c56391d8e40b3c2a1f09e8d7c6b5a4938271605f4e3d"
}
```

#### Server Validation Rules:
1. Candidate must be an enrolled member of `classroomId`.
2. Examination status must be `active` or `published`.
3. Current timestamp must fall within `[startTime - 15min, endTime]`.
4. Student attempt count must be less than `attemptsAllowed`.
5. Device fingerprint must match enrolled device token.

#### Success Response (`200 OK`):
```json
{
  "authorized": true,
  "launchGrant": "grant_92f8a1c0d4e5f607",
  "expiresAt": 1793467320000,
  "exam": {
    "id": "EXAM_CSE276_ACTIVE_MIDTERM",
    "title": "Midterm Exam: Multithreading, Memory Models & Lock-Free Structures",
    "durationMinutes": 60,
    "securityLevel": "restricted",
    "totalMarks": 100,
    "passingMarks": 40
  },
  "policy": {
    "requireCamera": true,
    "requireMicrophone": true,
    "recordVideo": true,
    "recordAudio": true,
    "continuousMonitoring": true,
    "facePresenceDetection": true,
    "multiFaceDetection": true,
    "audioAnomalyDetection": true,
    "blockClipboard": true,
    "blockAppSwitching": true,
    "blockScreenCapture": true,
    "allowSingleDisplayOnly": true,
    "prohibitedProcesses": ["obs64", "discord", "teamviewer", "anydesk", "chrome", "firefox"]
  },
  "policyToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleGFtSWQiOiJFW..."
}
```

---

### 2.3 Real-Time Integrity Telemetry Ingestion
- **Route:** `POST /api/v1/lockdown/telemetry`
- **Authentication:** Session Cookie + Active Session ID

#### Request Payload:
```json
{
  "sessionId": "sess_live_alex_midterm",
  "examId": "EXAM_CSE276_ACTIVE_MIDTERM",
  "events": [
    {
      "eventType": "focus_lost",
      "timestamp": 1793467215000,
      "details": {
        "reason": "window_blur",
        "activeWindow": "Discord.exe",
        "durationMs": 3420
      }
    },
    {
      "eventType": "face_missing",
      "timestamp": 1793467220000,
      "details": {
        "durationMs": 12000,
        "confidence": 0.94
      }
    }
  ]
}
```

#### Success Response (`200 OK`):
```json
{
  "received": 2,
  "persisted": 2,
  "status": "recorded"
}
```

---

### 2.4 Desktop Application Releases & Downloads
- **Route:** `GET /api/v1/lockdown/downloads`
- **Authentication:** Public / Unauthenticated

#### Success Response (`200 OK`):
```json
{
  "version": "1.0.0",
  "releaseDate": "2026-10-31",
  "platforms": {
    "windows": {
      "installerUrl": "/downloads/cortex-lockdown-setup-1.0.0.exe",
      "standaloneUrl": "/downloads/CortexLockdown.exe",
      "sizeBytes": 14680064,
      "sha256": "4b902168426af87e4fb2973eb31b1f742507a40f104c04c72a594f354827c956",
      "minOsVersion": "Windows 10 Version 1809 (Build 17763)"
    },
    "macos": {
      "dmgUrl": "/downloads/cortex-lockdown-1.0.0.dmg",
      "sizeBytes": 18874368,
      "sha256": "8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b",
      "minOsVersion": "macOS 13.0 (Ventura)"
    }
  }
}
```
