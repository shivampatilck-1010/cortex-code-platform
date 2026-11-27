export type FeatureCode = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';
export type TestTier = 1 | 2 | 3 | 4;
export type StrategyTag =
  | '[PW-DOM/GEO]'
  | '[PW-KB]'
  | '[PW-RELOAD]'
  | '[PW-CLOCK]'
  | '[HTTP]'
  | '[STORAGE]'
  | '[STATIC]';

export interface MatrixTestCase {
  id: string;
  tier: TestTier;
  feature: FeatureCode | 'Cross-Feature' | 'Journey';
  features: FeatureCode[];
  title: string;
  requirementRef: string;
  strategies: StrategyTag[];
  expectedBehavior: string;
}

export const LEARN_E2E_MATRIX: MatrixTestCase[] = [
  // =========================================================================
  // TIER 1: FEATURE COVERAGE (39 Tests across F1-F7)
  // =========================================================================

  // F1: /learn Course Catalog, Top Bar, Continue Learning & Track Filtering (6)
  {
    id: 'T1-F1-01',
    tier: 1,
    feature: 'F1',
    features: ['F1'],
    title: 'Top Bar Landmarks & Route Health',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1, R2; AC Catalog',
    strategies: ['[HTTP]', '[PW-DOM/GEO]'],
    expectedBehavior:
      '/learn returns HTTP 200 with h-12 (48px) top bar, Cortex mark, Learn/Practice Hub/Open IDE nav links, Search input, and theme toggle with zero console/page errors.',
  },
  {
    id: 'T1-F1-02',
    tier: 1,
    feature: 'F1',
    features: ['F1'],
    title: 'Three Seeded Courses & Card Anatomy',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1, R3; PROJECT.md F1, F3',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'All 3 seeded courses render in a multi-column grid on desktop displaying level tag, title, 2-line summary, structured metadata, progress bar, and Start Course CTA.',
  },
  {
    id: 'T1-F1-03',
    tier: 1,
    feature: 'F1',
    features: ['F1'],
    title: 'Monochrome + Warm-Amber Accent Discipline',
    requirementRef: 'ORIGINAL_REQUEST.md R2; AC Catalog',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Primary CTAs avoid solid bright orange (#ff9100) or neon green fills, and progress bar fills use restrained warm amber (#F59E0B).',
  },
  {
    id: 'T1-F1-04',
    tier: 1,
    feature: 'F1',
    features: ['F1'],
    title: 'Underline Track Filter Tabs',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1; AC Catalog',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Track tabs (All Tracks, Python & DSA, Systems & C++, SQL & Data, AI & ML) filter course cards to matching track(s) and show active underline styling.',
  },
  {
    id: 'T1-F1-05',
    tier: 1,
    feature: 'F1',
    features: ['F1'],
    title: 'Live Search Filtering',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1; AC Catalog',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Typing a query such as "Hash" or "Smart Pointers" filters matching course cards live, and clearing input restores all 3 courses.',
  },
  {
    id: 'T1-F1-06',
    tier: 1,
    feature: 'F1',
    features: ['F1'],
    title: 'Continue Learning Strip When In Progress',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1; PROJECT.md Contract 4',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'With an in-progress course in cortex_learn_progress_v1, Continue Learning strip appears showing module title, progress bar, and Resume Lesson CTA while card shows Continue.',
  },

  // F2: /learn/[courseId] 3-Zone Course Player Shell & Notes Mode (6)
  {
    id: 'T1-F2-01',
    tier: 1,
    feature: 'F2',
    features: ['F2'],
    title: '3-Zone Editorial Layout Geometry',
    requirementRef: 'ORIGINAL_REQUEST.md R1.2; AC Player',
    strategies: ['[HTTP]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'At 1440x900 on Notes view, left syllabus drawer (~280px), center canvas (max-w-[760px]), and right On This Page outline (~200-210px) render side-by-side without horizontal overflow.',
  },
  {
    id: 'T1-F2-02',
    tier: 1,
    feature: 'F2',
    features: ['F2'],
    title: 'Collapsible Syllabus Drawer & Module Accordions',
    requirementRef: 'ORIGINAL_REQUEST.md R1.2, R4; AC Player',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Toggle Syllabus button collapses and restores the 280px drawer; module accordions expand/collapse items showing typed lesson labels and subtle attribution footer.',
  },
  {
    id: 'T1-F2-03',
    tier: 1,
    feature: 'F2',
    features: ['F2'],
    title: 'Notes Editorial Hierarchy & On This Page Outline',
    requirementRef: 'ORIGINAL_REQUEST.md R1.2, R2, R4; AC Notes',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Notes view displays reading meta header, h1 (>=24px), TL;DR/Key Concepts box, h2 sections, comfortable prose measure, and interactive On This Page outline links.',
  },
  {
    id: 'T1-F2-04',
    tier: 1,
    feature: 'F2',
    features: ['F2'],
    title: 'Code Block Copy Action',
    requirementRef: 'ORIGINAL_REQUEST.md R2, R4; AC Notes',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Clicking Copy on a Notes code block writes exact snippet text to clipboard and transitions button text to Copied.',
  },
  {
    id: 'T1-F2-05',
    tier: 1,
    feature: 'F2',
    features: ['F2'],
    title: 'Code Block Try in IDE -> Handoff',
    requirementRef: 'ORIGINAL_REQUEST.md R2, R4; PROJECT.md Contract 5',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Clicking Try in IDE writes sessionStorage["cortex_ide_pending_snippet"] and navigates to /ide?snippet=1&lang=...&filename=...&course=...&lesson=....',
  },
  {
    id: 'T1-F2-06',
    tier: 1,
    feature: 'F2',
    features: ['F2'],
    title: 'Mark Complete & Continue -> Progression',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Notes',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Clicking Mark Complete & Continue records completion in cortex_learn_progress_v1, increases progress %, and advances to the next lesson.',
  },

  // F3: Concept Quiz Mode (5)
  {
    id: 'T1-F3-01',
    tier: 1,
    feature: 'F3',
    features: ['F3'],
    title: 'Single-Question Step-by-Step Rendering',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Quiz',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Concept Quiz renders one question at a time ("Question 1 of 4") with prompt, optional snippet, and A/B/C/D options without pre-revealing answers.',
  },
  {
    id: 'T1-F3-02',
    tier: 1,
    feature: 'F3',
    features: ['F3'],
    title: 'Instant Answer Check & Feedback Explanation',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Quiz',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Selecting an option and checking reveals instant emerald/rose feedback plus explanation text and enables advancing to the next question.',
  },
  {
    id: 'T1-F3-03',
    tier: 1,
    feature: 'F3',
    features: ['F3'],
    title: 'Keyboard Shortcuts 1-4 and Enter',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Quiz',
    strategies: ['[PW-KB]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Pressing 2 selects option B, pressing Enter checks the answer and shows feedback, and pressing Enter again advances to Question 2 of 4.',
  },
  {
    id: 'T1-F3-04',
    tier: 1,
    feature: 'F3',
    features: ['F3'],
    title: 'Passing Score Summary & Completion Unlock',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Quiz',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Answering all questions correctly renders Passed summary, marks quiz completed in syllabus, and stores passed=true in cortex_learn_progress_v1.quizScores.',
  },
  {
    id: 'T1-F3-05',
    tier: 1,
    feature: 'F3',
    features: ['F3'],
    title: 'Failing Score Summary & Review & Retry',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Quiz',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Scoring below passScore renders Review & Retry without marking item completed, and clicking Retry resets quiz to Question 1 of 4.',
  },

  // F4: Guided IDE Lab Mode (5)
  {
    id: 'T1-F4-01',
    tier: 1,
    feature: 'F4',
    features: ['F4'],
    title: 'Lab Briefing Content & Starter Preview',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Lab',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Two Sum Lab renders Guided IDE Lab header, language, estimated minutes, objective text, numbered step checklist, and read-only starter code preview.',
  },
  {
    id: 'T1-F4-02',
    tier: 1,
    feature: 'F4',
    features: ['F4'],
    title: 'Two Sum Starter Code Is Genuine Problem Stub',
    requirementRef: 'PROJECT.md Contract 2',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Two Sum starter code preview is an incomplete stub and does not pre-fill the completed hash-map solution.',
  },
  {
    id: 'T1-F4-03',
    tier: 1,
    feature: 'F4',
    features: ['F4'],
    title: 'Launch Lab in Cortex IDE -> Navigation',
    requirementRef: 'ORIGINAL_REQUEST.md R4; PROJECT.md Contract 5',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Clicking Launch Lab in Cortex IDE navigates to /ide?course=...&lesson=... and opens CortexIdeShell rather than PracticeWorkspace.',
  },
  {
    id: 'T1-F4-04',
    tier: 1,
    feature: 'F4',
    features: ['F4'],
    title: 'Multi-Language Lab Support (cpp-systems & sql-design)',
    requirementRef: 'ORIGINAL_REQUEST.md R3, R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'C++ and SQL courses render language-specific lab briefings, checklists, and starter previews and navigate cleanly to /ide?course=...&lesson=....',
  },
  {
    id: 'T1-F4-05',
    tier: 1,
    feature: 'F4',
    features: ['F4'],
    title: 'Lab Checklist Persistence From Course Player or Companion',
    requirementRef: 'PROJECT.md Contracts 4 & 5',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Toggling lab checklist steps or marking lab complete persists to cortex_learn_progress_v1 and reflects in the Lab view.',
  },

  // F5: Distraction-Free Timed Exam Mode (6)
  {
    id: 'T1-F5-01',
    tier: 1,
    feature: 'F5',
    features: ['F5'],
    title: 'Exam Briefing Screen Before Start',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Exam',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Timed Exam opens on Briefing screen showing duration, question count, pass threshold, and Begin Timed Exam button with syllabus still visible.',
  },
  {
    id: 'T1-F5-02',
    tier: 1,
    feature: 'F5',
    features: ['F5'],
    title: 'Auto-Collapse Syllabus & Sticky Exam Bar on Start',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Exam',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Clicking Begin Exam auto-collapses the left syllabus drawer and renders sticky Exam Bar with live countdown, question pills, Flag for Review, and Submit Exam.',
  },
  {
    id: 'T1-F5-03',
    tier: 1,
    feature: 'F5',
    features: ['F5'],
    title: 'Question Pills Navigation & Answered State',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Exam',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Answering a question updates its question navigator pill state, and clicking another pill navigates to that question.',
  },
  {
    id: 'T1-F5-04',
    tier: 1,
    feature: 'F5',
    features: ['F5'],
    title: 'Flag for Review Toggle State',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Exam',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Clicking Flag for Review highlights both the flag control and corresponding pill in amber; clicking again unflags it.',
  },
  {
    id: 'T1-F5-05',
    tier: 1,
    feature: 'F5',
    features: ['F5'],
    title: 'Countdown Warning Thresholds (<5m Amber, <2m Rose)',
    requirementRef: 'ORIGINAL_REQUEST.md R2, R4; AC Exam',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Advancing exam timer below 5 minutes styles timer in amber, and below 2 minutes transitions timer styling to rose.',
  },
  {
    id: 'T1-F5-06',
    tier: 1,
    feature: 'F5',
    features: ['F5'],
    title: 'Submit Exam Confirmation & Graded Exam Report',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Exam',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Confirming Submit Exam renders Exam Report with Pass/Fail status, percentage score, time taken, explanations, restores syllabus, and updates examAttempts.',
  },

  // F6: Shared Theme & Progress Persistence (5)
  {
    id: 'T1-F6-01',
    tier: 1,
    feature: 'F6',
    features: ['F6'],
    title: 'Default Dark Theme & Light Mode Toggle on /learn',
    requirementRef: 'ORIGINAL_REQUEST.md R2; PROJECT.md Contract 3',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Fresh session defaults to dark mode (html.dark present); toggling switches cortex_ide_theme to light, removes html.dark, and applies light canvas.',
  },
  {
    id: 'T1-F6-02',
    tier: 1,
    feature: 'F6',
    features: ['F6'],
    title: 'Theme Persistence Across Reload & All 3 Routes',
    requirementRef: 'ORIGINAL_REQUEST.md R2; AC Persistence',
    strategies: ['[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Light theme persists across /learn reload, /learn/[courseId], and /ide without reverting to dark.',
  },
  {
    id: 'T1-F6-03',
    tier: 1,
    feature: 'F6',
    features: ['F6'],
    title: 'Progress Persistence Across Reloads',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Persistence',
    strategies: ['[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Completed lessons and passed quizzes remain checked after reloading /learn/[courseId] and sync to /learn catalog.',
  },
  {
    id: 'T1-F6-04',
    tier: 1,
    feature: 'F6',
    features: ['F6'],
    title: 'Cross-Tab Live Synchronization (storage event)',
    requirementRef: 'PROJECT.md Contracts 3 & 4',
    strategies: ['[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Progress and theme updates in Page B propagate to Page A via browser storage events without manual reload.',
  },
  {
    id: 'T1-F6-05',
    tier: 1,
    feature: 'F6',
    features: ['F6'],
    title: 'Guest Session Progress Without 401 Failure',
    requirementRef: 'ORIGINAL_REQUEST.md R4; PROJECT.md F2',
    strategies: ['[HTTP]', '[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Unauthenticated students can read lessons, complete quizzes, and persist progress in localStorage without unhandled page errors.',
  },

  // F7: /ide Lab Companion & GlobalSidebar Reference Rail Tooltip Hardening (6)
  {
    id: 'T1-F7-01',
    tier: 1,
    feature: 'F7',
    features: ['F7'],
    title: '/ide?course=&lesson= Active Lab Companion Rendering',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3; PROJECT.md Contract 5',
    strategies: ['[HTTP]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Opening /ide?course=...&lesson=... opens Reference LearnSidebar in CortexIdeShell with only active lab objective, Load Starter Code, checklist, and Return to Course.',
  },
  {
    id: 'T1-F7-02',
    tier: 1,
    feature: 'F7',
    features: ['F7'],
    title: 'Load Starter Code & Live Two Sum Test Execution',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3; PROJECT.md Contract 5',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Clicking Load Starter Code loads Python stub into editor; submitting valid Two Sum solution and running tests updates live Two Sum test-case checklist.',
  },
  {
    id: 'T1-F7-03',
    tier: 1,
    feature: 'F7',
    features: ['F7'],
    title: 'Standalone Lab Step Checklist (No ideProblemId)',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3; PROJECT.md F6',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Opening a standalone C++ or SQL lab in /ide renders interactive step checkboxes whose state persists in cortex_learn_progress_v1.labSteps.',
  },
  {
    id: 'T1-F7-04',
    tier: 1,
    feature: 'F7',
    features: ['F7'],
    title: '/ide?snippet=1 Pending Snippet Hydration & One-Time Consume',
    requirementRef: 'ORIGINAL_REQUEST.md R2; PROJECT.md Contract 5',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Navigating to /ide?snippet=1 with sessionStorage payload creates/opens named tab with exact snippet code, consumes payload once, and shows Return to Course.',
  },
  {
    id: 'T1-F7-05',
    tier: 1,
    feature: 'F7',
    features: ['F7'],
    title: 'Idle /ide Reference Panel In-Progress List & /learn CTA',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3; AC IDE',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Idle /ide Reference panel displays minimal in-progress courses and an Open Full Learning Hub link pointing to /learn.',
  },
  {
    id: 'T1-F7-06',
    tier: 1,
    feature: 'F7',
    features: ['F7'],
    title: 'GlobalSidebar Reference Rail Tooltip Hardening (280ms, Dismiss, No Overlap)',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3; PROJECT.md Contract 6',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Tooltip obeys 280ms hover delay, pointer-events: none, left >= 58px without overlapping sidebar header text, dismisses on mousedown/click, and stays suppressed while active.',
  },

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (37 Tests across F1-F7)
  // =========================================================================

  // F1 Boundaries (5)
  {
    id: 'T2-F1-01',
    tier: 2,
    feature: 'F1',
    features: ['F1'],
    title: 'Empty Track Filter (AI & ML Track)',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1, R3',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Selecting AI & ML track (0 seeded courses) renders a clean empty-state message and filter reset control without layout collapse.',
  },
  {
    id: 'T2-F1-02',
    tier: 2,
    feature: 'F1',
    features: ['F1'],
    title: 'Search Query With Zero Matches & Special Regex Chars',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Searching regex metacharacters like "zzz[nonexistent](" shows graceful empty state with zero exceptions and recovers on clear.',
  },
  {
    id: 'T2-F1-03',
    tier: 2,
    feature: 'F1',
    features: ['F1'],
    title: 'Zero In-Progress Courses Hides Continue Strip',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'With empty cortex_learn_progress_v1, Continue Learning strip is absent from /learn DOM.',
  },
  {
    id: 'T2-F1-04',
    tier: 2,
    feature: 'F1',
    features: ['F1'],
    title: '100% Completed Course State',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1; PROJECT.md Contract 4',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Marking all items of a course complete shows 100% progress and completed/review state on its card without mislabeling it as unfinished.',
  },
  {
    id: 'T2-F1-05',
    tier: 2,
    feature: 'F1',
    features: ['F1'],
    title: 'Mobile (375x812) & Tablet (768x1024) Responsive Layout',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Catalog adapts to 1-col on 375px and 2-col on 768px with zero horizontal overflow (scrollWidth <= clientWidth).',
  },

  // F2 Boundaries (5)
  {
    id: 'T2-F2-01',
    tier: 2,
    feature: 'F2',
    features: ['F2'],
    title: 'Unknown Course ID (/learn/nonexistent-course)',
    requirementRef: 'ORIGINAL_REQUEST.md R1.2',
    strategies: ['[HTTP]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Navigating to an unknown course slug renders a clean not-found fallback with a working link back to /learn.',
  },
  {
    id: 'T2-F2-02',
    tier: 2,
    feature: 'F2',
    features: ['F2'],
    title: 'Invalid ?lesson=unknown-id Query Param',
    requirementRef: 'ORIGINAL_REQUEST.md R1.2',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Invalid ?lesson= param falls back gracefully to a valid default lesson without blank screen or crash.',
  },
  {
    id: 'T2-F2-03',
    tier: 2,
    feature: 'F2',
    features: ['F2'],
    title: 'Boundary Navigation: Previous on First Lesson & Final Lesson Completion',
    requirementRef: 'ORIGINAL_REQUEST.md R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Previous on first lesson is disabled or safe no-op; completing the final lesson updates course progress cleanly without out-of-bounds error.',
  },
  {
    id: 'T2-F2-04',
    tier: 2,
    feature: 'F2',
    features: ['F2'],
    title: 'Responsive On This Page Hiding Below 1280px & Non-Notes Views',
    requirementRef: 'ORIGINAL_REQUEST.md R1.2; AC Player',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'On This Page outline hides below 1280px (xl:block hidden) and stays hidden on Quiz, Lab, and Exam modes at 1440px.',
  },
  {
    id: 'T2-F2-05',
    tier: 2,
    feature: 'F2',
    features: ['F2'],
    title: 'Double-Click Copy & Rapid Lesson Switching',
    requirementRef: 'ORIGINAL_REQUEST.md R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Rapidly clicking Copy and immediately switching lessons prevents stale "Copied" state bleed or unhandled timer errors.',
  },

  // F3 Boundaries (5)
  {
    id: 'T2-F3-01',
    tier: 2,
    feature: 'F3',
    features: ['F3'],
    title: 'Keyboard Shortcuts 5-9 / a-z Ignored & Double Enter Guard',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Quiz',
    strategies: ['[PW-KB]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Pressing 5, 0, or a selects no option; pressing Enter with no option selected does not submit or crash.',
  },
  {
    id: 'T2-F3-02',
    tier: 2,
    feature: 'F3',
    features: ['F3'],
    title: 'Exact Pass Threshold Boundary (80% Pass vs 75% Fail)',
    requirementRef: 'ORIGINAL_REQUEST.md R3, R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'On a 4-question quiz with passScore 80, scoring 3/4 (75%) triggers Review & Retry without completion while 4/4 (100%) passes.',
  },
  {
    id: 'T2-F3-03',
    tier: 2,
    feature: 'F3',
    features: ['F3'],
    title: 'Switching Away Mid-Quiz Resets Unsubmitted Question State',
    requirementRef: 'ORIGINAL_REQUEST.md R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Switching to another lesson mid-quiz and returning resets unsubmitted quiz progress cleanly to Question 1.',
  },
  {
    id: 'T2-F3-04',
    tier: 2,
    feature: 'F3',
    features: ['F3'],
    title: 'Retry Increments Attempts & Preserves Passed Completion',
    requirementRef: 'PROJECT.md Contract 4',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Retaking a passed quiz increments attempts in quizScores and does not lose previously earned completion.',
  },
  {
    id: 'T2-F3-05',
    tier: 2,
    feature: 'F3',
    features: ['F3'],
    title: 'Code Snippet Rendering Inside Quiz Question',
    requirementRef: 'ORIGINAL_REQUEST.md R3, R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Quiz questions with codeSnippet render monospace code cleanly without horizontal page overflow at 375px.',
  },

  // F4 Boundaries (5)
  {
    id: 'T2-F4-01',
    tier: 2,
    feature: 'F4',
    features: ['F4'],
    title: 'Launching Lab When User Already Has Custom Code in /ide',
    requirementRef: 'PROJECT.md Contract 5',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Re-launching a lab via URL preserves existing user edits in the lab file rather than silently overwriting them unless Load Starter Code is clicked.',
  },
  {
    id: 'T2-F4-02',
    tier: 2,
    feature: 'F4',
    features: ['F4'],
    title: 'Launching Lab With Zero Open Editor Tabs (openFileIds = [])',
    requirementRef: 'PROJECT.md Contract 5',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Closing all tabs in /ide and opening a lab via URL or Load Starter Code creates and activates a new lab editor tab.',
  },
  {
    id: 'T2-F4-03',
    tier: 2,
    feature: 'F4',
    features: ['F4'],
    title: 'Launch Lab Overrides Saved localStorage Sidebar Tab (files / closed)',
    requirementRef: 'PROJECT.md Contract 5',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Even when cortex_active_sidebar_tab is "files" and cortex_sidebar_open is "false", ?course=&lesson= forces Reference LearnSidebar open.',
  },
  {
    id: 'T2-F4-04',
    tier: 2,
    feature: 'F4',
    features: ['F4'],
    title: 'Read-Only Starter Preview Integrity',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Lab',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Starter code preview on the Lab view is non-editable and matches the stub loaded by Load Starter Code in /ide.',
  },
  {
    id: 'T2-F4-05',
    tier: 2,
    feature: 'F4',
    features: ['F4'],
    title: 'Special Characters / Encoding in Course or Lesson Query Params',
    requirementRef: 'PROJECT.md Contract 5',
    strategies: ['[HTTP]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Navigating to /ide?course=python-dsa&lesson=nonexistent_lab_999 degrades gracefully without crash or blank screen.',
  },

  // F5 Boundaries (6)
  {
    id: 'T2-F5-01',
    tier: 2,
    feature: 'F5',
    features: ['F5'],
    title: 'Submit Exam With Unanswered Questions Confirmation',
    requirementRef: 'ORIGINAL_REQUEST.md R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Submitting with unanswered questions prompts confirmation; canceling keeps exam active while confirming submits and grades.',
  },
  {
    id: 'T2-F5-02',
    tier: 2,
    feature: 'F5',
    features: ['F5'],
    title: 'Timer Hits 00:00 Auto-Submit',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Exam',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Advancing the clock to full exam duration auto-submits at 00:00 and displays the Exam Report.',
  },
  {
    id: 'T2-F5-03',
    tier: 2,
    feature: 'F5',
    features: ['F5'],
    title: 'Switching Lessons Mid-Exam Cancels Active Exam State',
    requirementRef: 'ORIGINAL_REQUEST.md R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Leaving an unsubmitted exam resets answers, flags, and active timer state cleanly upon re-entry.',
  },
  {
    id: 'T2-F5-04',
    tier: 2,
    feature: 'F5',
    features: ['F5'],
    title: 'Exact <5m (300s vs 299s) and <2m (120s vs 119s) Color Boundaries',
    requirementRef: 'ORIGINAL_REQUEST.md R2, R4',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Timer transitions from neutral to amber below 300s and from amber to rose below 120s at exact second boundaries.',
  },
  {
    id: 'T2-F5-05',
    tier: 2,
    feature: 'F5',
    features: ['F5'],
    title: 'Failing Exam Below passScore (< 75%) & Retry',
    requirementRef: 'ORIGINAL_REQUEST.md R2, R4; AC Exam',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Failing exam displays Failed status in rose, leaves exam uncompleted in syllabus, and Retry clears answers/flags and restores timer.',
  },
  {
    id: 'T2-F5-06',
    tier: 2,
    feature: 'F5',
    features: ['F5'],
    title: 'Exam Report With Mix of Flagged, Unanswered, Correct, and Wrong Items',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Exam',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Exam Report accurately reflects mixed correct/wrong/blank items with per-question explanations and restores syllabus drawer.',
  },

  // F6 Boundaries (5)
  {
    id: 'T2-F6-01',
    tier: 2,
    feature: 'F6',
    features: ['F6'],
    title: 'Corrupted / Invalid JSON in cortex_learn_progress_v1',
    requirementRef: 'PROJECT.md Contract 4',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Malformed JSON in cortex_learn_progress_v1 recovers cleanly to empty progress without throwing SyntaxError.',
  },
  {
    id: 'T2-F6-02',
    tier: 2,
    feature: 'F6',
    features: ['F6'],
    title: 'Stale / Unknown Item IDs in cortex_learn_progress_v1',
    requirementRef: 'PROJECT.md Contract 4',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Unknown completedItemIds are ignored so progress % never exceeds 100% or becomes NaN%.',
  },
  {
    id: 'T2-F6-03',
    tier: 2,
    feature: 'F6',
    features: ['F6'],
    title: 'Invalid Value in cortex_ide_theme',
    requirementRef: 'PROJECT.md Contract 3',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Unknown theme string in cortex_ide_theme falls back safely to default dark mode (html.dark).',
  },
  {
    id: 'T2-F6-04',
    tier: 2,
    feature: 'F6',
    features: ['F6'],
    title: 'SSR / Hydration Cleanliness (hydrated guard)',
    requirementRef: 'PROJECT.md Contract 4',
    strategies: ['[HTTP]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Loading /learn and /learn/[courseId] with pre-seeded localStorage produces zero React hydration mismatch console warnings.',
  },
  {
    id: 'T2-F6-05',
    tier: 2,
    feature: 'F6',
    features: ['F6'],
    title: 'localStorage Throws QuotaExceededError / Disabled Storage',
    requirementRef: 'PROJECT.md Contracts 3 & 4',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'When localStorage.setItem throws, theme toggling and lesson completion still update in-memory UI without crashing.',
  },

  // F7 Boundaries (6)
  {
    id: 'T2-F7-01',
    tier: 2,
    feature: 'F7',
    features: ['F7'],
    title: '/ide?snippet=1 With Missing or Expired sessionStorage Payload',
    requirementRef: 'PROJECT.md Contract 5',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Opening /ide?snippet=1 without valid sessionStorage payload loads /ide safely without crashing or emptying the editor.',
  },
  {
    id: 'T2-F7-02',
    tier: 2,
    feature: 'F7',
    features: ['F7'],
    title: '/ide Project Hydration Preserves course, lesson, snippet, lang, filename',
    requirementRef: 'PROJECT.md Contract 5',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Project resolution router.replace in /ide preserves course, lesson, and snippet query params.',
  },
  {
    id: 'T2-F7-03',
    tier: 2,
    feature: 'F7',
    features: ['F7'],
    title: 'Rapid Hover-Then-Click Before 280ms Tooltip Timer Fires',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3; PROJECT.md Contract 6',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Clicking Reference before 280ms cancels the scheduled tooltip so it never flashes during or after the click.',
  },
  {
    id: 'T2-F7-04',
    tier: 2,
    feature: 'F7',
    features: ['F7'],
    title: 'Click Reference, Keep Mouse Stationary, Then Leave & Re-Enter',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3; PROJECT.md Contract 6',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Clicking Reference dismisses tooltip immediately and keeps it suppressed while stationary and while Reference panel stays active.',
  },
  {
    id: 'T2-F7-05',
    tier: 2,
    feature: 'F7',
    features: ['F7'],
    title: 'Close Reference Sidebar & Re-Hover Reference Rail Button',
    requirementRef: 'PROJECT.md Contract 6',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'After closing Reference panel and re-hovering >= 280ms, tooltip reappears at left >= 58px without overlapping rail border or editor.',
  },
  {
    id: 'T2-F7-06',
    tier: 2,
    feature: 'F7',
    features: ['F7'],
    title: 'LearnSidebar Narrow Sidebar Width (200px Min Resize)',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'At narrow sidebar width (~200px), active lab companion content wraps cleanly without clipping buttons or overflowing rail.',
  },

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (9 Pairwise Tests)
  // =========================================================================
  {
    id: 'T3-01',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F1', 'F2'],
    title: 'Catalog Filter -> Player -> Back to Catalog',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1, R1.2',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Filtering catalog to Systems & C++, completing Notes lesson 1, and returning to /learn updates card progress bar and Continue Learning strip.',
  },
  {
    id: 'T3-02',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F2', 'F7'],
    title: 'Notes Try in IDE -> -> /ide Snippet -> <- Return to Course',
    requirementRef: 'ORIGINAL_REQUEST.md R2, R4; PROJECT.md Contract 5',
    strategies: ['[STORAGE]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Launching Try in IDE from python-dsa Notes opens named snippet tab in /ide, and Return to Course restores the exact Notes lesson.',
  },
  {
    id: 'T3-03',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F4', 'F7'],
    title: 'Guided Lab -> /ide Two Sum -> Run Tests -> Return to Course',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3, R4; PROJECT.md Contract 5',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Launching Two Sum Lab in /ide, loading starter, running Two Sum solution tests, and clicking Return to Course lands back on the Two Sum Lab.',
  },
  {
    id: 'T3-04',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F3', 'F6'],
    title: 'Concept Quiz Pass -> Reload -> Catalog Progress Sync',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Persistence',
    strategies: ['[PW-KB]', '[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Passing Concept Quiz via keyboard persists across reload in /learn/[courseId] and updates /learn catalog progress.',
  },
  {
    id: 'T3-05',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F5', 'F6'],
    title: 'Timed Exam Pass -> Reload -> Course Progress & Retry History',
    requirementRef: 'ORIGINAL_REQUEST.md R4; AC Persistence',
    strategies: ['[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Passing Timed Exam persists checkmark and examAttempts history across player reload.',
  },
  {
    id: 'T3-06',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F1', 'F6'],
    title: 'Theme Toggle on /learn Synced to /ide & GlobalSidebar',
    requirementRef: 'ORIGINAL_REQUEST.md R2; PROJECT.md Contract 3',
    strategies: ['[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Switching /learn to Light mode and navigating via Open IDE renders /ide and GlobalSidebar in Light mode.',
  },
  {
    id: 'T3-07',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F2', 'F6'],
    title: 'Theme Toggle Inside /learn/[courseId] Player',
    requirementRef: 'ORIGINAL_REQUEST.md R2; AC Player',
    strategies: ['[PW-RELOAD]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Toggling Light mode in Course Player updates canvas/sidebar while preserving readable dark #121216 code block surface across reload.',
  },
  {
    id: 'T3-08',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F4', 'F6'],
    title: 'Lab Step Checkboxes Synced Between /ide Companion and /learn/[courseId]',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3, R4; PROJECT.md Contract 4',
    strategies: ['[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Checking standalone C++ lab steps in /ide companion persists to cortex_learn_progress_v1.labSteps and reflects after returning to course player and reloading.',
  },
  {
    id: 'T3-09',
    tier: 3,
    feature: 'Cross-Feature',
    features: ['F5', 'F7'],
    title: 'Active Timed Exam + Open IDE Navigation & Tooltip Safety',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3, R4',
    strategies: ['[PW-DOM/GEO]'],
    expectedBehavior:
      'Navigating to Open IDE from Timed Exam opens normal CortexIdeShell with Reference tooltip safety intact.',
  },

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (6 Student Journeys)
  // =========================================================================
  {
    id: 'T4-01',
    tier: 4,
    feature: 'Journey',
    features: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
    title: 'Journey 1: Complete Module 1 of Python & Data Structures Mastery (Notes -> Quiz -> Lab -> Exam)',
    requirementRef: 'ORIGINAL_REQUEST.md R1-R4',
    strategies: ['[PW-DOM/GEO]', '[PW-KB]', '[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Student filters Python & DSA, completes Module 1 Notes, passes 4-Q Quiz via keyboard, completes Two Sum Lab in /ide, passes Timed Exam, and verifies synced progress on /learn.',
  },
  {
    id: 'T4-02',
    tier: 4,
    feature: 'Journey',
    features: ['F1', 'F2', 'F6', 'F7'],
    title: 'Journey 2: Returning Student Resumes Mid-Course From /learn & /ide Idle Companion',
    requirementRef: 'ORIGINAL_REQUEST.md R1.1, R1.3, R4',
    strategies: ['[PW-DOM/GEO]', '[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Returning student opens Reference in idle /ide, navigates via Open Full Learning Hub to /learn, and clicks Resume Lesson to land on exact saved lesson.',
  },
  {
    id: 'T4-03',
    tier: 4,
    feature: 'Journey',
    features: ['F1', 'F2', 'F4', 'F6', 'F7'],
    title: 'Journey 3: Cross-Track Light-Mode C++ & SQL Study Session',
    requirementRef: 'ORIGINAL_REQUEST.md R1-R3',
    strategies: ['[PW-DOM/GEO]', '[PW-RELOAD]', '[STORAGE]'],
    expectedBehavior:
      'Student toggles Light mode on /learn, studies C++ Notes and standalone Lab in /ide, switches to SQL & Data track, and maintains clean Light-mode contrast throughout.',
  },
  {
    id: 'T4-04',
    tier: 4,
    feature: 'Journey',
    features: ['F5', 'F6'],
    title: 'Journey 4: Timed Exam Pressure Simulation (Flagging, Amber/Rose Warnings, Timeout Recovery)',
    requirementRef: 'ORIGINAL_REQUEST.md R2, R4',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]', '[STORAGE]'],
    expectedBehavior:
      'Student begins Timed Exam (syllabus collapses), flags a question, observes <5m amber and <2m rose warnings, experiences 00:00 auto-submit, then retries and passes.',
  },
  {
    id: 'T4-05',
    tier: 4,
    feature: 'Journey',
    features: ['F6', 'F7'],
    title: 'Journey 5: /ide Rail Ergonomics & Practice Hub Coexistence',
    requirementRef: 'ORIGINAL_REQUEST.md R1.3; PROJECT.md Contract 6',
    strategies: ['[PW-CLOCK]', '[PW-DOM/GEO]'],
    expectedBehavior:
      'Hovering/clicking all Activity Rail items including Reference and Sign In produces zero overlapping/lingering tooltips, Practice Hub works, and ?course=&lesson= exits PracticeWorkspace cleanly.',
  },
  {
    id: 'T4-06',
    tier: 4,
    feature: 'Journey',
    features: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
    title: 'Journey 6: Platform Governance, Build, Lint & Zero-Emoji Compliance',
    requirementRef: 'ORIGINAL_REQUEST.md Build, Lint & Browser Verification',
    strategies: ['[STATIC]', '[HTTP]'],
    expectedBehavior:
      'Static governance checks (zero-emoji TC4.1 across Learn & test files, no bare @ts-ignore TC5.3, no static playwright imports, valid build manifests or static compile readiness) succeed cleanly.',
  },
];

export interface MatrixValidationResult {
  valid: boolean;
  total: number;
  tierCounts: Record<TestTier, number>;
  tier1PerFeature: Record<FeatureCode, number>;
  tier2PerFeature: Record<FeatureCode, number>;
  errors: string[];
}

const ALL_FEATURES: FeatureCode[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];

export function validateMatrixCompleteness(
  cases: MatrixTestCase[] = LEARN_E2E_MATRIX
): MatrixValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  const tierCounts: Record<TestTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const tier1PerFeature: Record<FeatureCode, number> = {
    F1: 0,
    F2: 0,
    F3: 0,
    F4: 0,
    F5: 0,
    F6: 0,
    F7: 0,
  };
  const tier2PerFeature: Record<FeatureCode, number> = {
    F1: 0,
    F2: 0,
    F3: 0,
    F4: 0,
    F5: 0,
    F6: 0,
    F7: 0,
  };

  for (const tc of cases) {
    if (!tc.id || seenIds.has(tc.id)) {
      errors.push(`Duplicate or empty test ID: "${tc.id}"`);
    }
    seenIds.add(tc.id);

    if (!tc.title.trim() || !tc.requirementRef.trim() || !tc.expectedBehavior.trim()) {
      errors.push(`Incomplete metadata for test ${tc.id}`);
    }
    if (tc.strategies.length === 0) {
      errors.push(`Missing verification strategies for test ${tc.id}`);
    }

    tierCounts[tc.tier] += 1;

    if (tc.tier === 1 && tc.feature !== 'Cross-Feature' && tc.feature !== 'Journey') {
      tier1PerFeature[tc.feature] += 1;
    }
    if (tc.tier === 2 && tc.feature !== 'Cross-Feature' && tc.feature !== 'Journey') {
      tier2PerFeature[tc.feature] += 1;
    }
  }

  for (const feat of ALL_FEATURES) {
    if (tier1PerFeature[feat] < 5) {
      errors.push(`Tier 1 feature ${feat} has ${tier1PerFeature[feat]} tests (< 5 required)`);
    }
    if (tier2PerFeature[feat] < 5) {
      errors.push(`Tier 2 feature ${feat} has ${tier2PerFeature[feat]} tests (< 5 required)`);
    }
  }

  if (tierCounts[3] < 7) {
    errors.push(`Tier 3 has ${tierCounts[3]} tests (< 7 required)`);
  }
  if (tierCounts[4] < 5) {
    errors.push(`Tier 4 has ${tierCounts[4]} tests (< 5 required)`);
  }
  if (cases.length !== 91) {
    errors.push(`Total matrix count is ${cases.length} (expected 91)`);
  }

  return {
    valid: errors.length === 0,
    total: cases.length,
    tierCounts,
    tier1PerFeature,
    tier2PerFeature,
    errors,
  };
}
