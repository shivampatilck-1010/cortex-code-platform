/**
 * CORTEX ONLINE EXAMINATION SYSTEM
 * SEED DEMO EXAMINATIONS SCRIPT
 *
 * Populates comprehensive, realistic examination demo data into cortex-db (production)
 * for classroom CLS_1792819623330_ZF01 (CS 276: Systems Programming & Concurrency)
 * and CLS_DEMO_DSA_2026 (CS 201: Data Structures and Algorithms).
 *
 * Covers ALL examination states:
 * 1. Active & Published (Live now, in-progress student session, live proctor telemetry)
 * 2. Draft (Unpublished, editable, ready for authoring/publishing)
 * 3. Scheduled (Upcoming, future start time, Level 3 SEB configuration)
 * 4. Past / Results Published (Concluded, with student submissions, scores & feedback)
 * 5. Reusable Question Bank (Populated catalog with tags, difficulty levels, types)
 * 6. Enrolls student test accounts so the user can test candidate taking flow.
 */

import * as fs from 'fs';
import * as path from 'path';

const now = Date.now();
const oneMinute = 60 * 1000;
const oneHour = 3600 * 1000;
const oneDay = 24 * 3600 * 1000;

function esc(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? '1' : '0';
  return `'${val.toString().replace(/'/g, "''")}'`;
}

const statements: string[] = [];

// Classrooms
const classCS276 = 'CLS_1792819623330_ZF01';
const classCS201 = 'CLS_DEMO_DSA_2026';

// Teachers
const teacherShivam1 = 'usr_mubernpn8x1dc'; // shivampatilck@gmail.com (owner of CS 276)
const teacherShivam2 = 'usr_mvlyg1pd44g4k'; // shivampatilcka@gmail.com

// Students
const studentAlex = 'usr_demo_alex';
const studentSophia = 'usr_demo_sophia';
const studentMarcus = 'usr_demo_marcus';
const studentElena = 'usr_demo_elena';
const studentLiam = 'usr_demo_liam';
const studentShivamTest = 'usr_muqri29zhy2cf'; // shivampatilc@gmail.com
const studentShivamInco = 'user_iz15ru6'; // shivam.inco@student.cortex.edu

// 1. Ensure test student accounts are enrolled in CS 276
statements.push(`
  INSERT OR IGNORE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
  VALUES ('mem_cs276_shivamtest', ${esc(classCS276)}, ${esc(studentShivamTest)}, 'shivamtest', 'shivampatilc@gmail.com', 'student', 'active', ${now - 2 * oneDay}, ${now}, 1);
`);
statements.push(`
  INSERT OR IGNORE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
  VALUES ('mem_cs276_shivaminco', ${esc(classCS276)}, ${esc(studentShivamInco)}, 'shivam inco', 'shivam.inco@student.cortex.edu', 'student', 'active', ${now - 2 * oneDay}, ${now}, 1);
`);

// -------------------------------------------------------------
// EXAM 1: ACTIVE & PUBLISHED (Live Right Now)
// -------------------------------------------------------------
const examActiveId = 'EXAM_CSE276_ACTIVE_MIDTERM';
statements.push(`
  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    ${esc(examActiveId)},
    ${esc(classCS276)},
    'Midterm Exam: Multithreading, Memory Models & Lock-Free Structures',
    'Official midterm examination covering thread synchronization, memory consistency models, lock-free queues, and concurrent data structure design in C/C++. Live proctoring and integrity telemetry active.',
    60,
    ${now - 20 * oneMinute},
    ${now + 4 * oneHour},
    100,
    40,
    2,
    'restricted',
    'active',
    0,
    1,
    1,
    '[]',
    ${esc(teacherShivam1)},
    ${now - 2 * oneDay},
    ${now}
  );
`);

// Sections for Exam 1
statements.push(`
  INSERT OR REPLACE INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
  VALUES ('sec_mid_1', ${esc(examActiveId)}, 'Part A: Memory Models & Cache Coherency', 'Fundamental theoretical concepts', 'Answer all single and multi-select questions. 10 minutes allocated.', 1, 10, 1, 30);
`);
statements.push(`
  INSERT OR REPLACE INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
  VALUES ('sec_mid_2', ${esc(examActiveId)}, 'Part B: Synchronization & Little’s Law', 'Calculations and deadlock mechanisms', 'Numerical answers must be accurate to within 0.05 tolerance.', 1, 15, 2, 30);
`);
statements.push(`
  INSERT OR REPLACE INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
  VALUES ('sec_mid_3', ${esc(examActiveId)}, 'Part C: Concurrent Systems Implementation', 'Hands-on concurrent programming', 'Implement thread-safe operations in C++ using atomic primitives.', 1, 35, 3, 40);
`);

// Questions for Exam 1
// Q1: MCQ Single
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_1',
    ${esc(examActiveId)},
    'sec_mid_1',
    'mcq_single',
    'Under the MESI cache coherency protocol, which state indicates that a cache line is valid, dirty (modified with respect to main memory), and present only in the current core cache?',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_m1', text: 'Modified (M)', isCorrect: true },
      { id: 'opt_m2', text: 'Exclusive (E)', isCorrect: false },
      { id: 'opt_m3', text: 'Shared (S)', isCorrect: false },
      { id: 'opt_m4', text: 'Invalid (I)', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_m1'] }))},
    '[]',
    NULL,
    NULL,
    10,
    0,
    0,
    1,
    ${now - 2 * oneDay},
    ${now}
  );
`);

// Q2: MCQ Multiple
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_2',
    ${esc(examActiveId)},
    'sec_mid_1',
    'mcq_multiple',
    'Which of the following are hazards inherent to lock-free concurrent data structures that require safe memory reclamation techniques like hazard pointers or RCU? (Select all that apply)',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_h1', text: 'ABA Problem', isCorrect: true },
      { id: 'opt_h2', text: 'Premature node deallocation (Use-After-Free)', isCorrect: true },
      { id: 'opt_h3', text: 'Priority Inversion', isCorrect: false },
      { id: 'opt_h4', text: 'Cache line false sharing', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_h1', 'opt_h2'] }))},
    '[]',
    NULL,
    NULL,
    20,
    2,
    0,
    2,
    ${now - 2 * oneDay},
    ${now}
  );
`);

// Q3: Numerical
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_3',
    ${esc(examActiveId)},
    'sec_mid_2',
    'numerical',
    'According to Amdahl''s Law, if 75% of an algorithm can be perfectly parallelized (P = 0.75), what is the theoretical maximum speedup limit S as the number of parallel cores approaches infinity (N -> inf)?',
    NULL,
    '[]',
    ${esc(JSON.stringify({ numericalAnswer: 4.0 }))},
    '[]',
    NULL,
    NULL,
    15,
    0,
    0.05,
    3,
    ${now - 2 * oneDay},
    ${now}
  );
`);

// Q4: Subjective
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_4',
    ${esc(examActiveId)},
    'sec_mid_2',
    'subjective',
    'List the four Coffman conditions necessary for deadlock to manifest in a concurrent system, and explain how establishing a global lock hierarchy eliminates Circular Wait.',
    NULL,
    '[]',
    ${esc(JSON.stringify({
      idealAnswer: 'The four Coffman conditions are: 1. Mutual Exclusion, 2. Hold and Wait, 3. No Preemption, 4. Circular Wait. Establishing a strict total lock ordering ensures that threads always acquire locks in monotonically increasing numerical order, preventing cyclical wait chains.',
    }))},
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    4,
    ${now - 2 * oneDay},
    ${now}
  );
`);

// Q5: Coding
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_5',
    ${esc(examActiveId)},
    'sec_mid_3',
    'coding',
    'Implement a lock-free thread-safe counter in C++ using std::atomic<int>. Fill in the SafeCounter methods increment(), decrement(), and get() ensuring atomic correctness without mutexes.',
    NULL,
    '[]',
    ${esc(JSON.stringify({ language: 'cpp' }))},
    ${esc(JSON.stringify([
      { id: 'tc1', input: '', expectedOutput: '2\\n', isHidden: false, points: 20 },
      { id: 'tc2', input: '', expectedOutput: '2\\n', isHidden: true, points: 20 },
    ]))},
    ${esc(`#include <iostream>
#include <atomic>

class SafeCounter {
private:
    std::atomic<int> count{0};
public:
    void increment() {
        count.fetch_add(1, std::memory_order_relaxed);
    }
    void decrement() {
        count.fetch_sub(1, std::memory_order_relaxed);
    }
    int get() const {
        return count.load(std::memory_order_relaxed);
    }
};

int main() {
    SafeCounter counter;
    counter.increment();
    counter.increment();
    counter.increment();
    counter.decrement();
    std::cout << counter.get() << std::endl;
    return 0;
}`)},
    'cpp',
    40,
    0,
    0,
    5,
    ${now - 2 * oneDay},
    ${now}
  );
`);

// Active Session for Live Proctoring Demo
// Student Alex Chen is actively sitting this exam right now!
const liveSessionId = 'sess_live_alex_midterm';
statements.push(`
  INSERT OR REPLACE INTO exam_sessions (
    id, exam_id, user_id, attempt_number, status, started_at, expires_at,
    submitted_at, auto_score, manual_score, final_score, is_published,
    teacher_feedback, created_at, updated_at, last_heartbeat_at, current_section_id
  ) VALUES (
    ${esc(liveSessionId)},
    ${esc(examActiveId)},
    ${esc(studentAlex)},
    1,
    'in_progress',
    ${now - 15 * oneMinute},
    ${now + 45 * oneMinute},
    NULL,
    10,
    NULL,
    NULL,
    0,
    '',
    ${now - 15 * oneMinute},
    ${now - 5 * 1000},
    ${now - 5 * 1000},
    'sec_mid_2'
  );
`);

// Responses for Alex Chen
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (
    id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at
  ) VALUES (
    'resp_alex_q1',
    ${esc(liveSessionId)},
    'q_mid_1',
    ${esc(JSON.stringify({ selectedOptions: ['opt_m1'] }))},
    10,
    'graded',
    'Correct MESI state identified',
    0,
    ${now - 12 * oneMinute}
  );
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (
    id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at
  ) VALUES (
    'resp_alex_q3',
    ${esc(liveSessionId)},
    'q_mid_3',
    ${esc(JSON.stringify({ numericalAnswer: 4.0 }))},
    15,
    'graded',
    'Accurate Amdahl calculation',
    0,
    ${now - 8 * oneMinute}
  );
`);

// Integrity events for Alex Chen (visible in Monitor / Live Dashboard)
statements.push(`
  INSERT OR REPLACE INTO exam_integrity_events (id, session_id, event_type, timestamp, details_json)
  VALUES ('int_alex_1', ${esc(liveSessionId)}, 'focus_lost', ${now - 10 * oneMinute}, ${esc(JSON.stringify({ reason: 'window_blur', durationMs: 2400 }))});
`);
statements.push(`
  INSERT OR REPLACE INTO exam_integrity_events (id, session_id, event_type, timestamp, details_json)
  VALUES ('int_alex_2', ${esc(liveSessionId)}, 'fullscreen_exit', ${now - 6 * oneMinute}, ${esc(JSON.stringify({ windowWidth: 1920, windowHeight: 1080 }))});
`);

// -------------------------------------------------------------
// EXAM 2: DRAFT (Unpublished - Visible in "Drafts" Tab)
// -------------------------------------------------------------
const examDraftId = 'EXAM_CSE276_DRAFT_IPC';
statements.push(`
  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    ${esc(examDraftId)},
    ${esc(classCS276)},
    'Quiz 4: POSIX Signals, Pipes & Inter-Process Communication',
    'Asynchronous in-class evaluation covering Unix signals, asynchronous signal safety, pipe buffers, and shared memory segments. Authoring currently in progress.',
    25,
    ${now + 24 * oneHour},
    ${now + 26 * oneHour},
    30,
    15,
    1,
    'level_1_standard',
    'draft',
    0,
    1,
    1,
    '[]',
    ${esc(teacherShivam1)},
    ${now - 1 * oneDay},
    ${now}
  );
`);

// Questions for Draft Exam
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_draft_1',
    ${esc(examDraftId)},
    NULL,
    'mcq_single',
    'Which POSIX signal CANNOT be caught, blocked, or ignored by any user-space process under standard kernel semantics?',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_d1', text: 'SIGKILL (9)', isCorrect: true },
      { id: 'opt_d2', text: 'SIGTERM (15)', isCorrect: false },
      { id: 'opt_d3', text: 'SIGINT (2)', isCorrect: false },
      { id: 'opt_d4', text: 'SIGSEGV (11)', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_d1'] }))},
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    1,
    ${now - 1 * oneDay},
    ${now}
  );
`);
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_draft_2',
    ${esc(examDraftId)},
    NULL,
    'mcq_single',
    'When creating a unidirectional pipe using pipe(int pipefd[2]) in C, which descriptor index is designated as the read end?',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_p1', text: 'pipefd[0]', isCorrect: true },
      { id: 'opt_p2', text: 'pipefd[1]', isCorrect: false },
      { id: 'opt_p3', text: 'pipefd[2]', isCorrect: false },
      { id: 'opt_p4', text: 'Arbitrary index decided at runtime', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_p1'] }))},
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    2,
    ${now - 1 * oneDay},
    ${now}
  );
`);

// -------------------------------------------------------------
// EXAM 3: SCHEDULED (Future / Safe Exam Browser Level 3)
// -------------------------------------------------------------
const examScheduledId = 'EXAM_CSE276_SCHEDULED_FINAL';
statements.push(`
  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at,
    seb_config_key, seb_quit_password, seb_quit_password_hash, seb_allow_reload, seb_show_reload_warning
  ) VALUES (
    ${esc(examScheduledId)},
    ${esc(classCS276)},
    'Final Comprehensive Examination: Distributed Consensus & Fault Tolerance',
    'End-of-term proctored final assessment. Covers Raft consensus, Paxos states, Byzantine faults, and vector timestamp ordering. High-stakes assessment requiring Safe Exam Browser (SEB).',
    120,
    ${now + 48 * oneHour},
    ${now + 52 * oneHour},
    100,
    50,
    1,
    'seb',
    'scheduled',
    1,
    1,
    0,
    '[]',
    ${esc(teacherShivam1)},
    ${now - 3 * oneDay},
    ${now},
    'e7c2f89312b94a8d01f56e39bc27184a7e9301824b5c6d7e8f90a1b2c3d4e5f6',
    'CortexFinal2026!',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    0,
    1
  );
`);

statements.push(`
  INSERT OR REPLACE INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
  VALUES ('sec_sched_1', ${esc(examScheduledId)}, 'Section 1: Raft & Leader Election', 'Consensus RPCs and state transitions', 'Solve all questions in order.', 1, 60, 1, 50);
`);
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_sched_1',
    ${esc(examScheduledId)},
    'sec_sched_1',
    'mcq_single',
    'In the Raft consensus algorithm, what RPC message does a candidate broadcast to all peer nodes during a leader election term?',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_r1', text: 'RequestVote RPC', isCorrect: true },
      { id: 'opt_r2', text: 'AppendEntries RPC', isCorrect: false },
      { id: 'opt_r3', text: 'HeartbeatSync RPC', isCorrect: false },
      { id: 'opt_r4', text: 'CommitIndex RPC', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_r1'] }))},
    '[]',
    NULL,
    NULL,
    50,
    0,
    0,
    1,
    ${now - 3 * oneDay},
    ${now}
  );
`);

// -------------------------------------------------------------
// EXAM 4: PAST & RESULTS PUBLISHED (With Submissions & Grades)
// -------------------------------------------------------------
const examPastId = 'EXAM_CSE276_PAST_DIAGNOSTIC';
statements.push(`
  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    ${esc(examPastId)},
    ${esc(classCS276)},
    'Diagnostic Assessment: C Memory Architecture & Pointer Arithmetic',
    'Initial diagnostic evaluation measuring prerequisite competency in raw pointers, dynamic memory allocation, and struct memory alignment.',
    30,
    ${now - 72 * oneHour},
    ${now - 70 * oneHour},
    50,
    25,
    1,
    'level_1_standard',
    'results_published',
    0,
    0,
    1,
    '[]',
    ${esc(teacherShivam1)},
    ${now - 5 * oneDay},
    ${now}
  );
`);

// Questions for Past Exam
statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_past_1',
    ${esc(examPastId)},
    NULL,
    'mcq_single',
    'If int* p = (int*)0x1000 on a 64-bit architecture where sizeof(int) is 4 bytes, what memory address does the expression (p + 3) evaluate to?',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_pa1', text: '0x100C', isCorrect: true },
      { id: 'opt_pa2', text: '0x1003', isCorrect: false },
      { id: 'opt_pa3', text: '0x1018', isCorrect: false },
      { id: 'opt_pa4', text: '0x1004', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_pa1'] }))},
    '[]',
    NULL,
    NULL,
    20,
    0,
    0,
    1,
    ${now - 5 * oneDay},
    ${now}
  );
`);

statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_past_2',
    ${esc(examPastId)},
    NULL,
    'numerical',
    'Consider a C struct defined as: struct Data { char a; int b; short c; }; On an LP64 system with natural alignment rules, what is sizeof(struct Data) in bytes?',
    NULL,
    '[]',
    ${esc(JSON.stringify({ numericalAnswer: 12 }))},
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    2,
    ${now - 5 * oneDay},
    ${now}
  );
`);

statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_past_3',
    ${esc(examPastId)},
    NULL,
    'mcq_multiple',
    'Which of the following scenarios in C result in undefined behavior or memory leaks? (Select all that apply)',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_u1', text: 'Dereferencing a pointer after calling free() on it', isCorrect: true },
      { id: 'opt_u2', text: 'Overwriting a dynamically allocated pointer without freeing prior memory', isCorrect: true },
      { id: 'opt_u3', text: 'Passing NULL to free()', isCorrect: false },
      { id: 'opt_u4', text: 'Calling malloc(0)', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_u1', 'opt_u2'] }))},
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    3,
    ${now - 5 * oneDay},
    ${now}
  );
`);

// Submissions for Past Exam:
// 1. Sophia Patel (Score: 50/50 - 100% Passed)
const sessSophia = 'sess_past_sophia';
statements.push(`
  INSERT OR REPLACE INTO exam_sessions (
    id, exam_id, user_id, attempt_number, status, started_at, expires_at,
    submitted_at, auto_score, manual_score, final_score, is_published,
    teacher_feedback, created_at, updated_at
  ) VALUES (
    ${esc(sessSophia)}, ${esc(examPastId)}, ${esc(studentSophia)}, 1,
    'submitted', ${now - 72 * oneHour}, ${now - 71 * oneHour + 30 * oneMinute},
    ${now - 71 * oneHour + 38 * oneMinute}, 50, 0, 50, 1,
    'Outstanding work. Flawless understanding of natural struct alignment and pointer increments.',
    ${now - 72 * oneHour}, ${now - 70 * oneHour}
  );
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_sophia_q1', ${esc(sessSophia)}, 'q_past_1', ${esc(JSON.stringify({ selectedOptions: ['opt_pa1'] }))}, 20, 'graded', 'Correct address calculation', 0, ${now - 71 * oneHour});
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_sophia_q2', ${esc(sessSophia)}, 'q_past_2', ${esc(JSON.stringify({ numericalAnswer: 12 }))}, 15, 'graded', 'Correct alignment padding computed', 0, ${now - 71 * oneHour});
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_sophia_q3', ${esc(sessSophia)}, 'q_past_3', ${esc(JSON.stringify({ selectedOptions: ['opt_u1', 'opt_u2'] }))}, 15, 'graded', 'Correct UB and leak triggers identified', 0, ${now - 71 * oneHour});
`);

// 2. Marcus Vance (Score: 35/50 - 70% Passed)
const sessMarcus = 'sess_past_marcus';
statements.push(`
  INSERT OR REPLACE INTO exam_sessions (
    id, exam_id, user_id, attempt_number, status, started_at, expires_at,
    submitted_at, auto_score, manual_score, final_score, is_published,
    teacher_feedback, created_at, updated_at
  ) VALUES (
    ${esc(sessMarcus)}, ${esc(examPastId)}, ${esc(studentMarcus)}, 1,
    'submitted', ${now - 72 * oneHour}, ${now - 71 * oneHour + 30 * oneMinute},
    ${now - 71 * oneHour + 35 * oneMinute}, 35, 0, 35, 1,
    'Good work overall. Review struct padding on 64-bit boundaries.',
    ${now - 72 * oneHour}, ${now - 70 * oneHour}
  );
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_marcus_q1', ${esc(sessMarcus)}, 'q_past_1', ${esc(JSON.stringify({ selectedOptions: ['opt_pa1'] }))}, 20, 'graded', 'Correct', 0, ${now - 71 * oneHour});
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_marcus_q2', ${esc(sessMarcus)}, 'q_past_2', ${esc(JSON.stringify({ numericalAnswer: 8 }))}, 0, 'graded', 'Incorrect: forgot 2 bytes of tail padding', 0, ${now - 71 * oneHour});
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_marcus_q3', ${esc(sessMarcus)}, 'q_past_3', ${esc(JSON.stringify({ selectedOptions: ['opt_u1', 'opt_u2'] }))}, 15, 'graded', 'Correct', 0, ${now - 71 * oneHour});
`);

// 3. Elena Rostova (Score: 20/50 - 40% Failed)
const sessElena = 'sess_past_elena';
statements.push(`
  INSERT OR REPLACE INTO exam_sessions (
    id, exam_id, user_id, attempt_number, status, started_at, expires_at,
    submitted_at, auto_score, manual_score, final_score, is_published,
    teacher_feedback, created_at, updated_at
  ) VALUES (
    ${esc(sessElena)}, ${esc(examPastId)}, ${esc(studentElena)}, 1,
    'submitted', ${now - 72 * oneHour}, ${now - 71 * oneHour + 30 * oneMinute},
    ${now - 71 * oneHour + 31 * oneMinute}, 20, 0, 20, 1,
    'Needs revision on pointer scaling and struct layout.',
    ${now - 72 * oneHour}, ${now - 70 * oneHour}
  );
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_elena_q1', ${esc(sessElena)}, 'q_past_1', ${esc(JSON.stringify({ selectedOptions: ['opt_pa1'] }))}, 20, 'graded', 'Correct', 0, ${now - 71 * oneHour});
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_elena_q2', ${esc(sessElena)}, 'q_past_2', ${esc(JSON.stringify({ numericalAnswer: 7 }))}, 0, 'graded', 'Incorrect: packed sizes are not natural alignment', 0, ${now - 71 * oneHour});
`);
statements.push(`
  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_elena_q3', ${esc(sessElena)}, 'q_past_3', ${esc(JSON.stringify({ selectedOptions: ['opt_u1'] }))}, 0, 'graded', 'Partial selection: missing memory overwrite leak', 0, ${now - 71 * oneHour});
`);

// -------------------------------------------------------------
// 5. REUSABLE QUESTION BANK (Populate question_bank table)
// -------------------------------------------------------------
const qbItems = [
  {
    id: 'qb_cs_01',
    subject: 'Systems Programming',
    topic: 'Concurrency',
    difficulty: 'medium',
    type: 'mcq_single',
    prompt: 'Which synchronization primitive provides a solution to the Priority Inversion problem in real-time operating systems?',
    options: [
      { text: 'Priority Ceiling Protocol (PCP) / Priority Inheritance', isCorrect: true },
      { text: 'Spinlocks with backoff', isCorrect: false },
      { text: 'Binary semaphores', isCorrect: false },
      { text: 'Read-Copy-Update (RCU)', isCorrect: false },
    ],
    points: 10,
    tags: ['concurrency', 'rtos', 'synchronization'],
  },
  {
    id: 'qb_cs_02',
    subject: 'Systems Programming',
    topic: 'Memory Management',
    difficulty: 'hard',
    type: 'mcq_multiple',
    prompt: 'Which of the following memory allocator strategies help mitigate external fragmentation? (Select all that apply)',
    options: [
      { text: 'Buddy memory allocation system', isCorrect: true },
      { text: 'Slab allocation for uniform objects', isCorrect: true },
      { text: 'First-fit without compaction', isCorrect: false },
      { text: 'Segmented paging with demand loading', isCorrect: false },
    ],
    points: 15,
    tags: ['memory', 'allocator', 'operating-systems'],
  },
  {
    id: 'qb_cs_03',
    subject: 'Algorithms & Data Structures',
    topic: 'Trees',
    difficulty: 'easy',
    type: 'mcq_single',
    prompt: 'In a balanced Red-Black Tree with N nodes, what is the strict upper bound on tree height in terms of black-height hb(root)?',
    options: [
      { text: 'Height <= 2 * log2(N + 1)', isCorrect: true },
      { text: 'Height <= log2(N)', isCorrect: false },
      { text: 'Height <= N / 2', isCorrect: false },
      { text: 'Height <= 1.44 * log2(N)', isCorrect: false },
    ],
    points: 5,
    tags: ['dsa', 'trees', 'complexity'],
  },
  {
    id: 'qb_cs_04',
    subject: 'Computer Systems',
    topic: 'Networking',
    difficulty: 'medium',
    type: 'numerical',
    prompt: 'If a TCP connection experiences a Round Trip Time (RTT) of 50 milliseconds and the receiver window size (rwnd) is 64 KiB (65,536 bytes), what is the maximum theoretical throughput in Mbps? (Enter value rounded to one decimal place)',
    options: [],
    correctAnswer: { numericalAnswer: 10.5 },
    tolerance: 0.2,
    points: 10,
    tags: ['networking', 'tcp', 'throughput'],
  },
];

for (const q of qbItems) {
  statements.push(`
    INSERT OR REPLACE INTO question_bank (
      id, teacher_id, classroom_id, subject, topic, difficulty,
      question_type, prompt_text, prompt_media_url, options_json,
      correct_answer_json, test_cases_json, initial_code, language,
      default_points, negative_marks, numerical_tolerance, tags_json,
      is_archived, created_at, updated_at
    ) VALUES (
      ${esc(q.id)},
      ${esc(teacherShivam1)},
      ${esc(classCS276)},
      ${esc(q.subject)},
      ${esc(q.topic)},
      ${esc(q.difficulty)},
      ${esc(q.type)},
      ${esc(q.prompt)},
      NULL,
      ${esc(JSON.stringify(q.options))},
      ${esc(JSON.stringify(q.correctAnswer || {}))},
      '[]',
      NULL,
      NULL,
      ${q.points},
      0,
      ${q.tolerance || 0},
      ${esc(JSON.stringify(q.tags))},
      0,
      ${now - 5 * oneDay},
      ${now}
    );
  `);
}

const outSql = statements.join('\n');
const outPath = path.resolve(process.cwd(), 'scripts', 'seed-production-exam-demo.sql');
fs.writeFileSync(outPath, outSql, 'utf8');

console.log(`Generated ${statements.length} SQL statements in ${outPath}`);
