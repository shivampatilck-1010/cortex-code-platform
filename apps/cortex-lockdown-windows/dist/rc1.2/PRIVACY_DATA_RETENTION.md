# CORTEX LOCKDOWN RC1.2 - PRIVACY ARCHITECTURE & DATA RETENTION SPECIFICATION

Package Version: 1.0.0-rc1.2  
Target Operating System: Microsoft Windows 10/11 x64  
Classification: Privacy Architecture & Data Governance Specification  
Zero Emojis Enforced: Yes  

---

## 1. Privacy-First Architectural Principles

Cortex Lockdown is engineered under a privacy-preserving paradigm designed to respect student dignity, comply with institutional data governance frameworks, and prevent intrusive remote surveillance.

Core Privacy Pillars:
1. **In-RAM Processing Only:** Video and audio feeds are ingested into volatile memory buffers, processed frame-by-frame, and immediately discarded.
2. **Zero Raw Media Storage:** No full-motion video, screen recordings, ambient audio recordings, or photo snapshots are written to disk.
3. **Advisory Telemetry Only:** Sensor algorithms output sparse discrete event metadata (e.g., `face_absent`, `multiple_faces`, `audio_spike`).
4. **Mandatory Human-in-the-Loop Review:** Algorithms never automatically penalize, terminate, or disqualify a student. All flags are presented as advisory alerts for human proctor evaluation.
5. **Session-Bounded Cryptography:** Local temporary answer journals are encrypted with ephemeral keys that expire upon exam conclusion.

---

## 2. Sensor Processing & Telemetry Pipeline

| Subsystem | Input Source | Processing Environment | Disk Persistence | Network Transmission |
| :--- | :--- | :--- | :--- | :--- |
| **Facial & Presence Detection** | Local Webcam | Volatile RAM buffer | **NONE** (Zero frames saved) | Discrete event strings only (e.g., `face_lost`) |
| **Acoustic Volume Analysis** | Local Microphone | Volatile RAM buffer (RMS calculation) | **NONE** (Zero audio samples saved) | Sparse threshold event (e.g., `audio_spike`) |
| **Display Guard** | Windows Desktop | Win32 GDI / DXGI | **NONE** (Screen capture blacked out) | Multi-monitor presence alert |
| **Process Watchdog** | Windows Process List | Win32 Toolhelp32 snapshot | **NONE** | Prohibited process launch alert |
| **Answer Journal** | Candidate Editor | Local disk (`answer-store.ts`) | **AES-256-GCM Encrypted** (100k PBKDF2) | Authoritative submission payload |

---

## 3. Wire-Level Network Packet Capture Boundary

- **Source Code Verification:** In-depth source code audit of `apps/cortex-lockdown-windows/` and `src/components/lockdown/` verifies that no media capture pipelines (WebRTC media recorders, MediaStream recording APIs, or multipart binary upload endpoints) exist.
- **Wire-Level Status Disclosure:** While client and server codebases have been audited and verified, independent physical wire-level packet sniffing (via Wireshark or physical TAP) during full video streaming was not executed as part of automated CI test runs.
- **Authoritative Classification:** Network wire-level media absence is formally classified as **AUDITED AND VERIFIED AT APPLICATION SOURCE LAYER; NOT VERIFIED AT PHYSICAL WIRE PACKET CAPTURE LAYER**.

---

## 4. Local Answer Persistence & SSD / NAND Flash Retention (`DEF-RC1-007`)

- **Autosave Protection:** Candidate responses are cached locally every 5 seconds to provide fault tolerance against campus network drops.
- **Cryptographic Encryption:** Local journal records are encrypted via **AES-256-GCM** with a 256-bit key derived using PBKDF2 with 100,000 SHA-256 iterations, seeded with unique session, exam, and candidate identifiers.
- **Post-Exam Sanitization:** Upon confirmed exam submission or proctor exit, `clearEncryptedAnswers()` executes:
  1. User-space memory zeroing of active buffers.
  2. Overwriting of the local journal file with zeros.
  3. Operating system file deletion (`fs.unlinkSync()`).
- **Physical Wear-Leveling Boundary:** On solid-state drives (NVMe, SSD, eMMC), the Flash Translation Layer (FTL) performs dynamic wear-leveling and out-of-place writes. User-space overwrites write zeros to newly allocated physical flash blocks, leaving the original block marked as stale until background garbage collection and TRIM cycles occur.
- **Security Assurance:** Candidate confidentiality does not rely upon physical NAND destruction; it is strictly guaranteed by the **AES-256-GCM authenticated ciphertext barrier**. Without the session key, residual flash blocks cannot be decrypted.
