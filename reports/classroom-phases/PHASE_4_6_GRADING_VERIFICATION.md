# CORTEX ONLINE EXAMINATION SYSTEM
# PHASE 4.6 — GRADING ENGINE VERIFICATION EVIDENCE

Date: 2026-10-31  
Authoritative Test Harness: `scripts/test-phase4-6-assessment-engine.ts`  

---

## 1. AUTOMATED TEST EVIDENCE

### Test 1: Single MCQ Scoring
- Prompt: "What is the time complexity of binary search on a sorted array?" (Points: 4.0, Negative: 1.0)
- Correct Option Selected: Earned 4.0 / 4.0 points (`isCorrect: true`) -> PASS
- Incorrect Option Selected: Earned -1.0 / 4.0 points (`isCorrect: false`) -> PASS
- Unanswered: Earned 0 / 4.0 points (`feedback: 'Unanswered'`) -> PASS

### Test 2: Multiple MCQ Scoring
- Options: [2, 3, 4, 5] (Correct: [2, 3, 5], Points: 6.0, Negative: 2.0)
- Full Selection ([2, 3, 5]): Earned 6.0 / 6.0 points -> PASS
- Partial Selection ([2, 3]): Earned 4.0 / 6.0 points (2/3 fraction) -> PASS
- Partial Selection with Error ([2, 3, 4]): Earned 2.0 / 6.0 points ((2-1)/3 fraction) -> PASS

### Test 3: True / False Scoring
- Prompt: "HTTP/3 is built on top of UDP and QUIC." (Points: 2.0, Negative: 0.5)
- Correct Boolean (true): Earned 2.0 / 2.0 points -> PASS
- Incorrect Boolean (false): Earned -0.5 / 2.0 points -> PASS

### Test 4: Numerical Scoring with Tolerance
- Expected: 343.2 (Tolerance: +/- 0.5, Points: 5.0, Negative: 1.0)
- Exact Input (343.2): Earned 5.0 / 5.0 points -> PASS
- In-Tolerance Input (343.5): Earned 5.0 / 5.0 points -> PASS
- Out-of-Tolerance Input (344.0): Earned -1.0 / 5.0 points -> PASS

### Test 5: Short Answer Evaluation
- Case-Insensitive String Match ("https" vs "HTTPS"): Earned 3.0 / 3.0 points -> PASS
- Mismatch ("FTP"): Earned 0 / 3.0 points -> PASS
- Subjective Question with `manualGrading: true`: Earned 0 points, `status: 'pending'`, feedback: "Awaiting manual teacher evaluation" -> PASS

---

## 2. IMMUTABILITY AUDIT EVIDENCE
- Question Bank Asset: `Original Bank Question: What is Dijkstra algorithm used for?` (Points: 5.0)
- Imported to Exam: Created new row in `exam_questions`
- Mutation Applied to Bank Asset: Changed prompt to `MUTATED BANK QUESTION`, raised points to 100.0
- Re-query Exam Question: Prompt remained `Original Bank Question: What is Dijkstra algorithm used for?`, points remained 5.0 -> PASS
- Archive Parent Asset: Exam question remained intact in exam -> PASS

---

## 3. SUMMARY
All 25 automated assertions verified with zero failures.
