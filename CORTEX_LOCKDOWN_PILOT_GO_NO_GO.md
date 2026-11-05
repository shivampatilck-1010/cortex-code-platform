# CORTEX LOCKDOWN — OPERATIONAL GO / NO-GO DECISION & PILOT RELEASE AUTHORIZATION

Document Reference: `CORTEX_LOCKDOWN_PILOT_GO_NO_GO.md`  
Target Release Candidate: `v1.0.0-rc2`  
Audited Date: November 1, 2026  
Governing Authority: Cortex Platform Security & Assessment Committee  

---

## 1. Formal Decision Summary

| Deployment Track | Platform Target | Recommendation | Operational Status | Authorization Details |
| :--- | :--- | :---: | :---: | :--- |
| **Track A** | **Windows 10/11 x64** | **GO** | **APPROVED FOR CONTROLLED PILOT** | Full cryptographic challenge-response OTP, Win32 low-level hook interception, screen capture shielding, process watchdog, and automated host installer verified across 9 test suites. |
| **Track B** | **macOS Universal Binary** | **NO-GO (PENDING)** | **HELD FOR PHYSICAL HARDWARE AUDIT** | Swift architecture and AEAssessmentSession code are complete and syntax-validated; production release is strictly blocked until physical Apple Silicon hardware test execution. |

---

## 2. Windows Pilot Readiness Justification (GO)

The Windows 10/11 x64 native client ([CortexLockdown.exe](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/bin/CortexLockdown.exe)) has satisfied all security, architectural, and reliability prerequisites for institutional pilot deployment:

1. **Elimination of Static Bypass Vectors**:
   The static emergency password vulnerability (`CortexEmergency2026!`, `cortex`) has been eliminated and replaced with a dynamic, server-authoritative 6-digit HMAC-SHA256 one-time password (OTP) tied to an in-dialog challenge.
2. **Access Control & Anti-Abuse Enforcement**:
   The pilot management endpoint ([/api/v1/lockdown/pilot](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/app/api/v1/lockdown/pilot/route.ts)) enforces strict role-based access control, blocking student reconnaissance, restricting institution revocations to administrators, and sanitizing input parameters against injection.
3. **Reversible Governance & Revocation**:
   Proctors possess dynamic revocation and restoration capabilities, allowing immediate isolation of compromised devices without permanently stranding false-positive candidates.
4. **Desktop Integrity & Safe Teardown**:
   The client's teardown routine releases the `WH_KEYBOARD_LL` low-level hook, unbinds display affinity, and cleanly exits without stranding the student's personal or institutional desktop.
5. **Cumulative Verification Evidence**:
   Across 9 milestone test suites and 220 individual assertions, the Windows stack achieved a 100% pass rate (216 passed, 0 failed, with the 4 blocked checks attributable strictly to the macOS physical hardware gate).

---

## 3. macOS Release Status Justification (NO-GO / PENDING)

The macOS platform implementation remains in **NO-GO (PENDING)** status:

1. **Host Execution Boundary**:
   The available development and testing environment is Windows 10/11 Enterprise x64. macOS execution via Apple Assessment Mode (`AEAssessmentSession`) requires a native Darwin kernel running on genuine Apple hardware.
2. **Entitlement & Notarization Requirement**:
   Apple Automatic Assessment Configuration requires specialized provisioning entitlements (`com.apple.developer.assessment-mode`) granted by Apple Developer Relations, which must be compiled into the binary with Apple Developer ID certificate signing and Apple Notary Service stapling.
3. **Execution Policy**:
   In strict accordance with platform governance rules, macOS will not be marked as ready for production or pilot release based solely on source code inspection. It will remain gated until physical Mac hardware testing is conducted following the procedures in [MACOS_BUILD_AND_TESTING_CHECKLIST.md](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/MACOS_BUILD_AND_TESTING_CHECKLIST.md).

---

## 4. Controlled Pilot Operational Boundaries

To safeguard institutional operations during the pilot phase, the following governance boundaries must be observed:

```
+-----------------------------------------------------------------------------------+
|                        CONTROLLED PILOT BOUNDARIES                                |
+-----------------------------------------------------------------------------------+
| 1. Participating Institutions: Authorized partner campuses only                   |
| 2. Maximum Concurrent Candidates: Capped at pilot quota (default: 50 candidates)  |
| 3. Target Courses: Designated pilot classrooms (e.g., CS 276 Systems Programming) |
| 4. Machine Baseline: Windows 10 (version 1903+) or Windows 11 x64                 |
| 5. Proctored Lab Environment: On-site proctor or verified WebRTC remote proctor   |
| 6. General Platform Isolation: Non-pilot courses continue with web runner        |
+-----------------------------------------------------------------------------------+
```

### Pre-Flight Checklist for Institutional Proctors

* [ ] Verify that candidates have installed Cortex Lockdown `v1.0.0-rc2` using [install.bat](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/install.bat) or the portable archive.
* [ ] Confirm protocol handler registration by verifying that `cortex-lockdown://` launches the client.
* [ ] Verify proctor access to the live examination dashboard in the Cortex Classroom interface.
* [ ] Review the emergency exit procedure (`Ctrl + Alt + F10`) and ensure proctor authorization access to generate OTPs via `/api/v1/lockdown/emergency-exit`.
* [ ] Ensure network firewalls permit outbound HTTPS traffic to the Cloudflare Worker endpoints and WebRTC signaling servers.

---

## 5. Rollback & Emergency Procedures

In the event of an unforeseen hardware incompatibility or network failure during an examination:

1. **Single Candidate Failure**:
   The proctor generates an emergency exit OTP using the student's 4-hex challenge code, cleanly exiting the kiosk. The student can be migrated to a spare proctored workstation; their answers are preserved on the server due to per-question autosaving.
2. **Institutional Disruption**:
   If an entire classroom experiences host workstation or network failures, the faculty instructor or platform administrator executes:
   ```http
   POST /api/v1/lockdown/pilot
   Content-Type: application/json

   {
     "action": "revoke",
     "entityType": "classroom",
     "entityId": "CSE276",
     "reason": "Institutional emergency fallback to standard examination runner"
   }
   ```
   This immediately revokes lockdown enforcement for that classroom. The instructor can then downgrade the exam's security level to `level_1_standard`, enabling candidates to complete the assessment via the standard browser examination interface.
3. **Application Uninstallation**:
   Executing [uninstall.bat](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/uninstall.bat) cleanly purges protocol registration, deletes the `%LOCALAPPDATA%\CortexLockdown` directory, removes Start Menu shortcuts, and restores the machine.

---

## 6. Authoritative Document Sign-Off

* Audit Report: [CORTEX_LOCKDOWN_ALPHA7_SECURITY_AUDIT.md](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/CORTEX_LOCKDOWN_ALPHA7_SECURITY_AUDIT.md)
* Test Evidence: [CORTEX_LOCKDOWN_ALPHA7_TEST_RESULTS.md](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/CORTEX_LOCKDOWN_ALPHA7_TEST_RESULTS.md)
* Pilot Configuration: [pilot-config.ts](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts)
* Release Package: [CortexLockdown-Windows-x64.zip](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip)
