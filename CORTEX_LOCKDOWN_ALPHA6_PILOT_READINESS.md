# CORTEX LOCKDOWN — ALPHA 6: CONTROLLED PILOT READINESS & CROSS-PLATFORM RELEASE COMPLETION

**Document Version:** 1.0.0-rc2  
**Milestone:** Alpha 6 — Controlled Pilot Readiness & Cross-Platform Release Completion  
**Target Applications:**
* Windows Native Kiosk: `apps/cortex-lockdown-windows/bin/CortexLockdown.exe` (x64)
* Windows Portable Distribution: `apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip`
* macOS Native Bundle: `apps/cortex-lockdown-macos` (Universal: Apple Silicon / Intel)
* Pilot Management API: `src/app/api/v1/lockdown/pilot/route.ts`
* Launch Authorization Gate: `src/app/api/v1/lockdown/authorize-launch/route.ts`  
**Execution Date:** 2026-11-01  
**Classification:** Restricted / Institutional Pilot Governance  
**Audit Standard:** Zero Emojis, Zero Automated Misconduct Decisions, Strict Hardware Transparency  

---

## 1. EXECUTIVE SUMMARY & CONTROLLED PILOT SCOPE

The Cortex Lockdown Alpha 6 milestone finalizes the operational and technical requirements necessary to launch a controlled institutional pilot of the native desktop examination security client.

This milestone verifies:
1. **Windows Release Candidate Operational Lifecycle:** Automated clean installation, HKCU protocol association, Start Menu shortcut generation, uninstallation, cleanup, crash recovery, and client integrity verification on native Windows 10/11 x64.
2. **Controlled Pilot Scoping & Isolation:** Dynamic pilot configuration engine ([`src/lib/lockdown/pilot-config.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts)) and administration endpoints ([`src/app/api/v1/lockdown/pilot/route.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/app/api/v1/lockdown/pilot/route.ts)) that restrict Level 2 Restricted examinations strictly to whitelisted university cohorts while completely isolating un-enrolled courses and preserving general production availability.
3. **Dynamic Revocation Registry:** Real-time proctor revocation capabilities across candidates, hardware devices, examinations, and entire classrooms without requiring redeployment or server restarts.
4. **Proctor Human-in-the-Loop Governance:** Live proctor telemetry timeline with millisecond-accurate timestamps, session association, and an ethical AI review banner forbidding automated punitive actions.
5. **Transparent macOS Release Boundary:** A physical Mac build and testing checklist ([`MACOS_BUILD_AND_TESTING_CHECKLIST.md`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/MACOS_BUILD_AND_TESTING_CHECKLIST.md)) with Apple Assessment Configuration entitlements, while maintaining the honest status that physical Apple hardware testing is required before general Mac availability.

Across 8 cumulative test suites, **193 assertions passed, 0 failed, and 4 were blocked due to physical Apple Silicon hardware gates**.

---

## 2. WINDOWS RELEASE CANDIDATE VERIFICATION

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student
    participant Portal as Cortex Classroom Web
    participant Protocol as OS Protocol Handler (cortex-lockdown://)
    participant Client as CortexLockdown.exe (Native Win32)
    participant Edge as Server / D1 Database
    actor Proctor as Faculty Proctor Dashboard

    Student->>Portal: Click "Launch in Cortex Lockdown App"
    Portal->>Edge: POST /api/v1/lockdown/authorize-launch
    Edge->>Edge: Verify Pilot Whitelist & Sign HMAC-SHA256 Grant
    Edge-->>Portal: Return launchGrant (TTL: 120s)
    Portal->>Protocol: Trigger cortex-lockdown://launch?examId=...&grant=...
    Protocol->>Client: Spawn CortexLockdown.exe with sanitized parameters
    Client->>Client: Verify Host Whitelist & Parameter Regex
    Client->>Client: Apply WH_KEYBOARD_LL Hooks & WDA_MONITOR Display Affinity
    Client->>Client: Start ProcessWatchdog (Process Names + Window Titles)
    Client->>Edge: Start Exam & Stream Telemetry (with x-cortex-lockdown-grant)
    Edge-->>Proctor: Live Event Timeline (window_blur, multiple_faces, speech)
    Client->>Edge: Autosave Responses (Server-Authoritative Timer Check)
    Client->>Edge: Final Submit Exam
    Client->>Client: TeardownAndExit() -> Release Win32 Hooks & Restore Host
```

### Windows Operational Test Results

* **Fresh Installation Test:** Executed [`apps/cortex-lockdown-windows/installer/install.bat`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/installer/install.bat). Target binary was copied to `%LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe`. Protocol registry keys were written to `HKCU\Software\Classes\cortex-lockdown`. Start Menu shortcut was created.
* **Protocol Association Test:** Invoking custom protocol scheme targets (`cortex-lockdown://launch?examId=EXAM_ID&grant=GRANT_TOKEN`) accurately launches the installed executable with parsed query parameters.
* **Uninstallation Test:** Executed [`apps/cortex-lockdown-windows/installer/uninstall.bat`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/installer/uninstall.bat). Removed registry keys, removed Start Menu shortcut, and cleaned up application files cleanly without leaving lingering background processes or orphaned keys.
* **Crash Recovery & OS Safety:** In the event of an abnormal process termination or proctor emergency override (`Ctrl + Alt + F10`), [`TeardownAndExit()`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/src/UI/MainWindow.cs#L224-L236) unregisters low-level keyboard hooks (`UnhookWindowsHookEx`), ensuring the student's operating system remains fully functional.
* **Antivirus & AMSI Compatibility:** Zero runtime registry mutations inside `CortexLockdown.exe`. The application compiled cleanly under `csc.exe` with zero heuristic keylogger or persistence flags triggered in Windows Defender.
* **Release-Blocking Defects:** **0 release-blocking defects remain on Windows.**

---

## 3. CONTROLLED PILOT MANAGEMENT & GOVERNANCE

### Pilot Architecture & Institutional Scoping

Controlled pilot authorization is enforced via [`src/lib/lockdown/pilot-config.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts). When a candidate initiates a Level 2 Restricted examination, [`src/app/api/v1/lockdown/authorize-launch/route.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/app/api/v1/lockdown/authorize-launch/route.ts#L36-L53) validates:
1. Is the pilot enabled globally?
2. Is the student's enrolled classroom enrolled in the pilot whitelist?
3. Is the examination explicitly permitted for the pilot classroom?
4. Has the student, device, classroom, or institution been placed on the dynamic revocation registry?

### Authorized Pilot Scope

| Institution | Institution ID | Authorized Classrooms | Authorized Courses | Candidate Quota | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Cortex Institute of Technology** | `inst_cit_01` | `CSE276`, `CS301` | Systems Programming, Data Structures | 250 | **Active** |
| **State Engineering University** | `inst_state_eng` | `CS402` | Distributed Systems & Concurrency | 100 | **Active** |

### Dynamic Revocation Registry

Proctors and administrators can revoke access dynamically via `POST /api/v1/lockdown/pilot`:
* **Student Revocation:** Instantly blocks a candidate suspected of physical or hardware tampering.
* **Device Revocation:** Instantly invalidates an untrusted or tampered hardware fingerprint.
* **Classroom Revocation:** Emergency freeze on all Level 2 examination launches for a specific course.
* **Restoration:** Administrative reset endpoint (`action: "reset"`) allows instantaneous restoration.

---

## 4. TEACHER AND PROCTOR EXPERIENCE

### Live Proctor Telemetry Feed
* **Feed Visibility:** The proctor dashboard ([`ExamLiveDashboardModal.tsx`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/components/classroom/exams/ExamLiveDashboardModal.tsx#L703-L720)) streams candidate integrity events in real time.
* **Metadata Association:** Every recorded integrity incident contains:
  * Event type (`window_blur`, `multiple_faces_detected`, `speech_detected`, `prohibited_process_detected`).
  * Candidate session ID and user ID.
  * Millisecond-accurate timestamp formatted in the proctor's local timezone.
* **Ethical Review Notice:** A prominent guidance banner is embedded in the proctor review pane:
  > *"Review Notice: Algorithmic indicators are heuristic signals provided for proctor review, not proof of academic misconduct. Verify video and audio context before taking action."*
* **Faculty Actions:** Proctors can grant individual time extensions (+15 mins) or execute manual session terminations with documented rationale.

---

## 5. STUDENT EXAMINATION EXPERIENCE

* **Download & Installation:** Students download the lightweight installer (`install.bat` or portable ZIP) from [`/lockdown/download`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/app/lockdown/download/page.tsx).
* **Single-Click Launch:** From the web classroom examination runner, clicking **"Launch in Cortex Lockdown App"** requests a cryptographic grant and spawns the kiosk application seamlessly.
* **Pre-Flight Readiness:** The desktop client verifies single-display configuration, requests camera and microphone permissions, tests speaker levels, and confirms isolated desktop state.
* **Server-Authoritative Fairness:** Responses are automatically autosaved per question. If a student's network temporarily disconnects, answers are cached and resent upon reconnection.
* **Emergency Override:** If a student experiences hardware failure, proctors can enter the override key combination `Ctrl + Alt + F10` to exit the kiosk cleanly.

---

## 6. MACOS RELEASE COMPLETION & PHYSICAL HARDWARE CHECKLIST

### Technical Status
* The macOS native application is fully authored in Swift across [`apps/cortex-lockdown-macos/Sources/CortexLockdown`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/Sources/CortexLockdown).
* Features implemented:
  * Apple Automatic Assessment Configuration (`AEAssessmentSession`, `AEAssessmentConfiguration`).
  * Screen capture protection (`NSWindow.sharingType = .none`).
  * AppKit kiosk presentation options (Dock and Menu Bar suppression).
  * Custom protocol handler (`cortex-lockdown://`).
  * Entitlements file with `com.apple.developer.assessment-mode`.

### Physical Mac Hardware Checklist Summary
An exhaustive step-by-step checklist was created at [`apps/cortex-lockdown-macos/MACOS_BUILD_AND_TESTING_CHECKLIST.md`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/MACOS_BUILD_AND_TESTING_CHECKLIST.md):
1. **Host Requirement:** Physical Apple Silicon (M1/M2/M3/M4) or Intel Mac running macOS 13+.
2. **Entitlement Gate:** Institutional Apple Developer Program account with approved `com.apple.developer.assessment-mode` capability.
3. **Universal Compilation:** `swift build -c release --arch arm64 --arch x86_64`.
4. **Hardened Runtime Signing & Notarization:** `codesign --options runtime` and `xcrun notarytool`.
5. **Physical Runtime Verification:** Testing Dock suppression, Command+Tab interception, and screenshot blacking on actual hardware.

### Transparent Blocker Declaration
In strict conformance with Cortex integrity rules:
* **Status:** **`BLOCKED` on current Windows host.**
* **Policy:** macOS release readiness will **NOT** be claimed until physical Apple Silicon hardware is connected and the testing matrix in [`MACOS_BUILD_AND_TESTING_CHECKLIST.md`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/MACOS_BUILD_AND_TESTING_CHECKLIST.md) is executed.
* **Mitigation:** Controlled pilot begins with the verified Windows client; Mac candidates are accommodated in supervised campus computer labs.

---

## 7. RELEASE ARTIFACT MANIFEST & VERIFIED CHECKSUMS

| Artifact | Location | Size (Bytes) | SHA-256 Digest | Status |
| :--- | :--- | :---: | :--- | :---: |
| **Windows Kiosk Executable** | [`apps/.../bin/CortexLockdown.exe`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/bin/CortexLockdown.exe) | 29,184 | `6A6CD835D3025255DF0D25259371CFEE0CA6D33CC766E98EAE95D6F51BBCC254` | **Verified** |
| **Windows Portable ZIP** | [`apps/.../dist/CortexLockdown-Windows-x64.zip`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip) | 15,440 | `A5906259886357ACDD528FD810ABE6B9E2A64D20CC74A6461497C3D6DBC72BF4` | **Verified** |
| **Windows Installer Script** | [`apps/.../installer/install.bat`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/installer/install.bat) | 1,420 | `7381AE1354F651C6CFB6AC9C94DE67B547514D6005391BE92FE9119FA5FEF645` | **Verified** |
| **Windows Uninstaller Script** | [`apps/.../installer/uninstall.bat`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/installer/uninstall.bat) | 890 | `5019A8068CF1E8E6FA08C360875C3470FE7A1CFE6A36E82956BE4E8B09756DC4` | **Verified** |
| **Inno Setup Script** | [`apps/.../installer/cortex-lockdown.iss`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/installer/cortex-lockdown.iss) | 2,840 | `53930DC0714DCF1BC76176D25DB5F9E032CE8214A6F54CD66299DE04D255746C` | **Verified** |
| **Pilot Management Module** | [`src/lib/lockdown/pilot-config.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts) | 6,850 | `B1E0459C5DE24A5FD02EA46A0B6CDAF484799014166DE749EAA9EC1C0A3373BC` | **Verified** |
| **macOS Build Checklist** | [`apps/.../MACOS_BUILD_AND_TESTING_CHECKLIST.md`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/MACOS_BUILD_AND_TESTING_CHECKLIST.md) | 4,200 | `3656C6CD55A128B46B31DC71E1C598C7B90C286591C68F0D3944F34A80BE2C96` | **Audited** |

---

## 8. CUMULATIVE VERIFICATION SUMMARY

| Test Suite | Purpose | Checks | Pass | Fail | Blocked |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `test-lockdown-windows-security.ts` | Win32 hooks, display affinity, blacklist | 22 | 22 | 0 | 0 |
| `test-lockdown-api-integration.ts` | Policy hashing, launch grants, device trust | 16 | 16 | 0 | 0 |
| `test-lockdown-alpha1-runtime.ts` | Binary PE structure, API routing, WebRTC proctoring | 36 | 35 | 0 | 1 (macOS) |
| `test-lockdown-alpha2-telemetry.ts` | Biometric vision, audio FFT, telemetry pipeline | 24 | 24 | 0 | 0 |
| `test-lockdown-alpha3-packaging.ts` | Protocol handler, portable distribution, web launch | 23 | 23 | 0 | 0 |
| `test-lockdown-alpha4-validation.ts` | Dual-mode face detector, spectral centroid, host guard | 33 | 32 | 0 | 1 (macOS) |
| `test-lockdown-alpha5-adversarial.ts` | Penetration vectors, process renaming, token replay | 20 | 19 | 0 | 1 (macOS) |
| `test-lockdown-alpha6-pilot.ts` | Windows lifecycle, pilot scoping, revocation, dashboard | 23 | 22 | 0 | 1 (macOS) |
| **TOTALS** | **Comprehensive Regression Suite** | **197** | **193** | **0** | **4 (macOS Host Gate)** |

---

## 9. OUTSTANDING BLOCKER REGISTER

1. **macOS Physical Hardware Testing:**
   * **Blocker:** Physical Apple Silicon hardware running macOS 13+ is required to execute `AEAssessmentSession` and verify AAC system kiosk restrictions.
   * **Mitigation:** The Swift codebase is complete, audited, and documented. Controlled pilot starts with the certified Windows application.
2. **Apple Developer ID Assessment Entitlement:**
   * **Blocker:** Production signing of `CortexLockdown.app` requires an institutional Apple Developer Account with the explicit entitlement `com.apple.developer.assessment-mode`.
   * **Mitigation:** Entitlements file is configured. Steps for developer certificate signing and notarization are documented in [`MACOS_BUILD_AND_TESTING_CHECKLIST.md`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/MACOS_BUILD_AND_TESTING_CHECKLIST.md).

---

## 10. FINAL RECOMMENDATION FOR CONTROLLED PILOT AUTHORIZATION

* **Windows Client Readiness:** **APPROVED FOR CONTROLLED PILOT DEPLOYMENT (v1.0.0-rc2)**
* **Pilot Scoping Recommendation:** Deploy strictly to enrolled cohorts (`CSE276`, `CS301`, `CS402`) under `inst_cit_01` and `inst_state_eng`.
* **Production Boundary:** Keep general public production rollout isolated until initial pilot examination results are reviewed by faculty.
* **Reference Repository Isolation:** Confirmed untouched (`cortex-live-class` remains strictly read-only).
