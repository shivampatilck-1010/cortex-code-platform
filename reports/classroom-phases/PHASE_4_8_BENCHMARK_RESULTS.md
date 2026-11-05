# CORTEX ONLINE EXAMINATION SYSTEM
# PHASE 4.8 — RAW BENCHMARK MEASUREMENTS

Date: 2026-10-31  
Target Environment: Cloudflare Staging (`https://cortex-code-platform-staging.cortexbuild1.workers.dev`)  
Suite: `scripts/test-phase4-8-performance-benchmarks.ts`  

---

## 1. COHORT BENCHMARK LOGS

### Cohort 1 (Single Candidate Baseline)
- Total Requests: 7
- Successful: 7 (Error Rate: 0.00%)
- Start Exam: p50 = 1,348ms | p95 = 1,348ms | max = 1,348ms
- Autosave: p50 = 1,493ms | p95 = 1,493ms | max = 1,493ms
- Heartbeat: 200 OK (Latency: 602ms)
- Teacher Live Dashboard Poll: 1,165ms
- Final Submission: p50 = 1,980ms | p95 = 1,980ms | max = 1,980ms

### Cohort 10 (10 Concurrent Candidates)
- Total Requests: 61
- Successful: 61 (Error Rate: 0.00%)
- Start Exam: p50 = 1,364ms | p95 = 1,413ms | max = 1,413ms
- Autosave: p50 = 1,449ms | p95 = 1,513ms | max = 1,513ms
- Final Submission: p50 = 1,934ms | p95 = 2,167ms | max = 2,167ms
- Teacher Live Dashboard Poll: 1,632ms

### Cohort 25 (25 Concurrent Candidates)
- Total Requests: 151
- Successful: 151 (Error Rate: 0.00%)
- Start Exam: p50 = 1,775ms | p95 = 1,780ms | max = 1,789ms
- Autosave: p50 = 1,814ms | p95 = 1,868ms | max = 1,955ms
- Final Submission: p50 = 2,344ms | p95 = 2,351ms | max = 2,352ms
- Teacher Live Dashboard Poll: 1,606ms

### Cohort 50 (50 Concurrent Candidates)
- Total Requests: 301
- Successful: 301 (Error Rate: 0.00%)
- Start Exam: p50 = 2,082ms | p95 = 2,088ms | max = 2,088ms
- Autosave: p50 = 2,305ms | p95 = 2,319ms | max = 2,408ms
- Final Submission: p50 = 2,955ms | p95 = 2,969ms | max = 3,000ms
- Teacher Live Dashboard Poll: 1,619ms

### Cohort 100 (100 Concurrent Candidates)
- Total Requests: 601
- Successful: 601 (Error Rate: 0.00%)
- Start Exam: p50 = 2,941ms | p95 = 2,987ms | max = 3,030ms
- Autosave: p50 = 3,325ms | p95 = 3,383ms | max = 3,418ms
- Final Submission: p50 = 4,252ms | p95 = 4,358ms | max = 4,389ms
- Teacher Live Dashboard Poll: 1,656ms

---

## 2. AGGREGATE SUMMARY
- Total HTTP Transactions Evaluated: 1,121
- Total Successful: 1,121
- Total Failed: 0
- Overall Error Rate: 0.000%
