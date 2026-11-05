# Cortex Lockdown v1.0 - Master macOS Native Architecture & Validation Specification

**Document Identifier:** CORTEX-LOCKDOWN-MAC-V1-001  
**Classification:** Cross-Platform Architecture, Swift/AppKit Implementation & AAC Validation  
**Baseline Release:** Cortex Lockdown v1.0 (macOS Candidate Engine)  
**Target Environments:** macOS 12 Monterey, macOS 13 Ventura, macOS 14 Sonoma, macOS 15 Sequoia (Universal Binary: arm64 & x86_64)  
**Date of Publication:** November 2026  

---

## 1. Executive macOS Evaluation & Hardware Gate

The native macOS application for Cortex Lockdown is located at `apps/cortex-lockdown-macos`. It is implemented in native Swift 5.9 utilizing Apple's proprietary **Automatic Assessment Configuration (AAC)** framework, AppKit window shielding, and WebKit.

### Transparent Hardware Gate Statement
The development and acceptance audit environment is a physical Windows 11 x64 workstation (`SHIVAM_1010`).
- Apple Developer tools (`swiftc`, `xcodebuild`, `codesign`, `notarytool`) and the macOS Darwin kernel cannot execute natively on a Windows operating system.
- In accordance with institutional certification standards, Cortex Lockdown refuses to certify macOS runtime readiness based solely on source inspection.
- The macOS implementation is certified as **ARCHITECTURALLY VALIDATED AND SOURCE COMPLETE**, while physical runtime testing remains formally classified as **BLOCKED ON PHYSICAL APPLE SILICON HARDWARE TESTING**.

---

## 2. macOS Native Implementation Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                  macOS DARWIN OPERATING SYSTEM                                    |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | CORTEX LOCKDOWN NATIVE APPLICATION (CortexLockdown.app)                                     |  |
|  | - Protocol Handler: cortex-lockdown:// (Registered in Info.plist CFBundleURLTypes)           |  |
|  | - Hardened WKWebView: JavaScript enabled, AirPlay disabled, Right-click & Drag suppressed   |  |
|  +---------------------------------------------------------------------------------------------+  |
|          |                                            |                                |          |
|          v                                            v                                v          |
|  +-----------------------+                +-----------------------+        +-------------------+  |
|  | Apple Assessment AAC  |                | AppKit Kiosk Manager  |        | Window Shielding  |  |
|  | (AEAssessmentSession) |                | (AppKitKioskController|        | (WindowProtector) |  |
|  +-----------------------+                +-----------------------+        +-------------------+  |
|  - Blocks Notifications                   - disableProcessSwitching        - Borderless window |  |
|  - Blocks Siri & Dictation                - hideDock                       - level = .screenSaver|
|  - Blocks Screen Capture                  - hideMenuBar                    - collectionBehavior|  |
|  - Blocks Predict Keyboard                - disableForceQuit               - .fullScreenPrimary|  |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Apple Assessment Configuration (AAC) Implementation

Located at `apps/cortex-lockdown-macos/Sources/CortexLockdown/Security/AppleAssessmentController.swift`:

```swift
@available(macOS 12.0, *)
public class AppleAssessmentController: NSObject, AEAssessmentSessionDelegate {
    private var session: AEAssessmentSession?
    public private(set) var isActive: Bool = false

    public func beginAssessment() {
        let configuration = AEAssessmentConfiguration()
        configuration.allowsSpellCheck = false
        configuration.allowsPredictiveKeyboard = false
        configuration.allowsKeyboardShortcuts = false
        configuration.allowsActivityContinuation = false
        configuration.allowsDictation = false
        configuration.allowsAccessibilitySpeech = false

        session = AEAssessmentSession(configuration: configuration)
        session?.delegate = self
        session?.begin()
    }

    public func endAssessment() {
        session?.end()
        session = nil
        isActive = false
    }
}
```

### AAC Security Controls
1. **OS-Level Process Locking:** When `AEAssessmentSession.begin()` executes, macOS enters an OS-enforced locked state. Mission Control, App Exposé, the Dock, the menu bar, Command+Tab, and Notification Center are completely disabled by the Window Server.
2. **Screen Capture Suppression:** macOS automatically blacks out the assessment window to third-party screen recording utilities and AirPlay screen mirroring.
3. **Session Interruption Monitoring:** If the user attempts an OS-level override, `assessmentSession(_:wasInterruptedWithError:)` fires, immediately dispatching a telemetry alert to the Proctor Dashboard.

---

## 4. macOS AppKit Kiosk & Window Shielding

1. **Window Level Elevation (`WindowProtector.swift`):**
   - Window style: `[.borderless, .fullSizeContentView]`.
   - Window level: Elevated to `NSWindow.Level.screenSaver`, ensuring the examination canvas floats above all standard desktop windows.
   - Screen bounding: Automatically sizes to `NSScreen.main.frame`.
2. **System Presentation Options (`AppKitKioskController.swift`):**
   ```swift
   let options: NSApplication.PresentationOptions = [
       .hideDock,
       .hideMenuBar,
       .disableProcessSwitching,
       .disableForceQuit,
       .disableSessionTermination,
       .disableHideApplication
   ]
   NSApp.presentationOptions = options
   ```
3. **Clipboard Protection (`PasteboardGuard.swift`):**
   - Calls `NSPasteboard.general.clearContents()` on kiosk initialization and teardown, preventing cross-session clipboard exfiltration.

---

## 5. Entitlements & Notarization Pipeline

### 5.1 Entitlements File (`CortexLockdown.entitlements`)
```xml
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.device.camera</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.developer.assessment</key>
    <true/>
    <key>com.apple.developer.assessment-mode</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
</dict>
```
*Note on `com.apple.developer.assessment`:* This entitlement requires Apple Developer Program institutional provisioning approval from Apple Worldwide Developer Relations.

### 5.2 Build & Notarization Packaging Pipeline (`build-macos.sh`)
```bash
# 1. Compile Universal Binary (arm64 & x86_64)
swift build -c release --arch arm64 --arch x86_64

# 2. Package into .app Bundle
mkdir -p build/CortexLockdown.app/Contents/{MacOS,Resources}
cp .build/apple/Products/Release/CortexLockdown build/CortexLockdown.app/Contents/MacOS/
cp Info.plist build/CortexLockdown.app/Contents/
cp CortexLockdown.entitlements build/CortexLockdown.app/Contents/Resources/

# 3. Codesign with Apple Developer ID Application Certificate
codesign --force --options runtime --deep --sign "Developer ID Application: Cortex Platform Inc" \
         --entitlements CortexLockdown.entitlements build/CortexLockdown.app

# 4. Submit to Apple Notary Service
xcrun notarytool submit CortexLockdown.zip --keychain-profile "CortexNotary" --wait

# 5. Staple Notarization Ticket
xcrun stapler staple build/CortexLockdown.app
```

---

## 6. Actionable Physical Mac Certification Roadmap

To transition Domain 5 from **NO-GO / BLOCKED** to **GO (CERTIFIED READY)**:
1. **Provision Test Hardware:** Procure an Apple Silicon Mac (M2/M3 MacBook Pro or Mac Mini) running macOS 14 Sonoma or macOS 15 Sequoia.
2. **Execute Checklist:** Follow [`MACOS_BUILD_AND_TESTING_CHECKLIST.md`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/MACOS_BUILD_AND_TESTING_CHECKLIST.md) across 15 physical verification gates.
3. **Sign & Notarize:** Apply Apple Developer ID credentials and submit for automated notarization.
4. **Log Runtime Evidence:** Record terminal outputs and system logs into the official testing register.
