# CORTEX LOCKDOWN — FACULTY & PROCTOR OPERATIONAL GUIDE

**Document Version:** 1.0.0-rc1.2  
**Strictly Zero Emojis Enforced:** Yes  

---

## 1. Pre-Examination Preparation

1. **Policy Configuration:**
   - In the Cortex Faculty Dashboard, navigate to **Examinations** -> **Settings**.
   - Configure security parameters: Single physical display enforcement, application switching suppression, and display capture shielding.
2. **Lab Pre-Authorization Check:**
   - Confirm with campus IT that lab workstations have the current Cortex Lockdown SHA-256 hash pre-authorized in AppLocker / WDAC.
   - Verify secondary monitors and projectors are disconnected from candidate machines.

---

## 2. Active Proctoring & Live Dashboard Operations

1. **Candidate Verification:**
   - Monitor the proctoring feed for candidate connection events and system readiness acknowledgments.
2. **Advisory Telemetry Interpretation:**
   - Amber warnings (e.g., face out of frame, acoustic noise spike) represent **advisory flags only**.
   - Proctors must visually observe the physical candidate before initiating any integrity investigation. Automated disciplinary penalties are prohibited.
3. **Emergency Override Protocol:**
   - In the event of a medical emergency, hardware freeze, or authorized early exit:
   - Proctor approaches the student workstation and triggers **`Ctrl + Alt + F10`**.
   - The application displays a 6-digit challenge code.
   - Proctor accesses `/api/v1/lockdown/emergency-exit` on the faculty console, enters the challenge code, receives the authorization OTP, and submits it on the student workstation.
   - The desktop immediately unlocks, releases keyboard hooks, and terminates the session cleanly.

---

## 3. Post-Examination Audit & Verification

1. **Submission Receipts:**
   - Verify that all candidates have received a valid server HMAC submission receipt (`CORTEX-SUB-...`).
2. **Audit Hash Chain Inspection:**
   - Access the administrative audit log to review sequential integrity event records.
   - Signed HMAC checkpoints ensure that audit sequences cannot be rewritten or truncated without detection.
