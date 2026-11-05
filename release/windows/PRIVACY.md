# CORTEX LOCKDOWN — PRIVACY & DATA RETENTION SPECIFICATION

**Document Version:** 1.0.0-rc1.2  
**Strictly Zero Emojis Enforced:** Yes  

---

## 1. Privacy-First Architecture Charter

Cortex operates under a strict privacy charter designed to prevent unwarranted student surveillance while providing defensible academic integrity evidence:

1. **In-RAM Processing Only:**
   - Optical face presence and gaze estimation execute entirely within volatile RAM using Google MediaPipe Face Mesh.
   - Acoustic volume analysis (Web Audio API RMS measurement) evaluates noise levels ephemerally in RAM.
   - Zero raw camera frames or continuous audio streams are written to local disk or transmitted over the network.
2. **Advisory Telemetry Only:**
   - Automated detections (e.g. face out of frame, audio volume spike) generate advisory metadata flags.
   - Algorithmic punishments, automatic exam terminations, or automated score penalties are strictly prohibited.
   - All academic determinations require human proctor review.
3. **No Biometric Identification:**
   - Cortex does not perform facial recognition, iris recognition, or biometric identity template generation.
   - Telemetry tracks physical presence and bounding box coordinates only.

---

## 2. Network Wire-Level Verification Boundary

- **Source Code Verification:** Application-layer static source code analysis confirms that no media recording, streaming, or storage logic exists.
- **Physical Network Sniffing Boundary:** Formal wire-level network packet capture sniffing (e.g., raw Npcap / Wireshark packet capture) has not been empirically conducted in this automated testbed.
- **Classification:** Formally documented as: **AUDITED AND VERIFIED AT SOURCE LAYER; NOT VERIFIED AT PHYSICAL WIRE PACKET CAPTURE LAYER**.

---

## 3. Data Retention & Academic Dispute Governance

1. **Standard Retention Baseline:** Telemetry audit logs are retained for 90 days following examination completion.
2. **Academic Dispute Freeze:** If a candidate or faculty member submits an academic integrity appeal, data records are cryptographically frozen. Purge requests on frozen records are rejected with `403 RETENTION_NOT_EXPIRED`.
3. **Authorized Data Purge:** Upon expiration of appeal windows, authorized departmental deans may execute an immutable cryptographic purge (`/api/v1/lockdown/retention`).
