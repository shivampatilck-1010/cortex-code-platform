# CORTEX ONLINE EXAMINATION SYSTEM
# PHASE 4.7 — ANALYTICS AND REPORTING GUIDE

Date: 2026-10-31  
Target Audience: University Instructors, Department Chairs, System Administrators  

---

## 1. INSTRUCTOR ANALYTICS GUIDE

### Accessing Examination Analytics
- Navigate to the Classroom -> Examinations tab.
- Click on an examination card to open the options menu.
- Select **View Analytics** or make a GET request to:
  ```http
  GET /api/v1/classrooms/{classroomId}/exams/{examId}/analytics
  ```

### Understanding Performance Indicators
- **Completion Rate**: Measures the percentage of enrolled students who completed and submitted their attempt.
- **Pass Rate**: Percentage of submitted candidates meeting or exceeding the `passingMarks` threshold.
- **Score Distribution**: Four performance buckets visually display student mastery and identify cohorts needing remediation.
- **Grading Status**: Displays pending subjective evaluations. Until subjective questions are scored by the teacher, the final score reflects only auto-graded components.

### Exporting Gradebook Data (CSV)
To export an official CSV report suitable for Excel or SIS import:
```http
GET /api/v1/classrooms/{classroomId}/exams/{examId}/analytics?format=csv
```
The resulting CSV includes all cohort summary metrics and question-level accuracy breakdowns.

---

## 2. ADMINISTRATOR TELEMETRY GUIDE

### Accessing Institutional Metrics
Institutional administrators access system telemetry via:
```http
GET /api/v1/admin/analytics
```
Requires cookie or authorization header with `role: 'admin'`.

### Metric Categories
1. **User Base**: Active and registered teacher and student volumes.
2. **Academic Structure**: Classroom course counts and archival statuses.
3. **Examination Operations**: Counts of exams in draft, scheduled, active, completed, or cancelled status.
4. **Platform Load**: Active in-progress examination sessions vs historically completed attempts.
