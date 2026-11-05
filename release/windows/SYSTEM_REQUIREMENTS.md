# CORTEX LOCKDOWN — SYSTEM REQUIREMENTS & COMPATIBILITY MATRIX

**Document Version:** 1.0.0-rc1.2  
**Strictly Zero Emojis Enforced:** Yes  

---

## 1. Supported Platforms & Hardware Baseline

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 Version 1809 (Build 17763)+ | Windows 11 Build 22621+ (x64) |
| **Architecture** | 64-bit (x64) | 64-bit (x64) AMD/Intel |
| **Processor** | Dual-core 1.8 GHz x64 | Quad-core 2.4 GHz+ x64 |
| **Memory (RAM)** | 4.0 GB Physical RAM | 8.0 GB+ Physical RAM |
| **Disk Storage** | 100 MB available local disk space | 500 MB SSD storage |
| **Display** | 1280x720 resolution (Single physical display) | 1920x1080 resolution (Single physical display) |
| **Camera & Audio** | Standard USB webcam & microphone | 720p HD webcam & noise-filtering mic |
| **Network Interface** | 1.0 Mbps sustained broadband | 10.0 Mbps+ low-latency connection |

---

## 2. Required Software Runtimes

1. **Microsoft .NET Framework 4.8 or Newer:**
   - Pre-installed by default on Windows 10 Version 1903+ and all Windows 11 releases.
   - Verification key: `HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full` (`Release` >= 528040).
2. **Microsoft Edge WebView2 Evergreen Runtime:**
   - Bundled with modern Windows 10 and Windows 11.
   - Required for rendering secure exam interfaces inside the isolated Win32 frame.

---

## 3. Platform Compatibility & Architectural Status

- **Windows 10 / Windows 11 (x64):** **FULLY SUPPORTED & VERIFIED**. Native Win32 hooks (`WH_KEYBOARD_LL`), `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`, and process watchdog confirmed.
- **Windows on ARM (ARM64):** **EMULATED ONLY**. Executes via Windows 11 x64 emulation layer. Not natively compiled.
- **Apple macOS:** **BLOCKED / NON-GOAL**. Cortex Lockdown uses Windows Win32 API subsystems. macOS Cocoa/Quartz architecture is not implemented.
- **Linux Platform:** **BLOCKED / NON-GOAL**. Linux desktop environments lack standardized display affinity APIs.
