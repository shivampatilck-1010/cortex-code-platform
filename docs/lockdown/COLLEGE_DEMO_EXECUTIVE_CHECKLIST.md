# Cortex Lockdown: College Demonstration Executive Checklist
## Live Presentation Sequence for University Faculty & Evaluation Authorities

### 1. Pre-Demonstration Verification Checklist
Ensure the following checks are verified before presenting to university leadership:

- [ ] Demonstration workstation running Windows 10/11 x64.
- [ ] Primary monitor connected; secondary external monitor unplugged.
- [ ] Authoritative distribution package present: `CortexLockdown-Windows-x64.zip` (SHA-256 `08BD0C5A...`).
- [ ] Hardened executable present: `CortexLockdown-Hardened.exe` (SHA-256 `82518B2D...`).
- [ ] Demonstration test suite passing: `scripts/test-lockdown-college-demonstration.ts` (22/22 PASS).
- [ ] Synthetic candidate account confirmed: `usr_cand_synth_demo_patil`.
- [ ] Synthetic exam loaded: `EXAM_CSE276_ACTIVE_MIDTERM`.

---

### 2. Live Demonstration Script & Narrative

#### Phase A: Installation & Trust Model (Duration: 3 minutes)
1. **Explain Packaging & Integrity**: Show the SHA-256 checksum manifest (`SHA256SUMS.txt`). Explain that every release artifact is cryptographically verifiable.
2. **Execute Installation**: Double-click `install.bat`. Highlight that installation runs safely under standard user privileges without modifying protected system files.
3. **Verify Protocol Registration**: Show `cortex-lockdown://` registered in the Windows registry, enabling seamless launching from university web portals.

#### Phase B: Candidate Pre-Flight Journey (Duration: 4 minutes)
4. **Welcome Dashboard**: Highlight the clean institutional aesthetic (`#0B0C10` background, `#121316` surface, `#FF9100` accents) and clear labelling of the synthetic student identity.
5. **Pre-Flight Hardware Check**: Walk through the 4 automated checks (Display count, Process Watchdog, Display Affinity, Bare-Metal Virtualization).
6. **Privacy Disclosure**: Point out explicit FERPA & GDPR disclosures and emphasize that zero raw audio/video leaves the local machine.
7. **Graceful Sensor Degradation**: Show how the application operates with live hardware webcams or seamlessly falls back to evaluation simulation when no camera is present.

#### Phase C: Examination Security & Crash Resilience (Duration: 8 minutes)
8. **Launch Secure Kiosk**: Click **Enter Secure Exam Kiosk**. Demonstrate that task-switching shortcuts (`Alt+Tab`, `WinKey`, `PrintScreen`) are completely suppressed.
9. **Show Window Capture Blocker**: Open Snipping Tool or screenshot software to show that the examination window appears completely pitch-black (`WDA_MONITOR`).
10. **Encrypted Autosave**: Answer questions 1, 2, and 3. Show that answers are encrypted immediately to disk using AES-256-GCM.
11. **Network Failure Simulation**: Disconnect Wi-Fi or unplug Ethernet. Answer questions 4 and 5. Demonstrate that the UI transitions to `Offline - Locally Buffered` without losing work or interrupting the student.
12. **Network Reconnection**: Reconnect network. Show that buffered answers automatically synchronize to the server with monotonic sequence numbers.
13. **Simulated Application Crash**: Terminate the application via Task Manager or simulated failure. Relaunch the application. Show that all 5 answers are fully decrypted and recovered.

#### Phase D: Submission & Faculty Oversight (Duration: 5 minutes)
14. **Final Submission**: Submit the examination. Point out that the final state is only shown once the server confirms receipt.
15. **Server Receipt**: Display the immutable cryptographic receipt `CORTEX-SUB-[16-HEX]`.
16. **Open Faculty Live Dashboard**: Transition to the faculty console. Show the candidate's submitted status, automated score, and response details.
17. **Integrity Timeline & Fairness**: Show the event audit log and explain the ethical policy: algorithmic heuristics are review flags, never proof of cheating.
18. **Export Audit Report**: Click **Export Audit** to generate the JSON audit package for institutional archiving.

---

### 3. Key Discussion Points for Faculty Evaluators
- **Integrity Without Invasiveness**: Enforces strict kiosk lockdown without recording candidate bedrooms or collecting invasive hardware serial numbers.
- **Offline Tolerance**: Eliminates the risk of student work being lost during campus Wi-Fi fluctuations.
- **Fairness by Design**: Prohibits automated disciplinary actions; keeps faculty firmly in the loop.
- **Clear Institutional Boundaries**: Openly acknowledges what requires university managed lab infrastructure (e.g., `Ctrl+Alt+Del` suppression via GPO).
