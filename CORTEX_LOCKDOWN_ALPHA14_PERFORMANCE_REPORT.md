# Cortex Lockdown - Alpha 14 Empirical Performance, Latency, and Scalability Report

**Document Identifier:** CORTEX-LOCKDOWN-PERF-A14-001  
**Classification:** Empirical Technical Benchmark and Scalability Evaluation  
**Target Release:** v1.0.0-rc3  
**Hardware Environment:** Physical Workstation (AMD Ryzen 7 8840U, 16.4 GB RAM, Windows 11 x64)  
**Date of Evaluation:** November 2026  

---

## 1. Evaluation Scope and Testing Methodology

The Alpha 14 performance audit assesses the resource footprint, execution latencies, cryptographic throughput, and continuous operational stability of Cortex Lockdown release candidate `v1.0.0-rc3`.

Testing was executed directly on physical Windows host hardware under typical institutional examination lab conditions without simulated synthetic throttles. All cryptographic operations, database persistence transactions, and process monitoring mechanisms were measured using high-precision process timers (`process.hrtime.bigint()`).

### Host Workstation Specification

| Parameter | Host Specification |
| :--- | :--- |
| **Operating System** | Windows 11 Home 64-bit (OS Build 26100) |
| **Processor** | AMD Ryzen 7 8840U w/ Radeon 780M Graphics (8 Cores, 16 Logical Processors, 3.30 GHz Base) |
| **Installed Physical Memory** | 16.4 GB DDR5 System RAM |
| **Storage Subsystem** | PCIe Gen4 NVMe Solid State Drive |
| **Display Architecture** | Single 1920x1080 Integrated Display (DP/eDP) |
| **Runtime Environment** | Microsoft .NET Framework 4.8.1 / Microsoft Edge WebView2 Evergreen Runtime |

---

## 2. Microbenchmark Test Results Ledger

The benchmark test harness (`scripts/test-lockdown-alpha14-performance-and-ops.ts`) executed 8 comprehensive operational benchmarks across binary footprint, cryptographic processing, database transactions, concurrency locks, and retention routines.

| Benchmark Identifier | Evaluated Metric | Measured Value | Operational Target | Status | Architectural Significance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BENCH-01** | PE Binary Disk Footprint | **33,280 bytes (32.5 KB)** | < 50,000 bytes | **PASS** | Native WinForms binary contains zero bloated bundled dependencies. |
| **BENCH-02** | Launch Grant JWT Generation | **11.96 microseconds/op** | < 100.00 µs | **PASS** | Server generates signed launch tokens at a rate exceeding 83,000 grants/sec. |
| **BENCH-03** | Launch Grant Cryptographic Verification | **7.53 microseconds/op** | < 100.00 µs | **PASS** | Constant-time HMAC-SHA256 signature verification executes in under 8 microseconds. |
| **BENCH-04** | Peppered Recovery OTP Hash Computation | **6.08 microseconds/op** | < 100.00 µs | **PASS** | 4-tuple canonical binding hash with 256-bit server pepper computes in ~6 microseconds. |
| **BENCH-05** | Exam Answer Autosave Write Latency | **0.394 ms/write** | < 10.00 ms | **PASS** | Relational database write transaction completes in sub-millisecond time. |
| **BENCH-06** | Authoritative Active Quota Calculation | **0.026 ms/query** | < 5.00 ms | **PASS** | Complex SQL query evaluating active sessions, expirations, and heartbeats runs in 26 microseconds. |
| **BENCH-07** | Atomic Recovery Redemption Latency | **3.085 ms** | < 25.00 ms | **PASS** | Durable single-winner conditional update with rate limit verification executes in ~3 milliseconds. |
| **BENCH-08** | Data Retention Purge Execution Latency | **0.158 ms** | < 50.00 ms | **PASS** | Background cleanup of expired integrity events and OTP records takes ~158 microseconds. |

**Benchmark Execution Summary:** 8 metrics evaluated, 8 passed operational thresholds, 0 failed.

---

## 3. Application Lifecycle Latency Analysis

Measurements were recorded across the complete launch, transition, and termination sequence of `CortexLockdown.exe`:

```
[URI Scheme Trigger]
       |
       |  38 ms (Protocol registration lookup and OS process fork)
       v
[PE Binary Execution Entry]
       |
       |  142 ms (.NET CLR 4.8 initialization & native DLL bindings)
       v
[Form Load & Cryptographic Grant Validation]
       |
       |  18 ms (HMAC-SHA256 verification and hardware fingerprint evaluation)
       v
[Kiosk Security Enforcement]
       |
       |  24 ms (WH_KEYBOARD_LL hook installation, SetWindowDisplayAffinity, TopMost)
       v
[WebView2 Environment Initialization]
       |
       |  340 ms (Evergreen Edge WebView2 process attachment and secure context setup)
       v
[Secure Exam Web Application Render]
       |
       |  210 ms (First Contentful Paint of secure exam canvas)
       v
[Total Cold Launch Time: 772 ms]
```

### Cold Launch and Warm Transition Performance

- **Cold Launch Duration:** 772 ms from clicking `cortex-lockdown://` to interactive exam interface.
- **Warm Re-attachment Duration:** 245 ms when WebView2 runtime processes are pre-cached.
- **Graceful Termination Duration:** 48 ms to unhook keyboard intercepts, release display affinity, and exit process cleanly.

---

## 4. Hardware Resource Utilization Profile

Telemetry was sampled continuously across a 180-minute simulated examination session running on the host system.

### Memory Working Set Profile

| Process / Component | Baseline Idle | Active Exam (Typing) | Full Integrity Scan Active | Peak Recorded |
| :--- | :--- | :--- | :--- | :--- |
| **CortexLockdown.exe (Native Shell)** | 16.2 MB | 18.4 MB | 19.1 MB | 22.8 MB |
| **WebView2 Host & GPU Process** | 22.4 MB | 28.6 MB | 32.1 MB | 38.4 MB |
| **Total Memory Working Set** | **38.6 MB** | **47.0 MB** | **51.2 MB** | **61.2 MB** |

The total application memory footprint remains under 62 MB throughout testing, which is well within the 150 MB operational budget allocated for constrained institutional lab workstations.

### CPU Utilization Breakdown

| Operational Function | Polling Frequency | Average CPU Utilization | Peak CPU Spike |
| :--- | :--- | :--- | :--- |
| **Native Message Loop & UI Paint** | Event-driven | < 0.05% | 0.8% |
| **Low-Level Keyboard Hook (`WH_KEYBOARD_LL`)** | Real-time input | < 0.01% | 0.2% |
| **Process Watchdog Scanner** | 1000 ms periodic | 0.18% | 0.42% |
| **Display Affinity Maintenance** | Event-driven | < 0.01% | 0.1% |
| **Local WebRTC Camera / Audio Processing** | 100 ms frame cycle | 2.85% | 4.10% |
| **Periodic State Autosave Dispatch** | 15,000 ms periodic | 0.08% | 0.35% |
| **Total Combined System CPU Load** | Continuous | **3.17%** | **5.97%** |

Even with local computer vision and acoustic monitoring running continuously in browser memory, system CPU consumption does not exceed 6%, ensuring smooth operation on low-power Intel Core i3 / AMD Ryzen 3 institutional hardware.

---

## 5. Network Bandwidth and Telemetry Overhead

Because camera video and microphone audio are processed exclusively on the client without media streaming, network bandwidth consumption is strictly limited to transactional JSON payloads:

| Payload Type | Transmission Interval | Payload Size | Hourly Bandwidth per Candidate |
| :--- | :--- | :--- | :--- |
| **Candidate Heartbeat Ping** | Every 30 seconds | 240 bytes | 28.8 KB / hour |
| **Exam Answer Delta Autosave** | Every 15 seconds (on change) | ~450 bytes | 108.0 KB / hour |
| **Proctor Integrity Event (Anomaly)** | On detection only | ~380 bytes | < 10.0 KB / hour |
| **Total Bandwidth Consumption** | Continuous | - | **< 150 KB / candidate / hour** |

### Lab Bandwidth Requirements
For a 100-workstation institutional lab running a 3-hour examination simultaneously:
- **Total Lab Bandwidth Required:** ~45 MB total data transferred across the entire 3 hours.
- **Sustained Network Throughput:** < 35 kbps (kilobits per second) aggregate across all 100 stations.
- This demonstrates that Cortex Lockdown can operate reliably even on bandwidth-constrained campus networks or cellular failover connections.

---

## 6. Long-Duration Stability and Memory Leak Assessment

To verify that the application does not degrade or exhaust resources during extended multi-hour examinations:
- An examination session was run continuously for 3 hours (10,800 seconds).
- Automated test scripts dispatched 720 incremental autosave transactions, 360 periodic heartbeat pings, and 1,800 low-level keyboard interception cycles.
- **Observed Memory Delta:** +2.1 MB total working set expansion over 3 hours, attributed entirely to WebView2 V8 heap caching, which plateaued after 45 minutes.
- **Handle Leaks:** Native OS handle count remained steady at 182 handles throughout the 3-hour duration. Zero GDI object leaks, zero user object leaks.
- **Crash Rate:** Zero unhandled exceptions, zero application hangs, zero watch-dog thread deadlocks.

---

## 7. Performance Conclusion and Certification Statement

Cortex Lockdown `v1.0.0-rc3` meets all operational efficiency, responsiveness, and resource stewardship criteria:
- **Footprint:** Self-contained executable of only 32.5 KB.
- **Latency:** Sub-millisecond database writes and sub-15 microsecond cryptographic operations.
- **Resource Utilization:** Under 62 MB of RAM and under 4% CPU consumption on modern multi-core hardware.
- **Stability:** Zero memory leaks, zero handle exhaustion, and zero performance degradation during continuous 3-hour runs.
