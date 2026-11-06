# CORTEX LOCKDOWN — ANTIGRAVITY CLI HANDOVER SPECIFICATION

Document Version: 1.0.0  
Classification: Engineering Handover & Agent Continuity Guide  
Date: 2026-11-06  
Repository: https://github.com/shivampatilck-1010/cortex-code-platform (Branch: `main`)  
Active Workspace: `C:\Users\shiva\.gemini\antigravity\scratch\universal-code-platform`  
Staging Platform URL: `https://cortex-code-platform-staging.cortexbuild1.workers.dev`  
Target OS: Windows 10 / Windows 11 (64-bit Architecture)  

---

## 1. PURPOSE & INTENT

This document provides a complete technical handover for the Antigravity CLI, subagents, or engineers continuing development, testing, maintenance, or audit tasks for the **Cortex Lockdown Browser** and examination ecosystem.

---

## 2. FILE LOCATION MAP & REPOSITORY STRUCTURE

All Cortex Lockdown components are organized across native, web, backend, and documentation subsystems:

### 2.1 Native Windows Client (`apps/cortex-lockdown-windows`)

| File / Directory | Purpose & Key Implementation Details |
| :--- | :--- |
| `apps/cortex-lockdown-windows/src/Program.cs` | Application entry point. Parses CLI arguments (`--url=`, `--examId=`, `--grant=`). Configured to default to staging: `https://cortex-code-platform-staging.cortexbuild1.workers.dev/lockdown/workspace`. |
| `apps/cortex-lockdown-windows/src/UI/MainWindow.cs` | Borderless top-most kiosk form (`FormBorderStyle.None`, `TopMost = true`, `WindowState = FormWindowState.Normal`). Bounded to `Screen.PrimaryScreen.Bounds`. Hosts Edge WebView2 control. |
| `apps/cortex-lockdown-windows/src/Security/KeyboardHook.cs` | Low-level keyboard hook (`WH_KEYBOARD_LL`) via `SetWindowsHookEx`. Blocks WinKey (`VK_LWIN`/`VK_RWIN`), `Alt+Tab`, `Alt+Esc`, `Ctrl+Esc`, `Ctrl+Shift+Esc`, `Alt+Space`, `PrintScreen`, `Alt+F4`. Features proctor emergency exit: `Ctrl + Alt + F10`. |
| `apps/cortex-lockdown-windows/src/Security/DisplayAffinity.cs` | Screen capture suppression via Win32 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE / WDA_MONITOR)`. Renders black surfaces to OBS, Discord, Teams, Zoom, Snagit, Snipping Tool. |
| `apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs` | Background daemon thread polling active processes every 1,500ms against a 40+ entry blacklist (capture tools, remote desktop, secondary browsers, debuggers). |
| `apps/cortex-lockdown-windows/src/Security/ClipboardGuard.cs` | Flushes clipboard upon launch (`Clipboard.Clear()`) and isolates internal clipboard state. |
| `apps/cortex-lockdown-windows/src/Security/EnvironmentInspector.cs` | WMI query inspector detecting hypervisors and VMs (VMware, VirtualBox, QEMU, Hyper-V). |
| `apps/cortex-lockdown-windows/src/Security/TelemetryDispatcher.cs` | WebSocket / HTTP dispatcher streaming security violation events in real time to the server. |
| `apps/cortex-lockdown-windows/src/app.manifest` | Declares DPI awareness (`PerMonitorV2`) and Windows 10/11 compatibility GUIDs. |
| `apps/cortex-lockdown-windows/installer/SetupProgram.cs` | Standalone C# bootstrap installer script compiling `CortexLockdown-Setup.exe`. |

### 2.2 Web Examination Workspace (`src/app/lockdown` & `src/components/lockdown`)

| File / Directory | Purpose & Key Implementation Details |
| :--- | :--- |
| `src/app/lockdown/workspace/page.tsx` | Route: `/lockdown/workspace`. Entry page for the embedded WebView2 browser. |
| `src/components/lockdown/CortexLockdownApp.tsx` | 10-stage onboarding & exam runner: Welcome -> Device Security -> Lobby -> Hardware Readiness -> Instructions -> Secure Workspace -> Confirm Submission -> Results -> Settings -> Error Recovery. |
| `src/lib/lockdown/answer-store.ts` | Client-side encrypted response caching (IndexedDB + AES-GCM). Powers offline resilience and the 10-second transactional auto-save state machine. |
| `src/lib/lockdown/proctoring-engine.ts` | Video frame and audio spectrum analyzer for focus loss, multi-face detection, and audio anomalies. |

### 2.3 Backend API & Cloudflare D1 Relational Storage

| File / Directory | Purpose & Key Implementation Details |
| :--- | :--- |
| `src/app/api/v1/exams/[id]/sync/route.ts` | Delta auto-save sync endpoint handling the 10-second client flush. |
| `src/app/api/v1/exams/[id]/submit/route.ts` | Final exam submission and automated isolate scoring pipeline. |
| `migrations/0004_online_examination_system.sql` | Relational tables: `exams`, `exam_sections`, `exam_questions`, `exam_sessions`, `exam_question_responses`, `exam_integrity_events`. |
| `migrations/0008_examination_phase3_schema_completion.sql` | Extended verification indices and exam status constraints. |
| `wrangler.jsonc` | Cloudflare Workers configuration binding staging D1 database (`cortex-staging-db`) and environment variables. |

### 2.4 Verification Scripts & Release Packages

| File / Directory | Purpose & Key Implementation Details |
| :--- | :--- |
| `scripts/test-lockdown-college-demonstration.ts` | Automated end-to-end test suite (22/22 checks passing). Validates exam initialization, D1 state, auto-save, question bank, and proctoring. |
| `release/windows/CortexLockdown-Setup.exe` | Single-file zero-elevation installer (60,928 bytes, SHA-256: `726e4618990c614df6af947f72167244bd51c37f21396d0889a3f0cd62fcf0c6`). |
| `public/downloads/CortexLockdown-Requirements-Bundle.zip` | Packaged documentation bundle containing requirements, checksums, and architecture. |
| `docs/lockdown/CORTEX_LOCKDOWN_BROWSER_REQUIREMENTS.md` | Exhaustive requirements specification from scratch. |
| `docs/lockdown/CHECKSUMS.txt` | Cryptographic hash index (MD5 & SHA-256) for all released binaries and documents. |

---

## 3. INSTALLED CLIENT & DESKTOP ASSETS

The following assets are installed and verified on the local host machine:

- **Installed Binary:**  
  `C:\Users\shiva\AppData\Local\CortexLockdown\CortexLockdown.exe` (35,840 bytes, SHA-256 `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`)
- **Desktop Shortcut:**  
  `C:\Users\shiva\OneDrive\Desktop\Cortex Lockdown.lnk`  
  *Target argument:* `--url=https://cortex-code-platform-staging.cortexbuild1.workers.dev/lockdown/workspace`
- **Credentials & Access File:**  
  `C:\Users\shiva\OneDrive\Desktop\CORTEX_CREDENTIALS.txt`
- **Standalone Offline GitHub HTML Preview:**  
  `C:\Users\shiva\OneDrive\Desktop\CORTEX_README_GITHUB_PREVIEW.html`
- **Full Documentation Bundle:**  
  `C:\Users\shiva\OneDrive\Desktop\Cortex-README-Documentation-Package.zip`

---

## 4. STAGING DEMO CREDENTIALS & ACTIVE EXAM

- **Staging Platform URL:**  
  `https://cortex-code-platform-staging.cortexbuild1.workers.dev`
- **Faculty / Proctor Login:**  
  Email: `prof.sharma@cortex.internal` | Password: `Password@Demo2026`  
  Role: Course Professor (Course `CSE276`: Advanced Systems Programming)
- **Student Candidate Login:**  
  Email: `student1@cortex.internal` | Password: `Password@Demo2026`  
  Role: Enrolled Student in `CSE276`
- **Active Demo Exam:**  
  ID: `EXAM_CSE276_ACTIVE_MIDTERM`  
  Title: *Midterm Exam: Multithreading, Memory Models & Lock-Free Structures*  
  Duration: 60 mins | Total Points: 100  
  Sections: Single MCQ, Multi MCQ, Numerical Calculation, Monaco Coding Sandbox (live test runner), Descriptive Theory Essay.
- **Emergency Supervisor Exit Hotkey:** `Ctrl + Alt + F10`

---

## 5. ESSENTIAL BUILD & TEST COMMANDS

Execute these commands from `C:\Users\shiva\.gemini\antigravity\scratch\universal-code-platform`:

### 5.1 Recompiling the Native C# Client
```powershell
# Using 64-bit .NET Framework 4.8 CSC compiler
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe `
    /target:winexe `
    /out:bin\CortexLockdown.exe `
    /win32manifest:apps\cortex-lockdown-windows\src\app.manifest `
    /reference:System.Windows.Forms.dll `
    /reference:System.Drawing.dll `
    /reference:System.Management.dll `
    /recurse:apps\cortex-lockdown-windows\src\*.cs
```

### 5.2 Building the Standalone Setup Installer
```powershell
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe `
    /target:winexe `
    /out:release\windows\CortexLockdown-Setup.exe `
    /win32manifest:apps\cortex-lockdown-windows\installer\setup.manifest `
    /reference:System.Windows.Forms.dll `
    /reference:System.Drawing.dll `
    /reference:System.IO.Compression.dll `
    /reference:System.IO.Compression.FileSystem.dll `
    apps\cortex-lockdown-windows\installer\SetupAssemblyInfo.cs `
    apps\cortex-lockdown-windows\installer\SetupProgram.cs
```

### 5.3 Running the College Demonstration Verification Suite
```powershell
npx tsx scripts/test-lockdown-college-demonstration.ts
```

### 5.4 Regenerating Documentation HTML Preview
```powershell
node scripts/maintenance/generate_readme_preview.cjs
```

---

## 6. PROJECT CONSTRAINTS & GOVERNANCE RULES

Any subsequent agent or Antigravity CLI invocation must strictly adhere to these immutable rules:

1. **Zero Emojis:** Strictly NO emojis across all source code, comments, commit messages, documentation files, and terminal/chat outputs.
2. **English Language Only:** All documentation, logs, code, and commit messages must be strictly in English (zero Hindi or other languages in git history).
3. **Zero Budget Guarantee (₹0):** Maintain ₹0 additional cost. Use only existing Cloudflare free tiers, native Win32 APIs, and open-source tooling.
4. **Preserve Production:** Never alter or push unverified changes to production workers or databases (`cortex-code-platform`, `cortex-db`). Test strictly against staging (`cortex-code-platform-staging.cortexbuild1.workers.dev`, `cortex-staging-db`).

---

## 7. PROMPT TEMPLATE FOR ANTIGRAVITY CLI CONTINUATION

Copy and use this prompt in the Antigravity CLI to immediately continue work:

```
You are continuing development on the Cortex Universal Code Platform and Cortex Lockdown Browser.
Read the handover document at docs/lockdown/HANDOVER_ANTIGRAVITY_CLI.md and README.md.

Workspace Root: C:\Users\shiva\.gemini\antigravity\scratch\universal-code-platform
Key Subsystems:
- Native Windows Kiosk: apps/cortex-lockdown-windows/src/
- Web Lockdown Workspace: src/app/lockdown/ and src/components/lockdown/
- Exam APIs & D1 Database: src/app/api/v1/exams/ and migrations/
- Staging URL: https://cortex-code-platform-staging.cortexbuild1.workers.dev
- Emergency Exit Hotkey: Ctrl + Alt + F10

Constraints:
- Strictly ZERO emojis in any code, commit message, or output.
- Strictly English technical language.
- Zero budget (₹0).
- Keep production isolated; use staging environment.

Proceed with the requested task following these specifications.
```
