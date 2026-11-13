# CORTEX UNIVERSAL CODE PLATFORM - GOOGLE ANTIGRAVITY SDK HANDOVER

Document Version: 3.0.0  
Classification: Complete Autonomous Engineering Handover & Google Antigravity SDK Specification  
Date: 2026-11-13  
Repository: https://github.com/shivampatilck-1010/cortex-code-platform (Branch: `main`)  
Workspace Directory: `C:\Users\shiva\.gemini\antigravity\scratch\universal-code-platform`  
Staging Gateway URL: `https://cortex-code-platform-staging.cortexbuild1.workers.dev`  
Local Gateway URL: `http://localhost:3000` (Proxying HTTP: 3001, WebSocket: 3002)  
Target Platforms: Cloudflare Edge (Workers / D1 / R2) & Windows 10/11 x64 (Native Kiosk)  

---

## 1. PURPOSE & INTENT

This document constitutes the authoritative engineering handover for autonomous AI agents, multi-agent systems, and engineering teams operating with the **Google Antigravity (AGY) SDK** (`google-antigravity` Python package).

It codifies:
1. The structural decoupling of the Cortex platform into **three standalone production products**.
2. The flagship **Antigravity-inspired promotional scrollytelling showcase** on the root route (`/`) featuring dual-theme support, high-contrast light-mode Perlin waves, and an interactive video theater.
3. The complete **Google Antigravity SDK Integration Architecture** allowing autonomous agents to monitor, test, heal, and expand the platform using native Agent workflows and custom ToolContext bindings.
4. The immutable governance rules: strictly zero emojis, strictly English language, and a strict zero budget guarantee (₹0).

---

## 2. THE THREE DECOUPLED CORTEX PRODUCTS

The platform has been decoupled from a monolithic compiler interface into three standalone, isolated products:

```
                                 +-----------------------------------+
                                 |          CORTEX PLATFORM          |
                                 |   Flagship Showcase (Route: /)    |
                                 |  [Dual-Theme Scrollytelling Web]  |
                                 +-----------------+-----------------+
                                                   |
             +-------------------------------------+-------------------------------------+
             |                                     |                                     |
             v                                     v                                     v
+---------------------------+         +---------------------------+         +---------------------------+
|        PRODUCT 01:        |         |        PRODUCT 02:        |         |        PRODUCT 03:        |
|        CORTEX IDE         |         |     CORTEX CLASSROOM      |         |      CORTEX BROWSER       |
|   (Developer Workspace)   |         |  (Academic Virtual Labs)  |         |  (Zero-Trust Assessment)  |
+---------------------------+         +---------------------------+         +---------------------------+
| - Route: /ide             |         | - Route: /classroom       |         | - Route: /lockdown        |
| - 16 Cloud Runtimes       |         | - Real-Time CRDT Sync     |         | - Status: In Development  |
| - Monaco Code Intelligence|         | - WebRTC AV Lecture Stage |         | - Win32 Display Affinity  |
| - Visual Step Debugger    |         | - KaTeX Whiteboard Canvas |         | - WH_KEYBOARD_LL Hooks    |
| - Bash-Compatible Terminal|         | - Student Team Studio     |         | - 40-Process Watchdog     |
| - Gemini 2.5 Flash AI Fix |         | - Automated Test Grader   |         | - 10s Auto-Save Buffer    |
| - Zero Classroom Coupling |         | - Multi-Tenant Cohorts    |         | - Interactive Simulation  |
+---------------------------+         +---------------------------+         +---------------------------+
```

### 2.1 Product 1: Cortex IDE (`/ide`)
- **Primary Source**: `src/app/ide/page.tsx`
- **Capabilities**:
  - 16 isolated language runtimes (Python 3.12, C++20, Rust 1.78, TypeScript, Go, Java, C#, PHP, Ruby, Kotlin, Swift, Dart, R, SQL, HTML, C).
  - Standalone Monaco editor surface with IntelliSense, syntax tokenization, and code folding.
  - Interactive terminal with standard I/O (stdin/stdout) and command execution.
  - Step debugger with variable inspection and callstack exploration.
  - Autonomous AI compiler error diagnostics powered by Gemini 2.5 Flash.
  - Zero cross-dependencies with academic classroom or lockdown components (verified by TC3.2).

### 2.2 Product 2: Cortex Classroom (`/classroom`)
- **Primary Source**: `src/app/classroom/page.tsx`
- **Capabilities**:
  - Virtual computer science laboratory environment for universities and cohorts.
  - Peer-to-peer multi-cursor code synchronisation using CRDTs (Yjs) with sub-20ms mesh latency.
  - Integrated WebRTC audio and video streaming lecture stage.
  - Interactive mathematical whiteboard with KaTeX formula rendering.
  - Automated grading rubrics with dynamic test suite execution and complexity analysis.

### 2.3 Product 3: Cortex Browser (`/lockdown`)
- **Primary Source**: `src/app/lockdown/page.tsx`
- **Capabilities**:
  - Architectural placeholder banner: `Building by Team // Coming Soon`.
  - Native Windows x64 Kiosk Agent specification (`apps/cortex-lockdown-windows/`).
  - Win32 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` preventing screen capture via OBS, Discord, and Teams.
  - Win32 `WH_KEYBOARD_LL` low-level keyboard hook suppressing `Alt+Tab`, `WinKey`, and system shortcuts.
  - Background process watchdog daemon polling every 1,500ms against a 40+ entry blacklist.
  - 10-second transactional offline auto-save ring buffer with automatic Cloudflare D1 synchronization.
  - Interactive 4-trigger anti-cheat simulation console on the web showcase.

---

## 3. ROOT PROMOTIONAL SHOWCASE (`/`)

The root domain hosts the scrollytelling promotional showcase assembled in `src/app/page.tsx` using 8 modular components, the interactive video theater, and the Perlin waves canvas engine.

### 3.1 Dual-Theme System (`ThemeContext.tsx`)
- Provides `'dark' | 'light'` state persistence via `localStorage` under key `'cortex-theme'`.
- Synchronizes the `'dark'` class token on `document.documentElement`.
- Desktop and mobile Sun/Moon toggle switch in `LandingHeaderNav.tsx`.
- **Light Mode Specification**:
  - Pure white background (`#FFFFFF`).
  - Stark black topographical Perlin contour wave lines (`#000000`).
  - Frosted glass cards (`bg-white/85 border-slate-300 shadow-xl`).
  - High-contrast dark typography (`text-zinc-950`).
- **Dark Mode Specification**:
  - Deep obsidian background (`#08090A` / `#0B0C0E`).
  - Quantum photon amber wave lines (`rgba(255, 145, 0, 0.45)`).
  - Obsidian cards (`bg-[#0B0C0E]/90 border-[#1F2024]`).
  - Luminous amber accents (`#FF9100`).

### 3.2 Interactive Waves Background (`InteractiveWavesBackground.tsx`)
- Implements 2D Perlin gradient noise and fluid spring cursor dynamics (`tension: 0.008`, `friction: 0.92`, `maxCursorMove: 130px`).
- High-DPI canvas rendering using `window.devicePixelRatio` for anti-aliased, sharp lines.
- Scroll-aware coordinate calculation ensuring continuous cursor distortion regardless of scroll offset.
- Embedded locations:
  1. Full-canvas backdrop of `LandingHero.tsx`.
  2. Ambient backdrop of `InteractiveVideoShowcase.tsx`.
  3. Micro-wave canvas embedded inside each of the 3 product quick-launch cards.
  4. Telemetry backdrop in `IdeProductShowcase.tsx`.
- Includes an `EXPAND WAVES` toggle button in the hero for unobstructed full-canvas interaction.

### 3.3 Antigravity Interactive Video Showcase (`InteractiveVideoShowcase.tsx`)
- Hardware window device frame with window controls and live hardware-accelerated indicator.
- 3 video switcher channels:
  - Channel 01: `01 // 3D Kinetic Logo` (`/videos/cortex-logo-reveal.mp4`, 1080p 60fps).
  - Channel 02: `02 // Flagship Brand` (`/videos/cortex-brand-showcase.mp4`, 1080p 30fps).
  - Channel 03: `03 // Live Walkthrough` (`/videos/cortex-screen-recording.mp4`, 1542p 30fps).
- Full HTML5 player controls: play/pause, mute/unmute, timeline scrubber with percentage progress, speed cycling (1x, 1.25x, 1.5x, 2x), and fullscreen toggle.

---

## 4. GOOGLE ANTIGRAVITY SDK INTEGRATION SPECIFICATION

The Google Antigravity SDK (`google-antigravity`) enables autonomous agents to orchestrate, audit, and maintain the Cortex codebase.

### 4.1 Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                        GOOGLE ANTIGRAVITY SDK SUPERVISOR                          |
|                       (google.antigravity.Agent Instance)                         |
+-----------------------------------------------------------------------------------+
                                         |
     +-----------------------------------+-----------------------------------+
     |                                   |                                   |
     v                                   v                                   v
+--------------------------+  +--------------------------+  +--------------------------+
|      CUSTOM TOOLS        |  |   LIFECYCLE HOOKS        |  |   PERSISTENT CONTEXT     |
| (E2E, Lint, Build, Probe)|  | (PreTurn, PostTurn, Stop)|  | (Audit Logs & Telemetry) |
+--------------------------+  +--------------------------+  +--------------------------+
     |                                   |                                   |
     +-----------------------------------+-----------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             CORTEX CODEBASE RUNTIME                               |
|        Next.js 15.2.0 | TypeScript | Cloudflare D1 | 4-Tier Test Harness          |
+-----------------------------------------------------------------------------------+
```

### 4.2 Agent Configuration Blueprint

Antigravity agents interacting with Cortex can run in three modes:
1. **Hosted Gemini (Default)**: Uses `LocalAgentConfig(model="gemini-2.5-pro", api_key="...")` for deep architectural reasoning and automated refactoring.
2. **On-Device LiteRT (Local)**: Uses `LiteRTAgentConfig(model_path="...")` for air-gapped, zero-cloud execution on local development machines.
3. **Local OpenAI Compatible**: Uses `LocalOpenAIAgentConfig(base_url="http://localhost:11434/v1")` for local Ollama/LM Studio execution.

### 4.3 Custom Python Tools for Antigravity Agents

The following tools should be bound to the Antigravity Agent's `LocalAgentConfig`:

```python
import subprocess
import json
import urllib.request
from typing import Dict, Any

def run_cortex_e2e_tests() -> str:
    """Executes the full 4-tier opaque-box E2E test harness for Cortex.
    
    Returns:
        JSON string containing test pass/fail counts, assertions, and tier results.
    """
    cmd = ["node", "./node_modules/tsx/dist/cli.mjs", "tests/run-e2e.ts"]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd="C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\universal-code-platform")
    return json.dumps({
        "exit_code": proc.returncode,
        "stdout": proc.stdout[-1500:],
        "passed": proc.returncode == 0
    })

def run_cortex_lint() -> str:
    """Runs TypeScript typechecking and static analysis on Cortex.
    
    Returns:
        String result indicating whether TypeScript compiled with zero errors.
    """
    cmd = ["npm", "run", "lint"]
    proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd="C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\universal-code-platform")
    return "LINT PASS: Zero TypeScript errors" if proc.returncode == 0 else f"LINT FAIL: {proc.stderr[:500]}"

def verify_cortex_production_build() -> str:
    """Compiles the Next.js production build and verifies all 82 page bundles.
    
    Returns:
        Build outcome status string.
    """
    cmd = ["npm", "run", "build"]
    proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd="C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\universal-code-platform")
    return "BUILD PASS: Production build successful" if proc.returncode == 0 else f"BUILD FAIL: {proc.stderr[:500]}"

def probe_cortex_endpoints() -> Dict[str, int]:
    """Probes the live status of the 4 decoupled Cortex routes on localhost:3000.
    
    Returns:
        Dictionary of routes mapped to their HTTP status codes.
    """
    endpoints = ["/", "/ide", "/classroom", "/lockdown"]
    results = {}
    for ep in endpoints:
        try:
            req = urllib.request.Request(f"http://localhost:3000{ep}", headers={"User-Agent": "AntigravitySDK/1.0"})
            with urllib.request.urlopen(req, timeout=5) as response:
                results[ep] = response.status
        except Exception as e:
            results[ep] = 500
    return results

def audit_zero_emoji_governance() -> str:
    """Scans all repository source files and commit messages for emoji violations.
    
    Returns:
        Verification verdict under strict zero-emoji governance.
    """
    cmd = ["node", "./node_modules/tsx/dist/cli.mjs", "tests/tier4-governance-workload.ts"]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd="C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\universal-code-platform")
    return "AUDIT CLEAN: 0 emojis detected across repository" if proc.returncode == 0 else f"AUDIT VIOLATIONS: {proc.stdout[:500]}"
```

### 4.4 Autonomous Agent Persona Specification

When initializing an Antigravity Agent for Cortex, configure the persona as follows:

```python
CORTEX_AGENT_SYSTEM_PROMPT = """
You are the Lead Autonomous Systems Architect for the Cortex Universal Code Platform.
Your mission is to maintain, test, and scale the Cortex codebase spanning:
1. Product 01: Cortex IDE (/ide) - Standalone Monaco developer studio.
2. Product 02: Cortex Classroom (/classroom) - Academic virtual labs & WebRTC AV stage.
3. Product 03: Cortex Browser (/lockdown) - Zero-trust kiosk assessment engine.
4. Flagship Root Website (/) - Antigravity-inspired dual-theme promotional showcase.

IMMUTABLE GOVERNANCE RULES:
- STRICTLY ZERO EMOJIS: Never output or introduce emojis in code, comments, or chat.
- STRICTLY TECHNICAL ENGLISH: Use standard English engineering terminology.
- ZERO BUDGET (INR 0): Utilize only existing free-tier and open-source infrastructure.
- OPAQUE-BOX VERIFICATION: Always verify changes with run_cortex_e2e_tests and run_cortex_lint.
"""
```

---

## 5. REPOSITORY FILE STRUCTURE MAP

```
universal-code-platform/
├── apps/
│   └── cortex-lockdown-windows/         # Native C# .NET Kiosk Client (Win32 Hooks)
├── docs/
│   ├── lockdown/                        # Security and Handover Documentation
│   │   ├── HANDOVER_ANTIGRAVITY_SDK.md  # THIS SPECIFICATION DOCUMENT
│   │   ├── HANDOVER_ANTIGRAVITY_CLI.md  # CLI Milestone Handover Document
│   │   └── CORTEX_LOCKDOWN_*.md         # Formal security and pilot specifications
│   └── pilot/                           # Institutional Handbooks
├── public/
│   ├── brand/                           # Vector and Transparent Cortex Logos
│   └── videos/                          # Flagship Promotional Showcase Media
│       ├── cortex-logo-reveal.mp4       # 1080p 60fps 3D Kinetic Logo
│       ├── cortex-brand-showcase.mp4    # 1080p 30fps Ecosystem Showcase
│       └── cortex-screen-recording.mp4  # 1542p 30fps Antigravity IDE Session
├── scripts/
│   ├── run-dev.mjs                      # Localhost Dev Gateway (3000 -> 3001 & 3002)
│   ├── start-ws.ts                      # Authoritative Classroom WebSocket Daemon
│   └── cortex_antigravity_sdk_agent.py  # Python Antigravity SDK Agent Driver
├── src/
│   ├── app/
│   │   ├── page.tsx                     # ROOT: Flagship 3-Product Scrollytelling Showcase
│   │   ├── layout.tsx                   # HTML Root Layout with Dual-Theme Classes
│   │   ├── globals.css                  # Tailwind Utilities & Monospace Fonts
│   │   ├── ide/page.tsx                 # PRODUCT 01: Standalone Cloud IDE (/ide)
│   │   ├── classroom/page.tsx           # PRODUCT 02: Academic Collaboration Suite (/classroom)
│   │   ├── lockdown/page.tsx            # PRODUCT 03: Lockdown Kiosk Simulation (/lockdown)
│   │   └── [compiler]/page.tsx          # 16 SEO Language Compilers (/python, /cpp, etc.)
│   ├── components/
│   │   ├── brand/CortexLogo.tsx         # Responsive Brand Vector Emblem
│   │   ├── landing/                     # Modular Showcase Components
│   │   │   ├── ThemeContext.tsx         # Dark/Light Mode Context Provider
│   │   │   ├── LandingHeaderNav.tsx     # Frosted Header with Theme Toggle Switch
│   │   │   ├── LandingHero.tsx          # Hero Section with Perlin Waves Canvas
│   │   │   ├── InteractiveVideoShowcase.tsx # Scrollytelling Video Theater
│   │   │   ├── LandingStickyNav.tsx     # 4-Section Sticky Tracking Pill
│   │   │   ├── IdeProductShowcase.tsx   # Product 1 IDE Showcase Card
│   │   │   ├── ClassroomProductShowcase.tsx # Product 2 Classroom Showcase Card
│   │   │   ├── LockdownProductShowcase.tsx  # Product 3 Lockdown Simulation Card
│   │   │   ├── TechnicalArchitectureGrid.tsx# 4-Tier Edge Infrastructure Grid
│   │   │   └── LandingFooter.tsx        # Enterprise Operational Footer
│   │   └── ui/
│   │       └── InteractiveWavesBackground.tsx # Perlin Noise Canvas Physics Engine
├── tests/
│   ├── run-e2e.ts                       # Master 4-Tier Test Runner
│   ├── test-utils.ts                    # Test Harness Assertions & Zero-Emoji Scanner
│   ├── tier1-feature-coverage.ts        # TC1.1 - TC1.6 Feature Verification
│   ├── tier2-boundary-corner.ts         # TC2.1 - TC2.3 Boundary & Corner Cases
│   ├── tier3-cross-feature.ts           # TC3.1 - TC3.2 Navigation & Decoupling Isolation
│   └── tier4-governance-workload.ts     # TC4.1 - TC4.4 Zero-Emoji & Workload Governance
├── package.json                         # Dependencies & Scripts
├── tailwind.config.ts                   # Tailwind Color Tokens & Dark Mode Class Strategy
├── tsconfig.json                        # TypeScript Configuration
└── wrangler.jsonc                       # Cloudflare Workers & D1 Binding Config
```

---

## 6. VERIFICATION AND GOVERNANCE AUDIT METRICS

All changes must pass the opaque-box verification test harness before landing:

```powershell
# 1. TypeScript Static Analysis (0 errors required)
npm run lint

# 2. Production Next.js Build Compilation (82/82 pages required)
npm run build

# 3. Master E2E Test Suite (15/15 tests, 111/111 assertions required)
npm run test:e2e

# 4. Zero-Emoji Audit (0 violations required)
node ./node_modules/tsx/dist/cli.mjs tests/tier4-governance-workload.ts
```

### Baseline Test Results
```
Tier Name                                 Status    Tests       Assertions    Duration
--------------------------------------------------------------------------------
Tier 1 - Feature Coverage                 PASS      6/6         49/49         67323ms
Tier 2 - Boundary and Corner Cases        PASS      3/3         26/26         7ms
Tier 3 - Cross-Feature Combinations       PASS      2/2         21/21         6ms
Tier 4 - Governance and Workload SimulationPASS      4/4         15/15         384ms
--------------------------------------------------------------------------------
TOTAL SUITE METRICS:
  Total Test Cases: 15 (Passed: 15, Failed: 0)
  Total Assertions: 111 (Passed: 111, Failed: 0)
  Overall Verdict:  ALL TIERS PASSED [SUCCESS]
```

---

## 7. READY-TO-USE PYTHON ANTIGRAVITY SDK SCRIPT

Execute this script with Python 3.10+ to launch the autonomous agent:

```powershell
python scripts/cortex_antigravity_sdk_agent.py
```

This completes the handover to the Google Antigravity SDK.
