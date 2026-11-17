# Safe Exam Browser (SEB) Assessment Flow Hardening
## Production Deployment, Administration, and Student Operations Guide

---

## Document Control & Metadata
- **System**: Cortex Universal Online Examination & Assessment Platform
- **Component**: Safe Exam Browser (SEB) Cryptographic Lockdown & Assessment Flow Hardening
- **Specification Conformance**: [Safe Exam Browser Config Key Specification](https://safeexambrowser.org/developer/seb-config-key.html)
- **Target Audience**: DevOps Engineers, System Administrators, Course Instructors, Proctors, and Candidates
- **Status**: Production Ready

---

## Table of Contents
1. [Executive Overview & Architecture](#1-executive-overview--architecture)
2. [Installation & Prerequisites](#2-installation--prerequisites)
3. [Environment Configuration & Database Migrations](#3-environment-configuration--database-migrations)
4. [Instructor & Administrator Guide](#4-instructor--administrator-guide)
5. [Student Operations Guide](#5-student-operations-guide)
6. [Production Deployment & Reverse Proxy Architecture](#6-production-deployment--reverse-proxy-architecture)
7. [Troubleshooting & Diagnostic Guide](#7-troubleshooting--diagnostic-guide)
8. [Testing & Verification Runbook](#8-testing--verification-runbook)

---

## 1. Executive Overview & Architecture

### 1.1 Purpose & Scope
The Cortex Safe Exam Browser (SEB) Hardening integration provides military-grade cryptographic verification, application-level kiosk lockdown, and replay protection for high-stakes examinations and programming assignments. By transforming unmanaged student computers into secure, sandboxed testing environments, Cortex ensures examination integrity across remote, hybrid, and proctored institutional assessments.

Unlike superficial user-agent checks or client-side JavaScript locks, the Cortex SEB hardening architecture enforces **strict server-authoritative cryptographic validation**. No question data, starter code, test cases, or response submissions are accessible outside of a verified, genuine Safe Exam Browser instance.

```
                           +-------------------------------------------------------+
                           |           Instructor / Assessment Author              |
                           +-------------------------------------------------------+
                                                      |
                                      Creates Assessment (Exam/Assignment)
                                         Sets Security Level = 'seb'
                                                      |
                                                      v
                                   +--------------------------------------+
                                   |       Cortex API & Config Engine     |
                                   |  (generateSafeExamBrowserConfigPlist)|
                                   +--------------------------------------+
                                           |                      |
                    Exports .seb Plist XML |                      | Issues One-Click URI
                    (Apple XML Plist 1.0)  |                      | (sebs:// protocol)
                                           v                      v
+---------------------------------------------------------------------------------------------------------+
|                                              Candidate Device                                           |
|                                                                                                         |
|  [Standard Web Browser]                                                                                 |
|     |                                                                                                   |
|     +--> Hits /classroom/.../exam or /solve                                                            |
|          |                                                                                              |
|          +--> Blocked by Accessible Setup Gate (role="alertdialog")                                     |
|               Provides download link, .seb config, or one-click sebs:// launcher                        |
|                                                                                                         |
|  [Safe Exam Browser Kiosk]                                                                              |
|     |                                                                                                   |
|     +--> Launches via sebs:// or opens .seb file                                                        |
|     +--> Locks Display (kiosk mode, taskbar disabled, URL filter enabled, clipboard blocked)            |
|     +--> Sends Cryptographic Headers:                                                                   |
|          * X-SafeExamBrowser-RequestHash = SHA256(CanonicalURL + BEK)                                   |
|          * X-SafeExamBrowser-ConfigKeyHash = SHA256(CanonicalURL + CK)                                  |
|          * X-SEB-Launch-Token (HMAC-SHA256, 10-min TTL, single-use nonce)                              |
+---------------------------------------------------------------------------------------------------------+
                                                      |
                                                      v
                                   +--------------------------------------+
                                   |    Reverse Proxy / Ingress Gateway   |
                                   |      (NGINX / Caddy / Cloudflare)    |
                                   |  * Strips default ports (:80, :443)  |
                                   |  * Forwards X-Forwarded-Proto/Host   |
                                   +--------------------------------------+
                                                      |
                                                      v
+---------------------------------------------------------------------------------------------------------+
|                                      Cortex Application Server (Next.js)                                |
|                                                                                                         |
|  [Layer 1: Cryptographic Engine (`seb-security.ts`)]                                                    |
|     - Candidate URL Reconstruction (Protocol & Host normalization, port stripping)                       |
|     - Timing-Safe Comparison (`safeTimingEqual`) resisting side-channel attacks                         |
|     - Authoritative Key Derivation (`deriveAuthoritativeBrowserExamKey`) using server pepper            |
|     - Launch Token Signature & Claims Validation (`verifyAndConsumeSebLaunchToken`)                     |
|                                                                                                         |
|  [Layer 2: Relational Replay Guard (`seb-token-registry.ts` & `migrations/0011`)]                       |
|     - In-Memory Hot Cache + Persistent SQLite / PostgreSQL `seb_consumed_tokens` table                  |
|     - Atomic single-use nonce consumption prevents launch token replay                                  |
|                                                                                                         |
|  [Layer 3: API Gateways (`/api/v1/classrooms/...`)]                                                     |
|     - Exam Start (`/start`), Responses (`/responses`), Submissions (`/submit`) enforce SEB verification  |
|     - Assignment Details & Submissions enforce SEB verification (redacting code & questions on failure)  |
|     - Idempotent submission handling: Retries return 200 OK with existing submission receipt             |
|                                                                                                         |
|  [Layer 4: Frontend Lifecycle & Accessibility (`ExamRunnerModal.tsx` & `solve/page.tsx`)]                |
|     - Server-authoritative countdown timer with monotonic clock drift synchronization                   |
|     - Offline-resilient autosave queue with localStorage backup and auto-resynchronization              |
|     - Safe branding theme engine (strict hex colors, zero arbitrary CSS execution)                      |
+---------------------------------------------------------------------------------------------------------+
```

---

### 1.2 Core Architectural Layers

The SEB hardening architecture spans four cohesive layers:

#### Layer 1: Cryptographic Engine & Replay Protection (`src/lib/classroom/seb-security.ts`, `seb-token-registry.ts`)
1. **SEB-JSON Canonicalization (`canonicalizeSebValue`)**:
   Recursively sorts dictionary keys in alphabetical order, strips metadata elements (`originatorVersion`, `browserExamKey`, `sebConfigKey`), converts dates to ISO strings, and serializes into compact JSON without whitespace.
2. **Official Config Key (CK) Generation (`computeOfficialSebConfigKey`)**:
   Computes the SHA-256 digest over the canonical JSON string, yielding a 64-character lowercase hexadecimal hash.
3. **Browser Exam Key (BEK) & Config Key Request Hash Verification (`computeSafeExamBrowserHash`)**:
   Computes `SHA256(CanonicalURL + Key)` across dynamically generated candidate URLs to validate incoming HTTP headers (`X-SafeExamBrowser-RequestHash`, `X-SafeExamBrowser-ConfigKeyHash`) and JavaScript client keys.
4. **Authoritative Key Derivation (`deriveAuthoritativeBrowserExamKey`)**:
   Replaces client-visible, deterministic keys with server-managed HMAC-SHA256 digests bound to `assessmentId`, `classroomId`, and the backend secret pepper (`LOCKDOWN_SERVER_PEPPER` / `LOCKDOWN_POLICY_SECRET`).
5. **Constant-Time String Comparison (`safeTimingEqual`)**:
   Performs length-checked constant-time buffer comparison via Node's `crypto.timingSafeEqual`, thwarting timing side-channel attacks.
6. **Signed Single-Use Launch Tokens (`createSebLaunchToken`, `verifyAndConsumeSebLaunchToken`)**:
   Generates compact, HMAC-SHA256 signed Base64URL tokens containing claims (`userId`, `assessmentId`, `assessmentType`, `classroomId`, `jti` nonce, `iat`, `exp`). Tokens have a default 10-minute (600s) time-to-live (TTL).
7. **Apple Plist XML Configuration Generator (`generateSafeExamBrowserConfigPlist`)**:
   Constructs valid Apple XML Plist 1.0 files embedding deep-link `startURL`, post-submit `quitURL`, SHA-256 `hashedQuitPassword`, full-screen kiosk policies, and strict domain `URLFilterRules`.

#### Layer 2: Database Schema & Relational Store (`migrations/0011_seb_assessment_hardening.sql`, `src/lib/classroom/models.ts`, `src/lib/classroom/db/index.ts`)
- **Assessment Extensions**: Adds `security_level`, `seb_config_key`, `seb_browser_exam_key`, `seb_quit_password`, `seb_quit_password_hash`, `seb_allow_reload`, `seb_show_reload_warning`, `duration_minutes`, and `branding_theme_json` to `assignments` and `exams`.
- **Persistent Replay Store**: Table `seb_consumed_tokens` records consumed nonces (`nonce`, `user_id`, `assessment_id`, `consumed_at`, `expires_at`).
- **Data Access API**:
  - `consumeSebToken(nonce, userId, assessmentId, expiresAt)`: Performs atomic insertion with primary key uniqueness guarantees.
  - `isSebTokenConsumed(nonce)`: Fast lookup to reject replayed tokens.
  - `cleanupExpiredSebTokens(now)`: Maintenance routine purging expired tokens based on `expires_at`.

#### Layer 3: API Gateways & Route Protection (`src/app/api/v1/classrooms/[id]/...`)
- **Exam Configuration Route (`exams/[examId]/seb-config`)**:
  Generates custom `.seb` files and JSON responses containing deep links, launch tokens, and `sebs://` protocol launch URIs.
- **Exam Start Route (`exams/[examId]/start`)**:
  Enforces cryptographic header or JS API verification. Unverified requests receive HTTP 403 with setup gate payload. Verified requests consume the single-use launch token.
- **Exam Responses Route (`exams/[examId]/sessions/[sessionId]/responses`)**:
  Guards autosave operations. Any request lacking valid SEB cryptographic headers is rejected with HTTP 403.
- **Exam Submit Route (`exams/[examId]/sessions/[sessionId]/submit`)**:
  Guards final submission. Features **idempotent submission handling**: resubmitting an already-submitted session returns HTTP 200 OK along with the original submission record and auto-score.
- **Assignment Configuration & Solution Endpoints (`assignments/[asgId]/seb-config`, `assignments/[asgId]`, `assignments/[asgId]/submit`)**:
  Ensures 100% parity with exams. Problem statements and starter code are strictly redacted unless accessed within a cryptographically verified SEB session.

#### Layer 4: Frontend Lifecycle, Accessible Gate & Deep Launch
- **Accessible Setup Gate (`role="alertdialog"`, `aria-modal="true"`)**:
  Renders when an unverified browser attempts to open an SEB assessment. Conforms to WCAG 2.1 AA with focus management, accessible headings, official download links, and retry actions.
- **Dual Verification Channels**:
  Supports both native HTTP headers and `window.SafeExamBrowser.security.updateKeys()` JavaScript API integration for flexible client configurations.
- **Server-Authoritative Timer (`serverTimeOffset`)**:
  Measures `serverTimeOffset = serverTime - Date.now()` on session start and heartbeats, calculating remaining time against the server's monotonic clock to prevent local clock tampering.
- **Safe Branding Engine**:
  Provides curated theme presets (`cortex-dark`, `slate-dark`, `midnight-blue`, `classic-light`) and strict `#RGB` / `#RRGGBB` hex validation. Neutralizes dangerous URL schemes (`javascript:`, `data:`, `vbscript:`, `file:`) and prohibits arbitrary CSS injection.

---

## 2. Installation & Prerequisites

### 2.1 Supported Platforms
Safe Exam Browser is supported on the following operating systems:
- **Windows**: Windows 10 (x64) and Windows 11 (x64). Requires Microsoft Edge WebView2 Runtime.
- **macOS**: macOS 11 (Big Sur), macOS 12 (Monterey), macOS 13 (Ventura), and macOS 14 (Sonoma). Compatible with Intel and Apple Silicon (M1/M2/M3) Macs.
- **iOS / iPadOS**: iOS 13+ and iPadOS 13+. Recommended for supervised institutional iPads with Apple Configurator or MDM.

### 2.2 Official Download Link
Always install Safe Exam Browser from the official repository:
- **Official Portal**: [https://safeexambrowser.org/download_en.html](https://safeexambrowser.org/download_en.html)

### 2.3 Platform-Specific Installation Steps

#### Windows Installation:
1. Download the latest SEB 3.x installer (`SafeExamBrowser-3.x.x-Setup.exe`).
2. Run the installer as Administrator.
3. If prompted, allow installation of the **Microsoft Edge WebView2 Runtime**.
4. Complete the installation wizard. No manual configuration is necessary; Cortex will configure SEB dynamically via `.seb` files or `sebs://` links.

#### macOS Installation:
1. Download the macOS disk image (`SafeExamBrowser-3.x.dmg`).
2. Open the downloaded `.dmg` file and drag `Safe Exam Browser.app` to `/Applications`.
3. Launch `Safe Exam Browser` once from Applications. If macOS displays a Gatekeeper prompt ("Downloaded from the internet"), select **Open**.
4. Grant Accessibility and Screen Recording permissions if prompted by macOS System Settings.

#### iOS / iPadOS Installation:
1. Open the Apple App Store on your iPad or iPhone.
2. Search for **Safe Exam Browser** (developed by ETH Zurich).
3. Install the application.
4. For high-stakes institutional testing, configure **Autonomous Single App Mode (ASAM)** or **Guided Access** through Apple School Manager or MDM.

---

## 3. Environment Configuration & Database Migrations

### 3.1 Environment Configuration (`.env`)

Cortex utilizes dedicated cryptographic secrets to secure launch tokens and derive authoritative keys. Configure these in `.env.local` or your production environment:

```env
# Core Runtime Environment ('development' | 'staging' | 'production')
APP_ENV=production

# Cortex Session and Authentication Secret
CORTEX_SESSION_SECRET=e7b4c91038592fa4219485b018305c48b71d930284759281a9c3d4e5f6a7b8c9

# Cortex Lockdown Security Policy HMAC Secret (Required in production)
LOCKDOWN_POLICY_SECRET=9f8e7d6c5b4a3210fedcba9876543210abcdef0123456789abcdef0123456789

# Cortex Lockdown Server Cryptographic Pepper for Recovery OTP Digests & Authoritative Keys (Required in production)
LOCKDOWN_SERVER_PEPPER=a1b2c3d4e5f67890123456789abcdef0fedcba9876543210abcdef0123456789

# Safe Exam Browser (SEB) Single-Use Launch Token Cryptographic Secret (Required in production)
SEB_LAUNCH_TOKEN_SECRET=3b7c9e1f5a8d2e4c6b0a9f8e7d6c5b4a3210fedcba9876543210abcdef012345
```

#### Secret Roles & Sensitivity:
| Variable | Minimum Entropy | Role & Cryptographic Impact |
|---|---|---|
| `SEB_LAUNCH_TOKEN_SECRET` | 256 bits (32 hex bytes) | Signs and verifies single-use SEB launch tokens (`HS256`). If compromised, unauthorized clients could forge valid launch tokens for arbitrary student IDs. |
| `LOCKDOWN_POLICY_SECRET` | 256 bits (32 hex bytes) | Fallback secret for lockdown mechanisms and launch grants. |
| `LOCKDOWN_SERVER_PEPPER` | 256 bits (32 hex bytes) | Cryptographic pepper used in `deriveAuthoritativeBrowserExamKey()`. Ensures Browser Exam Keys cannot be reversed or precomputed from public database records. |

#### Production Generating Command:
Generate secure secrets using OpenSSL:
```bash
openssl rand -hex 32
```

#### Secret Resolution Hierarchy:
In `src/lib/classroom/seb-security.ts`:
- `getLockdownSecret()` resolves in order: `LOCKDOWN_POLICY_SECRET` -> `LOCKDOWN_SERVER_PEPPER` -> `SEB_LAUNCH_TOKEN_SECRET` -> dev fallback.
- `getSebLaunchTokenSecret()` resolves in order: `SEB_LAUNCH_TOKEN_SECRET` -> `LOCKDOWN_POLICY_SECRET` -> dev fallback.
- *In production environments (`APP_ENV=production`), hardcoded development seeds must never be used.*

---

### 3.2 Database Migration (`migrations/0011_seb_assessment_hardening.sql`)

Migration `0011` applies necessary database schema extensions for SEB enforcement and replay attack defense.

#### Schema Changes Overview:
```sql
-- 1. Extend assignments table with Safe Exam Browser (SEB) security and branding controls
ALTER TABLE assignments ADD COLUMN security_level TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE assignments ADD COLUMN seb_config_key TEXT;
ALTER TABLE assignments ADD COLUMN seb_browser_exam_key TEXT;
ALTER TABLE assignments ADD COLUMN seb_quit_password TEXT;
ALTER TABLE assignments ADD COLUMN seb_quit_password_hash TEXT;
ALTER TABLE assignments ADD COLUMN seb_allow_reload INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN seb_show_reload_warning INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assignments ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN branding_theme_json TEXT NOT NULL DEFAULT '{}';

-- 2. Extend exams table with safe branding theme controls
ALTER TABLE exams ADD COLUMN branding_theme_json TEXT NOT NULL DEFAULT '{}';

-- 3. Create persistent single-use SEB launch token registry for replay attack prevention
CREATE TABLE IF NOT EXISTS seb_consumed_tokens (
  nonce TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  consumed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 4. Create performance indices for token cleanup and assessment queries
CREATE INDEX IF NOT EXISTS idx_seb_consumed_tokens_expires ON seb_consumed_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_seb_consumed_tokens_lookup ON seb_consumed_tokens(assessment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_security ON assignments(classroom_id, security_level);
```

#### Executing the Migration:
For SQLite (default development / embedded deployment):
```bash
sqlite3 database.sqlite < migrations/0011_seb_assessment_hardening.sql
```

For PostgreSQL (production relational cluster):
Apply the equivalent DDL statements with appropriate types (`INTEGER` to `BIGINT` for timestamps, `TEXT` for JSON strings).

---

## 4. Instructor & Administrator Guide

### 4.1 Configuring Examinations with SEB Security
1. Log in to Cortex as a Teacher or Administrator and open your classroom.
2. Navigate to the **Examinations** tab and click **Create Examination** (or click **Edit** on an existing exam).
3. In the Exam Builder Modal:
   - Enter **Title**, **Description**, **Start Window**, and **End Window**.
   - Set **Duration (Minutes)** (e.g., 60 minutes).
   - Under **Security Level**, select:
     `Level 3: Institution-Managed Restricted Examination (Safe Exam Browser)`
4. The **Safe Exam Browser (SEB) Settings** panel will automatically expand.

```
+-------------------------------------------------------------------------------+
| Safe Exam Browser (SEB) Settings                                              |
|                                                                               |
| Quit Password (Optional): [ ********** ]                                      |
| [ ] Allow page reload in SEB                                                  |
| [x] Show warning before reload                                                |
|                                                                               |
| Safe Branding & Theme Customization:                                          |
| (•) Cortex Dark    ( ) Slate Dark    ( ) Midnight Blue    ( ) Classic Light   |
| Accent Color (Strict Hex): [ #FF9100 ]                                         |
| Institution Name: [ National Coding Institute ]                               |
| Institution Logo URL: [ https://assets.institute.edu/logo.png ]               |
+-------------------------------------------------------------------------------+
```

---

### 4.2 Configuring Assignments with SEB Security
1. Navigate to the **Assignments** tab and click **Create Assignment**.
2. Under Assessment Settings:
   - Select **Security Level**: `Safe Exam Browser (SEB)`.
   - Set **Duration Limit** (0 for unlimited until deadline, or set specific test minutes).
   - Configure **Quit Password**, **Allow Reload**, and **Show Reload Warning**.
3. Save the assignment. Students will now be barred from viewing the problem description or starter code until they enter via SEB.

---

### 4.3 Quit Password & SHA-256 Client Hashing
- **Purpose**: Prevents students from exiting full-screen kiosk mode before completing and submitting their assessment.
- **Client Hashing**: The quit password is automatically hashed using SHA-256 (`crypto.createHash('sha256').update(password.trim()).digest('hex')`) before inclusion in the `.seb` configuration plist. The plaintext password is never exposed in client configuration files.
- **Proctor Usage**: If a student experiences a hardware emergency (e.g., failed keyboard), the proctor can press `Ctrl+Q` (Windows) or `Cmd+Q` (macOS), enter the quit password, and safely exit the SEB kiosk.

---

### 4.4 Page Reload Permissions & Warnings
- **Allow page reload (`sebAllowReload`)**:
  - Default: `false`.
  - Disables F5, Ctrl+R, and browser reload buttons in SEB.
  - Setting to `false` prevents candidates from accidentally resetting client state or attempting to re-fetch question data.
- **Show warning before reload (`sebShowReloadWarning`)**:
  - Default: `true`.
  - If reload is permitted, displays an explicit modal warning confirming that the student wishes to reload the assessment page.

---

### 4.5 Safe Branding Theme Customization
Cortex allows institutions to brand the exam environment without exposing the platform to CSS injection, cross-site scripting (XSS), or malicious script payloads:
1. **Theme Presets**:
   - `cortex-dark`: Dark background (`#08080a`), high-contrast dark cards (`#101116`), signature neon amber accent (`#FF9100`).
   - `slate-dark`: Slate background (`#0b0f19`), slate card container (`#111827`), cyan accent (`#0ea5e9`).
   - `midnight-blue`: Deep navy background (`#0a0e1a`), navy cards (`#0f172a`), royal blue accent (`#3b82f6`).
   - `classic-light`: Clean institutional light slate background (`#f8fafc`), white cards (`#ffffff`), indigo accent (`#4f46e5`).
2. **Strict Hex Accent Validation**:
   - Accepts only valid `#RGB` or `#RRGGBB` strings matching `/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/`.
   - Rejects CSS declarations, expressions, or HTML tags (e.g., `red; background: url(...)` is blocked).
3. **Logo URL Sanitation**:
   - Accepts only secure HTTPS URLs (`https://...`).
   - Strictly neutralizes dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`).

---

### 4.6 Exporting Configurations & Protocol Links
Instructors can distribute configurations in two ways:
1. **One-Click `sebs://` Protocol URI**:
   - Copy the direct link from the Exam Card in the Examinations tab.
   - Example: `sebs://cortex.example.edu/api/v1/classrooms/CLS123/exams/EX456/seb-config?launchToken=...`
   - Clicking this link in any browser automatically triggers the local Safe Exam Browser application.
2. **Downloadable `.seb` Configuration File**:
   - Click **Download .seb File** in the Exam Builder or Exam Card.
   - Saves `cortex-exam-<id>.seb` (standard Apple XML Plist 1.0 format).
   - This file can be emailed to candidates, uploaded to an institutional Learning Management System (Canvas, Moodle, Blackboard), or hosted on a secure portal.

---

## 5. Student Operations Guide

### 5.1 The Accessible Setup Gate
When a student attempts to open an SEB-mandated exam or assignment using a standard browser (Google Chrome, Microsoft Edge, Mozilla Firefox, or Apple Safari), the page blocks access and renders the **Accessible SEB Setup Gate**:

```
+-------------------------------------------------------------------------------+
| [Shield Icon]                                                                 |
| Safe Exam Browser (SEB) Required                                              |
|                                                                               |
| This examination is protected with high-integrity kiosk lockdown.             |
| Standard web browsers cannot access this assessment.                          |
|                                                                               |
| Required Setup Steps:                                                         |
| 1. Install Safe Exam Browser on your computer if you have not already         |
|    (Download Official Installer: https://safeexambrowser.org/download_en.html)|
| 2. Click "Launch in Safe Exam Browser" to start automatically.                |
| 3. If downloaded, double-click the .seb file to begin your secure session.     |
| 4. If already running inside Safe Exam Browser, click "Retry Verification".   |
|                                                                               |
| [ Launch in Safe Exam Browser ]    [ Download .seb Configuration ]            |
|                                                                               |
| [ Retry Verification ]  |  [ Return to Classroom ]                            |
+-------------------------------------------------------------------------------+
```

- **Accessibility**: The gate implements `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby="seb-gate-title"`, and `aria-describedby="seb-gate-desc"`, making it fully navigable via screen readers and keyboard controls.

---

### 5.2 Starting the Assessment
1. **Recommended Method (One-Click Launch)**:
   - Click the orange button: **Launch in Safe Exam Browser**.
   - Your browser will ask: *"Open Safe Exam Browser?"* Click **Open**.
   - Safe Exam Browser will start in full-screen kiosk mode and load your exam immediately.
2. **Alternative Method (.seb File)**:
   - Click **Download .seb Configuration**.
   - Locate the downloaded `cortex-exam-<id>.seb` file in your Downloads folder.
   - Double-click the file to launch SEB.

---

### 5.3 Active Kiosk Restrictions
During the examination, Safe Exam Browser enforces the following policies:
- **Display Lock**: Runs in exclusive full-screen mode.
- **Taskbar & Start Menu**: The OS taskbar, dock, and notification center are completely hidden and disabled.
- **Shortcut Suppression**: `Alt+Tab`, `Windows Key`, `Cmd+Tab`, `Ctrl+Esc`, and `Print Screen` are blocked by the OS kernel driver.
- **Application Blocking**: Secondary applications, background processes, VoIP tools (Discord, Teams, Zoom), and remote desktop clients are terminated or disallowed.
- **URL Filtering**: Navigation is strictly locked to the assessment domain. External websites and search engines cannot be visited.
- **Multiple Monitors**: If external secondary monitors are detected, SEB prompts the student to disconnect them before continuing.

---

### 5.4 In-Exam Autosave, Recovery & Clock Sync

#### Authoritative Clock Synchronization:
- The exam timer does not rely on your computer's local clock.
- When the exam starts, Cortex synchronizes with the authoritative server timestamp:
  $$\text{serverTimeOffset} = \text{serverTime} - \text{clientTime}$$
- Every minute, background heartbeats re-verify time remaining against the server. Changing your system clock will have zero effect on your allowed exam duration.

#### Autosave State Machine:
As you answer questions or edit code, your work is continuously protected:
- **`Saving...`** (Amber Pulse): Responses are being transmitted to the server.
- **`Saved at HH:MM:SS`** (Emerald Check): Responses are successfully recorded in the central database.
- **`Offline (saved locally)`** (Rose Banner): If your Wi-Fi or Internet drops, Cortex automatically caches your responses in browser local storage. You can continue answering without interruption.
- **`Reconnected, syncing...`** (Cyan Pulse): When connectivity returns, Cortex flushes all queued answers to the server.

---

### 5.5 Final Submission & Clean Exit
1. Click **Submit Exam** in the upper right corner.
2. A confirmation modal will appear, displaying:
   - Total questions answered vs. unanswered.
   - Explicit warnings if questions remain blank.
3. Click **Yes, Submit Now**.
4. Once submitted, your score and confirmation receipt are displayed.
5. Click **Exit Safe Exam Browser**. SEB will close automatically and return your computer to normal operating mode.

---

## 6. Production Deployment & Reverse Proxy Architecture

### 6.1 Reverse Proxy Requirements
In production, Cortex runs behind a reverse proxy (NGINX, Caddy, Cloudflare, Traefik, or AWS ALB). Safe Exam Browser generates its cryptographic request hash by combining the full URL as seen by the client with the secret key:

$$\text{RequestHash} = \text{SHA256}(\text{CanonicalRequestURL} + \text{Key})$$

If the reverse proxy modifies the protocol (`http` vs `https`), alters hostnames, or mishandles standard ports (`:80`, `:443`), hash verification will fail.

#### Mandatory Proxy Rules:
1. **Pass Original Protocol & Host**: Always set `X-Forwarded-Proto` and `X-Forwarded-Host`.
2. **Preserve SEB Headers**: Never strip or drop `X-SafeExamBrowser-*` headers.
3. **Strip Default Ports**: Per the SEB specification, standard ports `:80` (HTTP) and `:443` (HTTPS) must be stripped from candidate URLs. Non-standard ports (e.g., `:3000`, `:8443`) must be preserved.
4. **Enforce HTTPS**: Production deployments must enforce HTTPS. The `sebs://` protocol handler refuses to communicate over insecure HTTP.

---

### 6.2 Production NGINX Configuration

Below is a complete, production-hardened NGINX server block:

```nginx
# Cortex Production Reverse Proxy Configuration

# Preserve HTTP keep-alive on non-WebSocket requests
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name cortex.institution.edu;
    
    # Redirect all HTTP traffic to HTTPS (Required for SEB)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cortex.institution.edu;

    # SSL Certificate Configuration
    ssl_certificate /etc/letsencrypt/live/cortex.institution.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cortex.institution.edu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Client Request Body Limits (supports large programming submissions)
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support (preserves keep-alive on standard HTTP)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # Disable proxy buffering for real-time SSE event streams and heartbeat synchronization
        proxy_buffering off;
        proxy_cache off;

        # Forwarded Host & Protocol Normalization
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Explicitly forward Safe Exam Browser headers
        proxy_pass_request_headers on;
        proxy_set_header X-SafeExamBrowser-RequestHash $http_x_safeexambrowser_requesthash;
        proxy_set_header X-SafeExamBrowser-ConfigKeyHash $http_x_safeexambrowser_configkeyhash;

        # Proxy timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

---

### 6.3 Trusted Host Allowlists (`isTrustedHost`)
In `src/lib/classroom/seb-security.ts`, Cortex validates incoming host headers against an internal allowlist to prevent **Host Header Poisoning** and malicious canonical URL spoofing:

```typescript
function isTrustedHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  const trimmed = host.trim();
  if (!/^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/.test(trimmed)) return false;
  const hostname = trimmed.split(':')[0].toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.workers.dev') ||
    hostname.endsWith('.cortex.dev') ||
    hostname.endsWith('.institution.edu') // Add institutional production domain here
  );
}
```

*When deploying to a custom domain, ensure your domain suffix is added to `isTrustedHost()`.*

---

### 6.4 Token Registry Maintenance & Automated Cleanup
The `seb_consumed_tokens` table stores nonces to prevent token replay attacks. To prevent unbounded table growth over semesters, schedule periodic cleanup of expired tokens.

#### Automated Cleanup Command:
Run the built-in token cleanup method via a scheduled Node cron job or script:

```typescript
// scripts/cleanup-seb-tokens.ts
import { classroomDb } from '../src/lib/classroom/db';

async function run() {
  try {
    const purged = await classroomDb.cleanupExpiredSebTokens(Date.now());
    console.log(`[SEB Maintenance] Purged ${purged} expired launch tokens at ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    console.error('[SEB Maintenance] Failed to cleanup expired tokens:', err);
    process.exit(1);
  }
}

run();
```

#### Linux Crontab Entry (Runs hourly):
To execute the TypeScript cleanup script reliably under Node.js without directory resolution or `ERR_MODULE_NOT_FOUND` errors, invoke via `npx tsx` (or `node --import tsx`):

```cron
# Hourly token cleanup using tsx for reliable TypeScript execution
0 * * * * cd /var/www/cortex && npx tsx scripts/cleanup-seb-tokens.ts >> /var/log/cortex-seb-cleanup.log 2>&1
```

*(Alternatively, if running with Node 22+ or native loader: `node --import tsx scripts/cleanup-seb-tokens.ts`)*.

---

## 7. Troubleshooting & Diagnostic Guide

### 7.1 Diagnostic Taxonomy Matrix

| Error Code / Symptom | HTTP Status | Root Cause | Candidate Experience | Actionable Resolution |
|---|---|---|---|---|
| `MISSING_HEADERS` | 403 Forbidden | Request lacked SEB cryptographic headers (`X-SafeExamBrowser-RequestHash` or `ConfigKeyHash`). | Setup gate appears; student cannot view questions. | 1. Ensure student is running Safe Exam Browser.<br>2. Check reverse proxy to ensure it is not stripping custom headers.<br>3. Verify `sendBrowserExamKey: true` in config plist. |
| `CONFIG_KEY_MISMATCH` | 403 Forbidden | The configuration opened in SEB does not match the assessment's expected Config Key. | "Invalid or forged Safe Exam Browser cryptographic verification hash." | 1. Student opened a modified or stale `.seb` file.<br>2. Have student re-download the latest `.seb` file or click the one-click launch button.<br>3. Verify exam settings were not modified after config download. |
| `BEK_HASH_MISMATCH` | 403 Forbidden | Calculated BEK hash differs from client header. | Verification fails immediately upon starting exam. | 1. Student may be using an unsupported or modified SEB version.<br>2. Host header mismatch: verify reverse proxy sends accurate `X-Forwarded-Host`.<br>3. URL trailing slash mismatch. |
| `TOKEN_ALREADY_USED` | 403 Forbidden | Single-use launch token nonce was already consumed in `seb_consumed_tokens`. | "Launch token has already been consumed (replay rejected)." | 1. Token was reused by another student or second device.<br>2. If resuming an in-progress session, open the session directly without issuing a duplicate token. |
| `TOKEN_EXPIRED` | 403 Forbidden | Token's 10-minute (600s) TTL elapsed before session initialization. | "Launch token has expired or is invalid." | Have student return to the classroom page and click "Launch in Safe Exam Browser" to generate a fresh token. |
| `TOKEN_USER_MISMATCH` | 403 Forbidden | Launch token user mismatch (e.g., student B attempted to use student A's one-click launch link). | "Launch token user mismatch: access denied." | Student must launch the examination from their own authenticated Cortex account. Sharing direct launch links between students is strictly rejected. |
| `TOKEN_ASSESSMENT_MISMATCH` | 403 Forbidden | Launch token assessment mismatch (token generated for exam A used on exam B). | "Launch token assessment mismatch: access denied." | Re-launch from the specific assessment's setup modal so a token bound to the correct assessment ID is issued. |
| `TOKEN_MISSING` | 403 Forbidden | Missing single-use launch token for SEB-enforced examination (candidate attempted direct URL access without `sebToken` query param). | Setup gate appears; "Safe Exam Browser launch token required." | Open assessment via the setup gate or `sebs://` protocol URI, which automatically embeds a valid single-use launch token. |
| `INVALID_SIGNATURE` | 403 Forbidden | Launch token HMAC signature could not be verified. | "Invalid token cryptographic signature." | Server environment secret mismatch. Ensure all cluster nodes share the identical `SEB_LAUNCH_TOKEN_SECRET`. |
| `UNTRUSTED_HOST` | 403 Forbidden | Forwarded host failed `isTrustedHost()` regex check. | "Invalid or forged Safe Exam Browser cryptographic verification hash." | Add the production domain (e.g. `cortex.institution.edu`) to the trusted hostname list in `seb-security.ts`. |
| `SUBMISSION_OUTSIDE_SEB` | 403 Forbidden | Attempted to POST to `/submit` from standard browser or postman. | "Forbidden: exam submission rejected outside Safe Exam Browser." | Submissions can only be submitted from within an active, cryptographically authenticated SEB session. |

---

### 7.2 Diagnostic Procedures for Administrators

#### 1. Verifying Reverse Proxy Header Pass-Through:
To test whether your reverse proxy correctly delivers SEB headers to Next.js, simulate an SEB request using `curl`. Note that `ClassroomAuth` authenticates candidates before SEB cryptographic verification is evaluated; therefore, include an active session authentication cookie (`-H "Cookie: cortex_session=<session_token>"`) so the request is not rejected prematurely by authentication:

```bash
curl -i -X POST https://cortex.institution.edu/api/v1/classrooms/CLS1/exams/EX1/start \
  -H "Host: cortex.institution.edu" \
  -H "Cookie: cortex_session=<session_token>" \
  -H "X-SafeExamBrowser-RequestHash: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  -H "Content-Type: application/json"
```
*If NGINX logs show the header or the application responds with a cryptographic mismatch error (such as `Invalid or forged Safe Exam Browser cryptographic verification hash` rather than `Missing Safe Exam Browser cryptographic verification headers`), header pass-through is functioning properly.*

#### 2. Locating SEB Client Logs on Candidate Machines:
When troubleshooting client-side issues, inspect SEB's native log files:
- **Windows**: `%APPDATA%\SafeExamBrowser\` (e.g., `C:\Users\<User>\AppData\Roaming\SafeExamBrowser\seb.log`)
- **macOS**: `~/Library/Logs/Safe Exam Browser/`
- **iOS**: Accessible via iTunes / Finder File Sharing.

Look for lines containing `BrowserExamKey` or `ConfigKey` to verify that hashes were computed and sent with HTTP requests.

---

## 8. Testing & Verification Runbook

### 8.1 Automated Test Suites Overview
Cortex includes automated verification scripts in `scripts/`:

1. **`scripts/test-seb-assessment-hardening.ts`**:
   Comprehensive 4-tier opaque-box test suite:
   - **Tier 1 (Feature Coverage)**: BEK/CK verification, official canonical JSON computation, Base64URL launch token claims, Apple Plist XML generation, URLFilterRules, HTTP 403 rejections, assignment parity, theme sanitization.
   - **Tier 2 (Boundary & Corner Cases)**: Expired tokens, nonce replay detection, user/assessment mismatch, case-sensitive signatures, host poisoning rejection, port 80/443 stripping, trailing slash normalization, malicious color/logo payloads.
   - **Tier 3 (Cross-Feature Combinations)**: Dual header + launch token start, SEB JavaScript API key fallback, assignment solve workflow, authoritative derived BEK, session resumption.
   - **Tier 4 (Real-World Scenarios)**: End-to-end student lifecycle, teacher export, concurrent multi-student launch replay defense, submission idempotency under network glitches.
2. **`scripts/test-phase4-10-seb-security.ts`**:
   Low-level cryptographic audit verifying SHA-256 derivations, avalanche effects, timing equality invariants, and canonical URL reconstruction.
3. **`scripts/test-frontend-m3-verification.ts`**:
   Frontend verification testing modal accessibility (`role="alertdialog"`), SEB client helper functions, theme token injection, and deep-link query parameter parsing.

---

### 8.2 Executing Verification Suites

Execute all test suites from the project root directory:

```bash
# 1. Run Comprehensive Hardening Suite (147 test cases)
node scripts/test-seb-assessment-hardening.ts

# 2. Run Cryptographic Audit Suite (21 test cases)
node scripts/test-phase4-10-seb-security.ts

# 3. Run Frontend & Accessibility Verification Suite (53 test cases)
node scripts/test-frontend-m3-verification.ts
```

*(Note: Node.js v22+ or v24+ with native TypeScript support or `npx tsx` can be used interchangeably).*

---

### 8.3 Expected Verification Outputs

#### Hardening Test Suite:
```text
================================================================
SAFE EXAM BROWSER (SEB) ASSESSMENT FLOW HARDENING TEST SUITE
Node Runtime: v24.14.0
Execution Mode: 4-Tier Opaque-Box Comprehensive Automated Verification
================================================================
...
================================================================
SEB ASSESSMENT HARDENING TEST SUMMARY: 147/147 PASSED (0 FAILED)
Execution Duration: 37 ms
================================================================
All automated tests passed successfully across Tiers 1-4 with zero regressions.
```

#### Cryptographic Audit Suite:
```text
================================================================
PHASE 4.10: SAFE EXAM BROWSER CRYPTOGRAPHIC AUDIT
================================================================
...
================================================================
PHASE 4.10 AUDIT SUMMARY: 21/21 PASSED (0 FAILED)
================================================================
```

#### Frontend & Accessibility Suite:
```text
================================================================
MILESTONE 3: FRONTEND EXAM & ASSIGNMENT VERIFICATION
================================================================
...
================================================================
MILESTONE 3 VERIFICATION SUMMARY: 53/53 PASSED (0 FAILED)
================================================================
```

---

### 8.4 Pre-Flight Deployment Checklist

Before going live with SEB assessments in production, verify each gate:

- [ ] **Cryptographic Secrets Set**: `SEB_LAUNCH_TOKEN_SECRET`, `LOCKDOWN_POLICY_SECRET`, and `LOCKDOWN_SERVER_PEPPER` are configured with 256-bit high-entropy values in production environment.
- [ ] **Database Migration Applied**: `migrations/0011_seb_assessment_hardening.sql` is executed; table `seb_consumed_tokens` and indexes exist.
- [ ] **Reverse Proxy Configured**: NGINX / Caddy passes `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-SafeExamBrowser-RequestHash`, and `X-SafeExamBrowser-ConfigKeyHash`.
- [ ] **HTTPS Enforced**: SSL certificates are active; HTTP strictly redirects to HTTPS.
- [ ] **Trusted Host Configured**: Production domain is recognized in `isTrustedHost()`.
- [ ] **Test Suites Passing**: All 221 test cases across the three verification scripts pass with 0 failures.
- [ ] **Token Cleanup Scheduled**: Hourly maintenance cron job is configured for `cleanupExpiredSebTokens()`.

---
*End of Safe Exam Browser (SEB) Hardening Deployment & Operations Guide.*
