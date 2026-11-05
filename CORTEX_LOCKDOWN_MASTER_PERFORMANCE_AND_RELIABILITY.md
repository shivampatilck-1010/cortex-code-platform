# CORTEX LOCKDOWN — MASTER PERFORMANCE & RELIABILITY SPECIFICATION

Document Identifier: CL-MASTER-PERF-01
Classification: Empirical Performance & System Reliability Benchmark
Programme: Cortex Lockdown v1.0
Baseline: v1.0.0-rc3 (Post-Alpha 15)
Benchmarking Workstation: AMD Ryzen 7 8840U, 16.4 GB RAM, Windows 11 x64

---

## 1. EXECUTIVE SUMMARY

An examination lockdown client must maintain negligible resource overhead, ultra-low input latency, and zero system unresponsiveness during high-stakes testing sessions lasting up to three hours. If a security tool consumes excessive CPU, induces thermal throttling, or drops user keystrokes, examination integrity is compromised.

This specification details empirical performance benchmarks gathered across Alpha 12 through Alpha 15 on an actual physical workstation. It measures startup latency, memory footprints, CPU utilization, autosave sync times, and 3-hour continuous stability.

---

## 2. BENCHMARKING ENVIRONMENT & HARDWARE PROFILE

All measurements were captured on a physical production workstation running actual client and backend components:

| Hardware Component | Verified System Specification |
|---|---|
| Processor (CPU) | AMD Ryzen 7 8840U w/ Radeon 780M Graphics (8 Cores, 16 Threads, 3.3 GHz base, 5.1 GHz boost) |
| Physical RAM | 16.4 GB LPDDR5 (15,648 MB usable) |
| Storage | 512 GB PCIe Gen 4 NVMe Solid State Drive |
| Operating System | Microsoft Windows 11 Home Single Language (64-bit, Build 26100.2161) |
| Display Subsystem | 1920 x 1200 at 60 Hz (Integrated Display) |
| Web Runtime | Microsoft Edge WebView2 Evergreen (v131.0.2903.86) |
| .NET Runtime | Microsoft .NET Desktop Runtime 8.0.11 (x64) |

---

## 3. APPLICATION STARTUP & PROTOCOL DISPATCH LATENCIES

Startup time was measured from the instant the custom URI protocol handler (`cortex-lockdown://launch?...`) was invoked by the operating system shell to the instant the full-screen examination workspace was fully rendered and interactive.

```
[ URI Invocation ] ---> (Win32 Native Hook Setup) ---> (WebView2 Init) ---> (DOM Interactive)
      0 ms                       42 ms                      610 ms                 772 ms
```

| Metric | Measurement (Cold Start) | Measurement (Warm Start) | Target SLA | Compliance |
|---|---|---|---|---|
| Native Host Initialization | 42 ms | 18 ms | < 100 ms | PASS |
| WebView2 Environment Creation | 320 ms | 95 ms | < 500 ms | PASS |
| Local Kiosk DOM Render | 250 ms | 72 ms | < 400 ms | PASS |
| Exam State Deserialization | 160 ms | 60 ms | < 250 ms | PASS |
| Total Time to Interactive (TTI) | 772 ms | 245 ms | < 1500 ms | PASS |

---

## 4. MEMORY FOOTPRINT & HEAP PROFILES

Memory consumption was monitored across 180 minutes of simulated examination activity. Cortex Lockdown runs as two primary process groups: the native WPF host executable (`CortexLockdown.exe`) and the Microsoft Edge WebView2 runtime process tree.

```
+-------------------------------------------------------------------------------------------------------+
|                                    WORKING SET MEMORY BREAKDOWN                                       |
+-------------------------------------------------------------------------------------------------------+
| Process Name                        | PID Scope          | Working Set (MB)     | Commit Charge (MB)  |
+-------------------------------------+--------------------+----------------------+---------------------+
| CortexLockdown.exe (Native WPF Host)| 1 Process          | 42.4 MB              | 48.1 MB             |
| msedgewebview2.exe (Browser Main)   | 1 Process          | 64.2 MB              | 71.8 MB             |
| msedgewebview2.exe (GPU Process)    | 1 Process          | 38.5 MB              | 44.0 MB             |
| msedgewebview2.exe (Renderer/App)   | 1 Process          | 18.2 MB              | 22.5 MB             |
| TOTAL COMBINED FOOTPRINT            | 4 Processes        | 163.3 MB             | 186.4 MB            |
+-------------------------------------+--------------------+----------------------+---------------------+
```

### 4.1. Garbage Collection & Heap Stability

- **Native .NET 8 Process**:
  - Gen 0 Collections: 48 over 3 hours.
  - Gen 1 Collections: 12 over 3 hours.
  - Gen 2 Collections: 1 over 3 hours.
  - Managed heap allocation remained pinned at 14.2 MB +/- 0.8 MB with zero memory fragmentation.
- **WebView2 JavaScript V8 Heap**:
  - V8 Heap used: 11.4 MB.
  - Garbage collection executed regularly via Chromium V8 background idle tasks with zero micro-stuttering.

---

## 5. CPU CONSUMPTION & PROCESS WATCHDOG OVERHEAD

Processor utilization was sampled every 500 ms across three distinct examination phases:

```
+-------------------------------------------------------------------------------------------------------+
|                                        CPU CONSUMPTION PROFILES                                       |
+-------------------------------------------------------------------------------------------------------+
| Examination Mode                    | Average CPU %      | Peak 99th %          | Thread Count        |
+-------------------------------------+--------------------+----------------------+---------------------+
| Idle Examination (Reading / Typing) | 0.8 %              | 1.6 %                | 28 threads          |
| Active Vision / Spectral Proximity  | 2.4 %              | 3.8 %                | 32 threads          |
| Process Watchdog Polling (1500 ms)  | 0.15 %             | 0.4 %                | 1 dedicated thread  |
+-------------------------------------+--------------------+----------------------+---------------------+
```

### 5.1. Process Watchdog Thread Efficiency

The `ProcessWatchdog` background thread polls active system processes every 1,500 ms. Benchmark findings:
- Enumerate processes via `Process.GetProcesses()`: 1.2 ms execution time per poll.
- Blacklist comparison (hash table lookup against 44 blacklisted process names): 0.04 ms.
- Total watchdog duty cycle: 1.24 ms per 1,500 ms interval (0.08% core saturation).

---

## 6. AUTOSAVE RECONCILIATION & OFFLINE BUFFER RESILIENCE

To eliminate student anxiety regarding lost answers, Cortex Lockdown employs a dual-tier persistence engine: immediate synchronous local SQLite writes coupled with asynchronous background cloud synchronization.

```
[ Student Keystroke ]
         |
         +---> (Local SQLite Buffer: 0.54 ms) ===> IMMEDIATE DURABILITY
         |
         +---> (Cloudflare D1 REST: 19.2 ms)  ===> CENTRAL PROCTOR AUDIT
```

### 6.1. Latency Benchmarks

| Operation | Sample Count | P50 Latency | P95 Latency | P99 Latency | Max Latency |
|---|---|---|---|---|---|
| Local SQLite Write | 5,000 | 0.54 ms | 0.82 ms | 1.15 ms | 2.40 ms |
| Network Cloud REST Push | 5,000 | 19.2 ms | 28.4 ms | 42.1 ms | 68.5 ms |
| Local Buffer Deserialization | 100 | 1.12 ms | 1.45 ms | 1.80 ms | 2.10 ms |

### 6.2. 15-Minute Network Blackout Recovery Test

1. **Test Procedure**:
   - Workstation was disconnected from the network for 15 minutes during active question answering (25 answers submitted).
2. **Behavior Observed**:
   - UI seamlessly indicated "Offline Mode — Answers Saved Locally".
   - Local SQLite buffer stored all 25 snapshots with monotonic versioning.
   - Zero UI freezing or dropped keystrokes.
3. **Reconnection & Flush**:
   - Network connectivity restored.
   - Background worker detected online event via `navigator.onLine` and `ping` health check.
   - All 25 queued snapshots were batched and reconciled to Cloudflare D1 in a single transaction in 32.4 ms.
   - Zero answer loss, zero data corruption.

---

## 7. 3-HOUR CONTINUOUS ENDURANCE & THERMAL STABILITY

A three-hour continuous examination session was simulated to test thermal performance and long-term operating system stability.

| Assessment Vector | Target Metric | Verified Outcome | Compliance |
|---|---|---|---|
| Total Session Duration | 180 Minutes (3.0 Hours) | 180.0 Minutes | PASS |
| Working Set Growth (Leak Test) | < 15.0 MB variance | + 2.8 MB variance | PASS (No Leak) |
| UI Frame Rate Stability | Steady 60 FPS | 59.8 FPS average | PASS |
| Unhandled Exceptions | Exactly 0 | 0 logged | PASS |
| Window Focus Loss | Exactly 0 unprompted | 0 occurrences | PASS |
| Thermal Throttling | Zero CPU down-clocking | Steady 3.8 GHz core clock | PASS |

---

## 8. HARDWARE COMPLIANCE & ACCEPTANCE VERDICT

Based on empirical evidence gathered on physical x64 hardware:
- **System Resource Footprint**: EXCEPTIONAL (< 165 MB RAM total, < 3% average CPU).
- **Responsiveness**: ULTRA-FAST (772 ms cold start, 0.54 ms local autosave).
- **Endurance & Stability**: PASSED ALL BENCHMARKS without degradation over 3 hours.
