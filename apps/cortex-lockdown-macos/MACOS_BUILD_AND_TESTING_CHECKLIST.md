# CORTEX LOCKDOWN — MACOS PHYSICAL BUILD, SIGNING & VERIFICATION CHECKLIST

**Target Release:** Cortex Lockdown macOS Universal (Apple Silicon & Intel)  
**Bundle Identifier:** `com.cortex.lockdown`  
**Minimum Operating System:** macOS 13.0 (Ventura) or newer  
**Architecture:** Universal Binary (`arm64` + `x86_64`)  
**Security Framework:** Apple Automatic Assessment Configuration (AAC) — `AEAssessmentSession`  
**Standard:** Strictly zero emojis, transparent hardware boundary  

---

## 1. HARDWARE & SYSTEM PREREQUISITES

* [ ] **Physical Mac Hardware:** Apple Silicon Mac (M1/M2/M3/M4) or Intel Core i7/i9 Mac running macOS 13.0 (Ventura), macOS 14.0 (Sonoma), or macOS 15.0 (Sequoia).
  * *Note:* AAC APIs cannot be verified in a non-Apple VM or emulated environment. Physical execution is strictly mandatory.
* [ ] **Xcode & Command Line Tools:** Xcode 15 or 16 installed. Verify via:
  ```bash
  xcode-select -p
  swift --version
  ```
* [ ] **Apple Developer Program Enrollment:** Paid Apple Developer Organization or Individual membership.
* [ ] **Assessment Entitlement Authorization:** Apple approval for `com.apple.developer.assessment-mode` on the target Bundle ID (`com.cortex.lockdown`).

---

## 2. CODE SIGNING IDENTITIES & CREDENTIALS

* [ ] **Developer ID Application Certificate:** Installed in macOS Keychain (`Developer ID Application: Cortex Technology Inc. (TEAM_ID)`).
* [ ] **Developer ID Installer Certificate:** (For PKG installers) Installed in Keychain.
* [ ] **App Store Connect API Key or Notarization Credentials:** Configured in `notarytool`:
  ```bash
  xcrun notarytool store-credentials "cortex-notary-profile" \
    --apple-id "release@cortex.edu" \
    --team-id "TEAM_ID" \
    --password "app-specific-password"
  ```
* [ ] **Entitlements File Audit:** Verify [`CortexLockdown.entitlements`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-macos/CortexLockdown.entitlements) contains:
  * `com.apple.developer.assessment-mode` (`true`)
  * `com.apple.developer.assessment` (`true`)
  * `com.apple.security.device.camera` (`true`)
  * `com.apple.security.device.audio-input` (`true`)
  * `com.apple.security.network.client` (`true`)
  * `com.apple.security.cs.allow-jit` (`true`)

---

## 3. UNIVERSAL COMPILATION & PACKAGING WORKFLOW

Execute the build script on the physical Mac host:
```bash
cd apps/cortex-lockdown-macos
chmod +x build-macos.sh
./build-macos.sh
```

### Manual Step-by-Step Procedure

1. **Compile Universal Binary:**
   ```bash
   swift build -c release --arch arm64 --arch x86_64
   ```
2. **Verify Dual Architecture:**
   ```bash
   lipo -info .build/apple/Products/Release/CortexLockdown
   # Output must indicate: Architectures in the fat file: arm64 x86_64
   ```
3. **Assemble App Bundle:**
   ```bash
   mkdir -p build/CortexLockdown.app/Contents/MacOS
   mkdir -p build/CortexLockdown.app/Contents/Resources
   cp .build/apple/Products/Release/CortexLockdown build/CortexLockdown.app/Contents/MacOS/
   cp Info.plist build/CortexLockdown.app/Contents/Info.plist
   ```
4. **Sign App Bundle with Hardened Runtime:**
   ```bash
   codesign --force --deep --options runtime \
     --entitlements CortexLockdown.entitlements \
     --sign "Developer ID Application: Cortex Technology Inc. (TEAM_ID)" \
     build/CortexLockdown.app
   ```
5. **Verify Gatekeeper Signature:**
   ```bash
   spctl --assess --type execute --verbose build/CortexLockdown.app
   # Output must report: build/CortexLockdown.app: accepted
   ```
6. **Package DMG & Notarize:**
   ```bash
   hdiutil create -volname "Cortex Lockdown" -srcfolder build/CortexLockdown.app -ov -format UDZO dist/CortexLockdown-macOS-Universal.dmg
   xcrun notarytool submit dist/CortexLockdown-macOS-Universal.dmg --keychain-profile "cortex-notary-profile" --wait
   xcrun stapler staple dist/CortexLockdown-macOS-Universal.dmg
   ```

---

## 4. PHYSICAL RUNTIME VALIDATION TEST MATRIX

Perform these dynamic tests inside an active session on the physical Mac:

| Test ID | Test Description | Expected Behavior | Physical Verification Status |
| :--- | :--- | :--- | :--- |
| **MAC-P01** | AAC Session Activation | `AEAssessmentSession.begin()` succeeds without throwing errors | Pending Physical Mac |
| **MAC-P02** | Dock & Menu Bar Suppression | Dock does not appear when cursor moves to screen edge; Menu bar is hidden | Pending Physical Mac |
| **MAC-P03** | Mission Control & Spaces | Swipe gestures for Mission Control and switching spaces are blocked | Pending Physical Mac |
| **MAC-P04** | Command + Tab Interception | Application switcher HUD does not appear on Command+Tab | Pending Physical Mac |
| **MAC-P05** | Screen Capture Shielding | Screenshots (Cmd+Shift+3) and QuickTime screen recording produce black window | Pending Physical Mac |
| **MAC-P06** | Hardware Camera & Mic Access | macOS TCC privacy dialog prompts for camera/mic; video renders in PIP preview | Pending Physical Mac |
| **MAC-P07** | Custom Protocol Invocation | Safari/Chrome opens `cortex-lockdown://launch?...`; URL passed to `AppDelegate` | Pending Physical Mac |
| **MAC-P08** | Clean Teardown & Recovery | `AEAssessmentSession.end()` restores desktop state, dock, and menu bar | Pending Physical Mac |

---

## 5. HARDWARE STATUS & RELEASE GOVERNANCE

* **Current Status:** macOS subsystem is fully implemented in Swift and validated by source/structure audit.
* **Release Boundary:** In strict adherence to Cortex honesty guidelines, macOS is **NOT** marked as released until all physical tests in Section 4 are executed on an Apple device.
* **Institutional Pilot Action:** Windows release is cleared for pilot deployment; Mac students will take examinations in supervised on-campus lab facilities or via macOS pilot devices following completion of this checklist.
