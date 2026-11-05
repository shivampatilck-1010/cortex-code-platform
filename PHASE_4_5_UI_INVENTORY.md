# CORTEX ONLINE EXAMINATION SYSTEM
# PHASE 4.5 — COMPREHENSIVE UI/UX INVENTORY

Date: 2026-10-31  
Target Environment: Cortex Online Examination System (Frontend UI Subsystem)  
Standard: Strictly Zero Emojis, Accessible Component Typography  

---

## 1. COMPONENT DIRECTORY AND SCOPE

The examination UI is modularized in [src/components/classroom/exams](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/components/classroom/exams) and integrates directly into the primary classroom layout tabs:

| Component File | Role / View | Key Responsibilities |
|---|---|---|
| `ExaminationsTab.tsx` | Teacher / Student Hub | List exams, filtering (Upcoming, Active, Completed, Draft), status badges, action triggers |
| `ExamBuilderModal.tsx` | Teacher Modal | Title, duration, schedule window, total/passing marks, security level, SEB toggles, auto-shuffle |
| `ExamQuestionsManagerModal.tsx` | Teacher Modal | Question bank selector, MCQ/numerical/short-answer creation, point values, negative marking, drag/sort |
| `ExamSectionsBranchingModal.tsx` | Teacher Modal | Section definitions, instructions, time-limits, conditional branching rule configuration |
| `ExamLiveDashboardModal.tsx` | Teacher Live Monitor | Real-time candidate monitoring, active attempts, heartbeats, focus-loss warnings, connection status |
| `ExamSubmissionsModal.tsx` | Teacher Grading Hub | Candidate attempt review, auto-scored breakdown, subjective answer manual grading, feedback entry |
| `ExamPreviewModal.tsx` | Teacher Verification | Read-only emulation of candidate exam view prior to publishing |
| `ExamRunnerModal.tsx` | Student Exam Runner | Distraction-free exam runner, countdown timer, autosave queue, network reconnect banner, submission dialog |
| `QuestionBankModal.tsx` | Shared Asset Library | Categorized repository of reusable questions with difficulty, tags, and search filtering |

---

## 2. INTERFACE AUDIT MATRIX

### 2.1 Teacher Interface
- **Creation & Scheduling**: Inputs for start/end timestamps validate `startTime < endTime`. Durations are restricted to positive integers.
- **Question Management**: Supports Single MCQ, Multi-select MCQ, True/False, Numerical, Short Answer. Points and negative marks accept float values.
- **Live Monitoring**: Visual badge indicators for Active (Emerald), Reconnecting (Amber), and Disconnected (Red).
- **Grading & Results**: Manual scores validate against maximum question points. Teacher feedback text area supports rich feedback.

### 2.2 Student Interface
- **Dashboard Visibility**: Exams become visible when published; Start button is locked until `now >= startTime`.
- **Exam Runner Focus**: Fullscreen lock with escape warning overlay. Keyboard shortcut suppression for Alt+Tab, Ctrl+C, Ctrl+V, F12.
- **Autosave Banner**: Discrete state machine badge:
  - `idle`: Gray dot
  - `saving`: Blue pulsing indicator
  - `saved`: Green checkmark with server timestamp
  - `offline`: Amber warning with retry countdown
- **Question Palette**: Grid navigation displaying answered (Green), unanswered (Gray), and flagged for review (Orange bookmark).

### 2.3 Administrator Interface
- User management table with role filtering (Student, Teacher, Admin).
- System-wide examination audits and security event logs.
- Privileged diagnostics route `/api/v1/health/internal` shielded from public access.

---

## 3. DESIGN SYSTEM INTEGRITY

- **Typography**: Inter / sans-serif academic hierarchy. Heading scales from `text-xl` to `text-sm` with high contrast (`text-white` to `text-gray-300`).
- **Dark Theme Standards**: Background `#0f1015` with component containers `#161821` and borders `#232738`.
- **Zero Emojis**: Replaced all informal emojis with semantic Lucide SVG icons (`Clock`, `Shield`, `Award`, `Wifi`, `WifiOff`, `CheckCircle`, `AlertTriangle`).
- **Responsive Breakpoints**: Tailored flex/grid configurations validated at 1280px (Desktop), 1024px (Tablet), and 390px (Mobile).
