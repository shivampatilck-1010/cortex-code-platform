# CORTEX PLATFORM — ANTIGRAVITY CLI HANDOVER SPECIFICATION

Document Version: 2.0.0  
Classification: Complete Engineering Handover & Agent Continuity Guide  
Date: 2026-11-12  
Repository: https://github.com/shivampatilck-1010/cortex-code-platform (Branch: `main`)  
Workspace Directory: `C:\Users\shiva\.gemini\antigravity\scratch\universal-code-platform`  
Staging Platform URL: `https://cortex-code-platform-staging.cortexbuild1.workers.dev`  
Target Platform: Edge Web (Cloudflare Workers / D1) & Windows 10/11 x64 (Native Kiosk)  

---

## 1. PURPOSE & INTENT

This document serves as the master engineering handover for the Antigravity CLI, autonomous agents, and developers picking up the Cortex platform from this point forward.

It outlines the complete state of the repository, the architectural division of Cortex into **three distinct standalone products**, and the exact step-by-step execution plan for implementing the **Antigravity-inspired flagship production promotional website** on the root route (`/`).

---

## 2. THE THREE DECOUPLED CORTEX PRODUCTS

The platform has evolved from a single monolithic compiler interface into **three decoupled, standalone product suites**:

```
                                 +--------------------------------+
                                 |         CORTEX COMPANY         |
                                 |  Production Website (Route: /) |
                                 |   [Inspired by Antigravity]    |
                                 +---------------+----------------+
                                                 |
             +-----------------------------------+-----------------------------------+
             |                                   |                                   |
             v                                   v                                   v
+--------------------------+        +--------------------------+        +--------------------------+
|       PRODUCT 01:        |        |       PRODUCT 02:        |        |       PRODUCT 03:        |
|        CORTEX IDE        |        |     CORTEX CLASSROOM     |        |      CORTEX BROWSER      |
|  (Developer Workspace)   |        |  (Academic Virtual Labs) |        |  (Lockdown Kiosk Engine) |
+--------------------------+        +--------------------------+        +--------------------------+
| - Route: /ide            |        | - Route: /classroom      |        | - Route: /lockdown       |
| - 16 Cloud Runtimes      |        | - Multi-tenant Courses   |        | - Status: In Development |
| - Monaco Code Editor     |        | - Real-Time Code Sync    |        | - Win32 Display Affinity |
| - Step Debugger          |        | - WebRTC AV Lecture Stage|        | - WH_KEYBOARD_LL Hooks   |
| - Cloud Shell Terminal   |        | - Persistent Whiteboard  |        | - Process Watchdog       |
| - Gemini 2.5 Flash AI    |        | - Project Teams Studio   |        | - 10s Auto-Save Engine   |
| - Clean Dev-Only Navbar  |        | - Assignment Grading     |        | - Architecture Simulator |
+--------------------------+        +--------------------------+        +--------------------------+
```

---

## 3. FILE LOCATION ROADMAP

### 3.1 Web Application & Modular UI (`src/`)

| Path | Purpose & Status |
| :--- | :--- |
| `src/app/page.tsx` | **[NEXT TASK]** To be replaced with the flagship promotional website showcasing the 3 products. |
| `src/app/ide/page.tsx` | **[NEXT TASK]** Move existing raw Monaco IDE code from `src/app/page.tsx` here to create the standalone IDE. |
| `src/app/classroom/page.tsx` | Dedicated standalone **Cortex Classroom** hub (courses, assignments, live rooms). |
| `src/app/classroom/[roomId]/live/` | Real-time virtual lab room (WebRTC AV stage, collaborative multi-cursor editor, whiteboard). |
| `src/app/classroom/teams/` | Student Project Teams Studio (team formation, project gallery, activity timeline). |
| `src/app/lockdown/` | Cortex Lockdown web landing, candidate onboarding, and secure examination workspace. |
| `src/app/[compiler]/` | SEO-optimized compiler entry points for each of the 16 languages (`/cpp`, `/python`, etc.). |
| `src/components/landing/` | **[NEXT TASK]** New directory for the modular Antigravity-style showcase components. |
| `src/components/brand/CortexLogo.tsx` | Official brand logo component with SVG vector emblem and high-res transparent PNG fallback. |
| `public/brand/cortex-logo-transparent.png` | Official high-resolution transparent Cortex emblem (1024x1024). |

### 3.2 Native Windows Lockdown Client (`apps/cortex-lockdown-windows/`)

| Path | Purpose & Key Implementation Details |
| :--- | :--- |
| `apps/cortex-lockdown-windows/src/Program.cs` | Native entry point. Defaults to staging: `https://cortex-code-platform-staging.cortexbuild1.workers.dev/lockdown/workspace`. |
| `apps/cortex-lockdown-windows/src/UI/MainWindow.cs` | Borderless top-most kiosk form (`FormBorderStyle.None`, `TopMost = true`). Enforces full screen bounds. |
| `apps/cortex-lockdown-windows/src/Security/KeyboardHook.cs` | Win32 `WH_KEYBOARD_LL` low-level hook suppressing WinKey, `Alt+Tab`, `Alt+Esc`, `Ctrl+Esc`, `Ctrl+Shift+Esc`, `Alt+Space`, `PrintScreen`. Supervisor emergency exit: `Ctrl + Alt + F10`. |
| `apps/cortex-lockdown-windows/src/Security/DisplayAffinity.cs` | Win32 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` rendering black frames to OBS, Discord, Teams, Zoom, Snagit, Snipping Tool. |
| `apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs` | Background daemon polling active processes every 1,500ms against a 40+ entry blacklist. |
| `apps/cortex-lockdown-windows/src/Security/ClipboardGuard.cs` | Flushes clipboard upon launch (`Clipboard.Clear()`) and isolates internal clipboard state. |

### 3.3 Database & Cloudflare Edge Infrastructure

| Path | Purpose & Key Details |
| :--- | :--- |
| `migrations/0004_online_examination_system.sql` | Relational tables: `exams`, `exam_sections`, `exam_questions`, `exam_sessions`, `exam_question_responses`, `exam_integrity_events`. |
| `wrangler.jsonc` | Cloudflare Workers configuration binding staging D1 database (`cortex-staging-db`) and environment variables. |

---

## 4. IMMEDIATE TASK FOR ANTIGRAVITY CLI: IMPLEMENTING THE PRODUCTION WEBSITE

The Antigravity CLI should execute the approved implementation plan:

### Step 1: Relocate Raw IDE to `/ide`
1. Create `src/app/ide/page.tsx` copying the full interactive Monaco Cloud IDE logic from `src/app/page.tsx`.
2. Ensure `/ide` functions standalone without academic classroom dependencies.

### Step 2: Build the Antigravity-Style Showcase Suite (`src/components/landing/`)
Create the following modular components adhering to the design language of `https://antigravity.google/` (deep obsidian black `#08090A`, frosted glass, subtle orange radiance `#FF9100`, monospace micro-badges, clean sans typography, zero emojis):

1. **`LandingHeaderNav.tsx`**: Minimalist frosted glass navbar with official Cortex logo, Product dropdown (`Cortex IDE`, `Cortex Classroom`, `Cortex Browser`), and glowing `Launch IDE` button.
2. **`LandingHero.tsx`**: Hero section with centered transparent emblem, announcement pill `CORTEX PLATFORM v1.0 // THREE PRODUCTION SUITES`, headline **CODE BEYOND LIMITS**, and 3 quick launch cards.
3. **`LandingStickyNav.tsx`**: Sticky pill progress bar tracking scroll position:
   - `01 // CORTEX IDE`
   - `02 // CORTEX CLASSROOM`
   - `03 // CORTEX BROWSER (IN DEVELOPMENT)`
4. **`IdeProductShowcase.tsx`**: Dedicated showcase for **Product 1 (IDE)** with 16 runtimes, Monaco editor mockup, terminal drawer simulation, and `Launch Standalone IDE &rarr;` CTA linking to `/ide`.
5. **`ClassroomProductShowcase.tsx`**: Dedicated showcase for **Product 2 (Classroom)** with multi-cursor coding preview, WebRTC AV stage, interactive whiteboard, assignment grading, and `Enter Classroom Suite &rarr;` CTA linking to `/classroom`.
6. **`LockdownProductShowcase.tsx`**: Dedicated showcase for **Product 3 (Browser)**:
   - Status badge: `BUILDING BY TEAM // COMING SOON // PLACEHOLDER`.
   - Explanatory note: "Our engineering team is actively building the final release of the Cortex Lockdown client. Explore the architectural preview and interactive security simulation below."
   - Interactive Anti-Cheat Simulator Card with simulation buttons (OBS capture blackout, Alt+Tab hook drop, Process watchdog detection).
   - Actions: `View Complete Requirements Specification`, `Download Documentation Bundle`, `Request Early Access`.
7. **`TechnicalArchitectureGrid.tsx`**: Edge platform architecture specs, latency benchmarks, and performance metrics.
8. **`LandingFooter.tsx`**: Minimalist enterprise footer, status beacon, and site directory.

### Step 3: Replace `src/app/page.tsx`
Assemble the landing components into `src/app/page.tsx` so the root domain hosts the production website.

### Step 4: Verification
```powershell
npm run lint
npm run build
```

---

## 5. ESSENTIAL COMMANDS & WORKFLOWS

Run from `C:\Users\shiva\.gemini\antigravity\scratch\universal-code-platform`:

```powershell
# Start local development server
npm run dev

# Run TypeScript lint check
npm run lint

# Production Next.js build verification
npm run build

# Run automated college demo test suite (22/22 checks)
npx tsx scripts/test-lockdown-college-demonstration.ts

# Regenerate offline HTML preview for Desktop
node scripts/maintenance/generate_readme_preview.cjs
```

---

## 6. PROJECT CONSTRAINTS & GOVERNANCE RULES

Any subsequent agent or Antigravity CLI invocation must strictly adhere to these immutable rules:

1. **Strictly Zero Emojis:** Strictly NO emojis across all source code, comments, commit messages, documentation files, and terminal/chat outputs.
2. **Strictly English Language:** All documentation, logs, code, and commit messages must be strictly in English (zero Hindi or other languages in git history).
3. **Zero Budget Guarantee (₹0):** Maintain ₹0 additional cost. Use only existing Cloudflare free tiers, native Win32 APIs, and open-source tooling.
4. **Preserve Production:** Never alter or push unverified changes to production workers or databases (`cortex-code-platform`, `cortex-db`). Test strictly against staging (`cortex-code-platform-staging.cortexbuild1.workers.dev`, `cortex-staging-db`).

---

## 7. READY-TO-USE PROMPT FOR ANTIGRAVITY CLI

Copy and paste this prompt directly into Antigravity CLI:

```text
You are continuing development on the Cortex Universal Code Platform.
Read the handover document at docs/lockdown/HANDOVER_ANTIGRAVITY_CLI.md and README.md.

Task:
Implement the flagship promotional website on the root domain (/) inspired by https://antigravity.google/, decoupling Cortex into 3 distinct standalone products:
1. Product 1: Cortex IDE -> Move raw IDE from src/app/page.tsx to src/app/ide/page.tsx.
2. Product 2: Cortex Classroom -> Standalone academic collaboration platform at /classroom.
3. Product 3: Cortex Browser -> Lockdown browser placeholder at /lockdown with interactive security simulation ("Building by Team // Coming Soon").
4. Root Route (src/app/page.tsx) -> Assemble the 3-product scrollytelling showcase using src/components/landing/*.

Constraints:
- Strictly ZERO emojis in any code, commit message, or output.
- Strictly English technical language.
- ₹0 budget.
- Verify with npm run lint and npm run build.

Proceed with the implementation following the handover specification.
```
