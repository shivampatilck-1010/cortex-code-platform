# CORTEX LOCKDOWN — MACOS RELEASE BLOCKER REGISTER
Document Identifier: CL-MACOS-BLOCKERS-V1
Version: 1.0.0-rc3
Target OS: macOS 13 (Ventura), macOS 14 (Sonoma), macOS 15 (Sequoia)
Evaluation Platform: Windows Development Host (Cross-Platform Analysis)
Classification: Release Closure Evidence Document
Status: RELEASE BLOCKED (Explicit Gating Decision)

---

## 1. Executive Summary

While Cortex Lockdown v1.0.0-rc3 has achieved technical readiness for managed Windows workstations, the macOS desktop target remains strictly gated and blocked from institutional release. 

Unlike Windows, where Win32 APIs (`SetWindowsHookEx`, `SetWindowDisplayAffinity`, registry protocol registration) provide direct lockdown enforcement, macOS imposes architectural constraints that require specialized OS entitlements, physical Apple Silicon execution environments, and Apple Developer notarization infrastructure.

This document registers the 6 primary technical blockers that prevent macOS release authorization, establishes the objective prerequisites for clearance, and records the formal NO-GO decision for all macOS deployment domains.

---

## 2. Technical Blocker Breakdown

### Blocker 1: Apple Assessment Configuration API (`com.apple.developer.assessment`)
* Severity: CRITICAL BLOCKER (Architectural / Legal)
* Technical Detail:
  On macOS 10.15.4+, Apple introduced the Automatic Assessment Configuration (AAC) framework (`AEAssessmentSession`). This is the only Apple-approved and supported mechanism to place a Mac into a locked-down examination state.
  To instantiate an `AEAssessmentSession`, the application binary MUST be signed with the restricted entitlement `com.apple.developer.assessment`.
* The Entitlement Gate:
  This entitlement is not publicly available to standard Apple Developer accounts. It requires a formal petition and justification to Apple Developer Technical Support, demonstrating compliance with educational assessment standards.
* Alternative Assessment via Accessibility APIs:
  Attempting to implement lockdown on macOS using Accessibility APIs (`AXUIElementCopyAttributeValue`, `CGEventTapCreate`) is prohibited by macOS Sonoma and Sequoia security policies, triggers intrusive TCC (Transparency, Consent, and Control) dialogs, and is bypassed by standard macOS keyboard shortcuts (`Cmd+Option+Esc`, Mission Control gestures, Touch Bar).
* Resolution Prerequisite:
  Submit formal enterprise assessment petition to Apple Developer Program, obtain approval, and configure provisioning profile with `com.apple.developer.assessment = true`.

### Blocker 2: Apple Developer ID Signing & Notarization Pipeline
* Severity: CRITICAL BLOCKER (Supply Chain / Gatekeeper)
* Technical Detail:
  macOS Gatekeeper blocks the execution of any distributed Mach-O binary or `.dmg` installer that lacks an Apple Developer ID Application cryptographic signature and Apple notarization ticket.
* Current Status:
  The current build pipeline produces Windows PE x64 binaries. No macOS Mach-O binary has been signed with an institutional Apple Developer ID.
* Pipeline Requirements:
  1. Apple Developer ID Application Certificate stored in secure Cloud HSM or Apple Keychain.
  2. Hardened Runtime flag (`--options runtime`) enabled during `codesign`.
  3. Automated notarization submission via `xcrun notarytool submit --apple-id ... --team-id ... --wait`.
  4. Ticket stapling to distribution DMG via `xcrun stapler staple`.
* Resolution Prerequisite:
  Enroll in Apple Developer Enterprise Program, procure signing certificate, and integrate `notarytool` into the GitHub Actions macOS runner.

### Blocker 3: Window Level, Kiosk Presentation, and Workspace Isolation
* Severity: MAJOR BLOCKER (System Security)
* Technical Detail:
  To prevent candidate switching away from the exam, macOS requires specific `NSApplicationPresentationOptions`:
  - `NSApplicationPresentationHideDock`
  - `NSApplicationPresentationHideMenuBar`
  - `NSApplicationPresentationDisableProcessSwitching`
  - `NSApplicationPresentationDisableForceQuit`
  - `NSApplicationPresentationDisableSessionTermination`
* Challenges:
  Without AAC, these flags do not fully suppress system hotkeys, Exposé gestures, Corner Actions, or Control Center swipes. Furthermore, on multi-display configurations, macOS Spaces allow candidates to switch virtual desktops without triggering standard window blur events.
* Resolution Prerequisite:
  Implement native Cocoa `AEAssessmentConfiguration` session manager to bind all displays and suppress workspace switching natively.

### Blocker 4: Physical Apple Silicon Test Hardware Deficit
* Severity: CRITICAL BLOCKER (Verification / Non-Repudiation)
* Technical Detail:
  The Cortex Lockdown development and audit environment currently operates on Windows 11 x64 hardware. Emulated or cross-compiled macOS testing cannot validate:
  1. Native ARM64 binary performance and thermal throttling.
  2. WebKit / WKWebView process isolation under memory pressure.
  3. Hardware camera and microphone permission persistence via CoreMedia and AVFoundation.
  4. Apple Silicon Secure Enclave hardware token attestation.
* Policy Rule:
  In accordance with release integrity guidelines, no software target may be certified for release without genuine on-device execution testing.
* Resolution Prerequisite:
  Commission dedicated Apple Silicon (M2/M3) test workstation, execute complete 15-stage acceptance suite natively, and log authentic system telemetry.

### Blocker 5: Multi-Display & Sidecar iPad Detection
* Severity: MAJOR BLOCKER (Proctoring Integrity)
* Technical Detail:
  macOS supports wireless Sidecar display extensions (using iPads) and AirPlay screen mirroring. Standard display enumeration (`NSScreen.screens`) may report virtual displays with differing coordinate spaces.
* Requirements:
  Implement `CGGetActiveDisplayList` and listen for `NSApplicationDidChangeScreenParametersNotification` to immediately blank or terminate sessions when secondary physical or virtual displays are connected.
* Resolution Prerequisite:
  Write and validate native Swift display monitor with zero-tolerance multi-display enforcement.

### Blocker 6: Native Daemon & Watchdog Process Architecture
* Severity: MODERATE BLOCKER (System Architecture)
* Technical Detail:
  Windows uses a Win32 background watchdog (`ProcessWatchdog.cs`). On macOS, background process monitoring without root daemon (`launchd`) privileges cannot inspect processes running under different user contexts or system services.
* Resolution Prerequisite:
  Architect launchd daemon or adopt Apple Endpoint Security (ES) framework for process tracking.

---

## 3. macOS Release Blocker Matrix

| Blocker ID | Domain | Requirement | Current Status | Blocker Severity |
| :--- | :--- | :--- | :--- | :--- |
| BLK-MAC-01 | Entitlements | `com.apple.developer.assessment` | Not Applied / Missing | CRITICAL |
| BLK-MAC-02 | Supply Chain | Apple Developer ID Signing & Notarization | No Apple Certificate | CRITICAL |
| BLK-MAC-03 | UI / Kiosk | AAC Framework Integration | Not Implemented | MAJOR |
| BLK-MAC-04 | Verification | Physical Apple Silicon Hardware Testing | Windows Host Only | CRITICAL |
| BLK-MAC-05 | Hardware | Sidecar & AirPlay Secondary Screen Lock | Not Implemented | MAJOR |
| BLK-MAC-06 | Watchdog | macOS Process Monitoring Architecture | Not Implemented | MODERATE |

---

## 4. Formal Domain Release Decision for macOS

In accordance with strict multi-domain gating standards:

1. macOS Managed Institutional Labs:
   RELEASE STATUS: BLOCKED (NO-GO)
   Justification: Lack of Apple Assessment entitlement, Developer ID notarization, and physical Apple Silicon verification.
2. macOS Unmanaged / BYOD Devices:
   RELEASE STATUS: BLOCKED (NO-GO)
   Justification: Strict macOS security boundaries preclude unmanaged lockdown without supervised MDM profiles.

Cortex Lockdown v1.0.0-rc3 is exclusively authorized for Windows Managed Workstations. macOS support is deferred to Milestone v1.1.0 following Apple Assessment entitlement grant.
