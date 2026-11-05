# CORTEX ONLINE EXAMINATION SYSTEM
# UNIVERSITY PILOT: INSTRUCTOR & TEACHER HANDBOOK

Document Version: 1.0.0  
Target Audience: University Faculty, Course Coordinators, Teaching Assistants  
Classification: Pilot Operational Documentation  
Platform: Cortex Online Examination System

---

## 1. INTRODUCTION

The Cortex Online Examination System provides instructors with an end-to-end environment for authoring, scheduling, proctoring, and evaluating university assessments. This handbook details the standard operating procedures for instructors participating in university examination pilots.

---

## 2. COURSE & CLASSROOM SETUP

### 2.1 Course Provisioning
1. Log in to your Cortex Instructor portal (`/login`).
2. Navigate to the Classroom Overview (`/classroom`).
3. Click "Create Classroom".
4. Configure required metadata:
   - Course Name (e.g., CS301: Algorithms & Data Structures)
   - Subject (e.g., Computer Science)
   - Academic Year (e.g., 2026-2027)
   - Section (e.g., Section A)
5. Save the classroom. The platform automatically generates a 6-character alphanumeric Join Code (e.g., `MH0EYQ`).

### 2.2 Student Enrollment
- Students join via the Join Code from their dashboard.
- Instructors can review enrolled candidates in the Roster view (`/classroom/{id}`).
- Unauthorized students can be removed or deactivated by course instructors.

---

## 3. EXAMINATION AUTHORING & CONFIGURATION

### 3.1 Creating an Examination
1. In the course navigation, select "Examinations" -> "New Examination".
2. Configure general assessment settings:
   - Examination Title: Official academic title.
   - Description & Instructions: Detailed student guidelines (calculator policy, academic integrity rules).
   - Duration: Strict time limit in minutes (e.g., 45 to 180 minutes).
   - Total & Passing Marks: Standard academic grading thresholds.
   - Security Level:
     - `standard`: Fullscreen and blur tracking active.
     - `restricted`: Strict browser lockdown.
     - `seb`: Safe Exam Browser required with cryptographic key verification.

### 3.2 Structuring Sections & Questions
- Sections: Organize questions into logical units (e.g., "Section 1: Conceptual MCQs", "Section 2: Proofs & Analysis").
- Question Types:
  - Single-Choice MCQ: Automatically graded; options randomized per candidate.
  - Multiple-Select MCQ: Graded on exact match or partial credit policy.
  - Numerical: Exact decimal matching with optional tolerance.
  - Short Answer / Subjective: Requires manual grading rubrics.

### 3.3 Question Bank Integration
Instructors can draw questions from their private Question Bank or create ad-hoc exam-specific items. Questions added to an exam are snapshotted to preserve immutability.

---

## 4. SCHEDULING & PUBLISHING

### 4.1 Examination Lifecycles
- `draft`: Only visible to instructors; candidates cannot see or start the exam.
- `scheduled`: Visible in student portals with a countdown timer to the start window.
- `published` / `active`: Candidates can initiate attempts within the availability window.
- `ended`: Submissions are closed; automated grading is finalized.
- `results_published`: Scorecards and instructor feedback become visible to candidates.

### 4.2 Cohort Restriction
By default, all enrolled students in the classroom can sit for published exams. To restrict an assessment to specific students (e.g., makeup exams or honors sections), populate the `assignedStudentIds` cohort filter.

---

## 5. LIVE PROCTORING & MONITORING

During an active examination window, instructors monitor candidates via the Live Proctoring Dashboard (`/classroom/{id}/exams/{examId}/dashboard`):
- Active Session List: Current connection status, heartbeat latency, and completion percentage.
- Integrity Alerts: Non-punitive real-time signals indicating window blur, fullscreen exits, or network reconnects.
- Grace Period Tracking: Students who lose network connectivity retain a 30-second post-expiry window for local write-ahead buffer delivery.

---

## 6. EVALUATION & GRADING

### 6.1 Automated Scoring
Objective questions (MCQ, True/False, Numerical) are calculated server-side immediately upon student submission. Answer keys are never transmitted to student browsers prior to evaluation.

### 6.2 Manual Evaluation Workflow
1. Navigate to "Submissions" for the completed exam.
2. Select a candidate submission (`/submissions/{sessionId}`).
3. Review candidate text responses against the instructor rubric.
4. Assign points per question and enter optional constructive feedback.
5. Save the grade. The platform updates total marks and marks the attempt as manually graded.

### 6.3 Releasing Results
Toggle "Publish Results" to allow students to view their itemized scorecard and qualitative instructor comments.
