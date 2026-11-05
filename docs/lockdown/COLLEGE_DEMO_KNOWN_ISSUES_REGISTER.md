# Cortex Lockdown: Known Issues & Institutional Risk Register
## Evaluation Tracking & Remediation Roadmap for University Demonstration

### 1. Register Overview
This register documents known behaviors, operational boundaries, and planned post-demonstration enhancements for Cortex Lockdown v1.0.0-hardened.

---

### 2. Known Issues & Operational Workarounds

| Defect / Limitation ID | Classification | Severity | Description & Impact | Operational Workaround / Planned Fix |
| :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | Code Signing | Low (Demo) / High (Production) | Unsigned Authenticode binary triggers Windows SmartScreen warning on unmanaged BYOD machines. | **Workaround**: Click "More info -> Run anyway" during demonstration.<br>**Planned Fix**: Acquire institutional EV Authenticode certificate from DigiCert/Sectigo for production rollout. |
| **ISSUE-02** | OS Security | Medium | `Ctrl+Alt+Delete` cannot be intercepted by user-mode hooks; candidate can summon lock screen on personal PCs. | **Workaround**: Window blur telemetry event logged immediately upon loss of focus.<br>**Institutional Resolution**: GPO deployment disables SAS options on managed lab computers. |
| **ISSUE-03** | Browser Fallback | Medium | Browser `localStorage` fallback does not provide operating system process isolation. | **Mitigation**: Native Windows installation is strongly recommended; browser fallback clearly displays warning banner. |
| **ISSUE-04** | Dual Monitors | Low | Candidates with docking stations or multi-monitor setups cannot launch until external displays are disconnected. | **Resolution**: Pre-flight readiness check detects external displays and instructs candidate to unplug secondary cables. |
| **ISSUE-05** | WebRTC Perms | Low | Denying browser webcam permissions prevents camera streaming. | **Resolution**: Built-in graceful fallback activates Evaluation Simulation Mode so demonstrations can continue without physical cameras. |
| **ISSUE-06** | Audio Heuristics | Low | Ambient background noise (fans, air conditioning) can elevate decibel meter. | **Resolution**: Human-in-the-loop audit policy strictly prohibits automated penalties; proctor reviews context manually. |
| **ISSUE-07** | Inno Setup Binary | Low | Inno Setup Compiler (`iscc.exe`) is optional and not installed by default on bare developer workstations. | **Resolution**: Packaging script defaults to portable distribution ZIP package (`CortexLockdown-Windows-x64.zip`) which contains full installer scripts. |

---

### 3. Readiness Gate Sign-Off Criteria for University Evaluation
Prior to official institutional adoption across student bodies, the following gates must be cleared:
1. **EV Certificate Acquisition**: Sign all release binaries and installer executables with a trusted commercial EV certificate.
2. **Domain Group Policy Validation**: Test GPO deployment of AppLocker XML rules on a physical Active Directory domain controller.
3. **Dedicated Staging Server**: Deploy backend API and Cloudflare D1 databases to an isolated university VPC.
4. **Faculty Proctor Training**: Conduct formal workshop with invigilators on the ethical use of heuristic review alerts.
