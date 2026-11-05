
  INSERT OR IGNORE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
  VALUES ('mem_cs276_shivamtest', 'CLS_1792819623330_ZF01', 'usr_muqri29zhy2cf', 'shivamtest', 'shivampatilc@gmail.com', 'student', 'active', 1793294519582, 1793467319582, 1);


  INSERT OR IGNORE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
  VALUES ('mem_cs276_shivaminco', 'CLS_1792819623330_ZF01', 'user_iz15ru6', 'shivam inco', 'shivam.inco@student.cortex.edu', 'student', 'active', 1793294519582, 1793467319582, 1);


  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    'EXAM_CSE276_ACTIVE_MIDTERM',
    'CLS_1792819623330_ZF01',
    'Midterm Exam: Multithreading, Memory Models & Lock-Free Structures',
    'Official midterm examination covering thread synchronization, memory consistency models, lock-free queues, and concurrent data structure design in C/C++. Live proctoring and integrity telemetry active.',
    60,
    1793466119582,
    1793481719582,
    100,
    40,
    2,
    'restricted',
    'active',
    0,
    1,
    1,
    '[]',
    'usr_mubernpn8x1dc',
    1793294519582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
  VALUES ('sec_mid_1', 'EXAM_CSE276_ACTIVE_MIDTERM', 'Part A: Memory Models & Cache Coherency', 'Fundamental theoretical concepts', 'Answer all single and multi-select questions. 10 minutes allocated.', 1, 10, 1, 30);


  INSERT OR REPLACE INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
  VALUES ('sec_mid_2', 'EXAM_CSE276_ACTIVE_MIDTERM', 'Part B: Synchronization & Little’s Law', 'Calculations and deadlock mechanisms', 'Numerical answers must be accurate to within 0.05 tolerance.', 1, 15, 2, 30);


  INSERT OR REPLACE INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
  VALUES ('sec_mid_3', 'EXAM_CSE276_ACTIVE_MIDTERM', 'Part C: Concurrent Systems Implementation', 'Hands-on concurrent programming', 'Implement thread-safe operations in C++ using atomic primitives.', 1, 35, 3, 40);


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_1',
    'EXAM_CSE276_ACTIVE_MIDTERM',
    'sec_mid_1',
    'mcq_single',
    'Under the MESI cache coherency protocol, which state indicates that a cache line is valid, dirty (modified with respect to main memory), and present only in the current core cache?',
    NULL,
    '[{"id":"opt_m1","text":"Modified (M)","isCorrect":true},{"id":"opt_m2","text":"Exclusive (E)","isCorrect":false},{"id":"opt_m3","text":"Shared (S)","isCorrect":false},{"id":"opt_m4","text":"Invalid (I)","isCorrect":false}]',
    '{"selectedOptions":["opt_m1"]}',
    '[]',
    NULL,
    NULL,
    10,
    0,
    0,
    1,
    1793294519582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_2',
    'EXAM_CSE276_ACTIVE_MIDTERM',
    'sec_mid_1',
    'mcq_multiple',
    'Which of the following are hazards inherent to lock-free concurrent data structures that require safe memory reclamation techniques like hazard pointers or RCU? (Select all that apply)',
    NULL,
    '[{"id":"opt_h1","text":"ABA Problem","isCorrect":true},{"id":"opt_h2","text":"Premature node deallocation (Use-After-Free)","isCorrect":true},{"id":"opt_h3","text":"Priority Inversion","isCorrect":false},{"id":"opt_h4","text":"Cache line false sharing","isCorrect":false}]',
    '{"selectedOptions":["opt_h1","opt_h2"]}',
    '[]',
    NULL,
    NULL,
    20,
    2,
    0,
    2,
    1793294519582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_3',
    'EXAM_CSE276_ACTIVE_MIDTERM',
    'sec_mid_2',
    'numerical',
    'According to Amdahl''s Law, if 75% of an algorithm can be perfectly parallelized (P = 0.75), what is the theoretical maximum speedup limit S as the number of parallel cores approaches infinity (N -> inf)?',
    NULL,
    '[]',
    '{"numericalAnswer":4}',
    '[]',
    NULL,
    NULL,
    15,
    0,
    0.05,
    3,
    1793294519582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_4',
    'EXAM_CSE276_ACTIVE_MIDTERM',
    'sec_mid_2',
    'subjective',
    'List the four Coffman conditions necessary for deadlock to manifest in a concurrent system, and explain how establishing a global lock hierarchy eliminates Circular Wait.',
    NULL,
    '[]',
    '{"idealAnswer":"The four Coffman conditions are: 1. Mutual Exclusion, 2. Hold and Wait, 3. No Preemption, 4. Circular Wait. Establishing a strict total lock ordering ensures that threads always acquire locks in monotonically increasing numerical order, preventing cyclical wait chains."}',
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    4,
    1793294519582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_mid_5',
    'EXAM_CSE276_ACTIVE_MIDTERM',
    'sec_mid_3',
    'coding',
    'Implement a lock-free thread-safe counter in C++ using std::atomic<int>. Fill in the SafeCounter methods increment(), decrement(), and get() ensuring atomic correctness without mutexes.',
    NULL,
    '[]',
    '{"language":"cpp"}',
    '[{"id":"tc1","input":"","expectedOutput":"2\\n","isHidden":false,"points":20},{"id":"tc2","input":"","expectedOutput":"2\\n","isHidden":true,"points":20}]',
    '#include <iostream>
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
}',
    'cpp',
    40,
    0,
    0,
    5,
    1793294519582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_sessions (
    id, exam_id, user_id, attempt_number, status, started_at, expires_at,
    submitted_at, auto_score, manual_score, final_score, is_published,
    teacher_feedback, created_at, updated_at, last_heartbeat_at, current_section_id
  ) VALUES (
    'sess_live_alex_midterm',
    'EXAM_CSE276_ACTIVE_MIDTERM',
    'usr_demo_alex',
    1,
    'in_progress',
    1793466419582,
    1793470019582,
    NULL,
    10,
    NULL,
    NULL,
    0,
    '',
    1793466419582,
    1793467314582,
    1793467314582,
    'sec_mid_2'
  );


  INSERT OR REPLACE INTO exam_question_responses (
    id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at
  ) VALUES (
    'resp_alex_q1',
    'sess_live_alex_midterm',
    'q_mid_1',
    '{"selectedOptions":["opt_m1"]}',
    10,
    'graded',
    'Correct MESI state identified',
    0,
    1793466599582
  );


  INSERT OR REPLACE INTO exam_question_responses (
    id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at
  ) VALUES (
    'resp_alex_q3',
    'sess_live_alex_midterm',
    'q_mid_3',
    '{"numericalAnswer":4}',
    15,
    'graded',
    'Accurate Amdahl calculation',
    0,
    1793466839582
  );


  INSERT OR REPLACE INTO exam_integrity_events (id, session_id, event_type, timestamp, details_json)
  VALUES ('int_alex_1', 'sess_live_alex_midterm', 'focus_lost', 1793466719582, '{"reason":"window_blur","durationMs":2400}');


  INSERT OR REPLACE INTO exam_integrity_events (id, session_id, event_type, timestamp, details_json)
  VALUES ('int_alex_2', 'sess_live_alex_midterm', 'fullscreen_exit', 1793466959582, '{"windowWidth":1920,"windowHeight":1080}');


  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    'EXAM_CSE276_DRAFT_IPC',
    'CLS_1792819623330_ZF01',
    'Quiz 4: POSIX Signals, Pipes & Inter-Process Communication',
    'Asynchronous in-class evaluation covering Unix signals, asynchronous signal safety, pipe buffers, and shared memory segments. Authoring currently in progress.',
    25,
    1793553719582,
    1793560919582,
    30,
    15,
    1,
    'level_1_standard',
    'draft',
    0,
    1,
    1,
    '[]',
    'usr_mubernpn8x1dc',
    1793380919582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_draft_1',
    'EXAM_CSE276_DRAFT_IPC',
    NULL,
    'mcq_single',
    'Which POSIX signal CANNOT be caught, blocked, or ignored by any user-space process under standard kernel semantics?',
    NULL,
    '[{"id":"opt_d1","text":"SIGKILL (9)","isCorrect":true},{"id":"opt_d2","text":"SIGTERM (15)","isCorrect":false},{"id":"opt_d3","text":"SIGINT (2)","isCorrect":false},{"id":"opt_d4","text":"SIGSEGV (11)","isCorrect":false}]',
    '{"selectedOptions":["opt_d1"]}',
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    1,
    1793380919582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_draft_2',
    'EXAM_CSE276_DRAFT_IPC',
    NULL,
    'mcq_single',
    'When creating a unidirectional pipe using pipe(int pipefd[2]) in C, which descriptor index is designated as the read end?',
    NULL,
    '[{"id":"opt_p1","text":"pipefd[0]","isCorrect":true},{"id":"opt_p2","text":"pipefd[1]","isCorrect":false},{"id":"opt_p3","text":"pipefd[2]","isCorrect":false},{"id":"opt_p4","text":"Arbitrary index decided at runtime","isCorrect":false}]',
    '{"selectedOptions":["opt_p1"]}',
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    2,
    1793380919582,
    1793467319582
  );


  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at,
    seb_config_key, seb_quit_password, seb_quit_password_hash, seb_allow_reload, seb_show_reload_warning
  ) VALUES (
    'EXAM_CSE276_SCHEDULED_FINAL',
    'CLS_1792819623330_ZF01',
    'Final Comprehensive Examination: Distributed Consensus & Fault Tolerance',
    'End-of-term proctored final assessment. Covers Raft consensus, Paxos states, Byzantine faults, and vector timestamp ordering. High-stakes assessment requiring Safe Exam Browser (SEB).',
    120,
    1793640119582,
    1793654519582,
    100,
    50,
    1,
    'seb',
    'scheduled',
    1,
    1,
    0,
    '[]',
    'usr_mubernpn8x1dc',
    1793208119582,
    1793467319582,
    'e7c2f89312b94a8d01f56e39bc27184a7e9301824b5c6d7e8f90a1b2c3d4e5f6',
    'CortexFinal2026!',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    0,
    1
  );


  INSERT OR REPLACE INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
  VALUES ('sec_sched_1', 'EXAM_CSE276_SCHEDULED_FINAL', 'Section 1: Raft & Leader Election', 'Consensus RPCs and state transitions', 'Solve all questions in order.', 1, 60, 1, 50);


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_sched_1',
    'EXAM_CSE276_SCHEDULED_FINAL',
    'sec_sched_1',
    'mcq_single',
    'In the Raft consensus algorithm, what RPC message does a candidate broadcast to all peer nodes during a leader election term?',
    NULL,
    '[{"id":"opt_r1","text":"RequestVote RPC","isCorrect":true},{"id":"opt_r2","text":"AppendEntries RPC","isCorrect":false},{"id":"opt_r3","text":"HeartbeatSync RPC","isCorrect":false},{"id":"opt_r4","text":"CommitIndex RPC","isCorrect":false}]',
    '{"selectedOptions":["opt_r1"]}',
    '[]',
    NULL,
    NULL,
    50,
    0,
    0,
    1,
    1793208119582,
    1793467319582
  );


  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    'EXAM_CSE276_PAST_DIAGNOSTIC',
    'CLS_1792819623330_ZF01',
    'Diagnostic Assessment: C Memory Architecture & Pointer Arithmetic',
    'Initial diagnostic evaluation measuring prerequisite competency in raw pointers, dynamic memory allocation, and struct memory alignment.',
    30,
    1793208119582,
    1793215319582,
    50,
    25,
    1,
    'level_1_standard',
    'results_published',
    0,
    0,
    1,
    '[]',
    'usr_mubernpn8x1dc',
    1793035319582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_past_1',
    'EXAM_CSE276_PAST_DIAGNOSTIC',
    NULL,
    'mcq_single',
    'If int* p = (int*)0x1000 on a 64-bit architecture where sizeof(int) is 4 bytes, what memory address does the expression (p + 3) evaluate to?',
    NULL,
    '[{"id":"opt_pa1","text":"0x100C","isCorrect":true},{"id":"opt_pa2","text":"0x1003","isCorrect":false},{"id":"opt_pa3","text":"0x1018","isCorrect":false},{"id":"opt_pa4","text":"0x1004","isCorrect":false}]',
    '{"selectedOptions":["opt_pa1"]}',
    '[]',
    NULL,
    NULL,
    20,
    0,
    0,
    1,
    1793035319582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_past_2',
    'EXAM_CSE276_PAST_DIAGNOSTIC',
    NULL,
    'numerical',
    'Consider a C struct defined as: struct Data { char a; int b; short c; }; On an LP64 system with natural alignment rules, what is sizeof(struct Data) in bytes?',
    NULL,
    '[]',
    '{"numericalAnswer":12}',
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    2,
    1793035319582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_past_3',
    'EXAM_CSE276_PAST_DIAGNOSTIC',
    NULL,
    'mcq_multiple',
    'Which of the following scenarios in C result in undefined behavior or memory leaks? (Select all that apply)',
    NULL,
    '[{"id":"opt_u1","text":"Dereferencing a pointer after calling free() on it","isCorrect":true},{"id":"opt_u2","text":"Overwriting a dynamically allocated pointer without freeing prior memory","isCorrect":true},{"id":"opt_u3","text":"Passing NULL to free()","isCorrect":false},{"id":"opt_u4","text":"Calling malloc(0)","isCorrect":false}]',
    '{"selectedOptions":["opt_u1","opt_u2"]}',
    '[]',
    NULL,
    NULL,
    15,
    0,
    0,
    3,
    1793035319582,
    1793467319582
  );


  INSERT OR REPLACE INTO exam_sessions (
    id, exam_id, user_id, attempt_number, status, started_at, expires_at,
    submitted_at, auto_score, manual_score, final_score, is_published,
    teacher_feedback, created_at, updated_at
  ) VALUES (
    'sess_past_sophia', 'EXAM_CSE276_PAST_DIAGNOSTIC', 'usr_demo_sophia', 1,
    'submitted', 1793208119582, 1793213519582,
    1793213999582, 50, 0, 50, 1,
    'Outstanding work. Flawless understanding of natural struct alignment and pointer increments.',
    1793208119582, 1793215319582
  );


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_sophia_q1', 'sess_past_sophia', 'q_past_1', '{"selectedOptions":["opt_pa1"]}', 20, 'graded', 'Correct address calculation', 0, 1793211719582);


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_sophia_q2', 'sess_past_sophia', 'q_past_2', '{"numericalAnswer":12}', 15, 'graded', 'Correct alignment padding computed', 0, 1793211719582);


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_sophia_q3', 'sess_past_sophia', 'q_past_3', '{"selectedOptions":["opt_u1","opt_u2"]}', 15, 'graded', 'Correct UB and leak triggers identified', 0, 1793211719582);


  INSERT OR REPLACE INTO exam_sessions (
    id, exam_id, user_id, attempt_number, status, started_at, expires_at,
    submitted_at, auto_score, manual_score, final_score, is_published,
    teacher_feedback, created_at, updated_at
  ) VALUES (
    'sess_past_marcus', 'EXAM_CSE276_PAST_DIAGNOSTIC', 'usr_demo_marcus', 1,
    'submitted', 1793208119582, 1793213519582,
    1793213819582, 35, 0, 35, 1,
    'Good work overall. Review struct padding on 64-bit boundaries.',
    1793208119582, 1793215319582
  );


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_marcus_q1', 'sess_past_marcus', 'q_past_1', '{"selectedOptions":["opt_pa1"]}', 20, 'graded', 'Correct', 0, 1793211719582);


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_marcus_q2', 'sess_past_marcus', 'q_past_2', '{"numericalAnswer":8}', 0, 'graded', 'Incorrect: forgot 2 bytes of tail padding', 0, 1793211719582);


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_marcus_q3', 'sess_past_marcus', 'q_past_3', '{"selectedOptions":["opt_u1","opt_u2"]}', 15, 'graded', 'Correct', 0, 1793211719582);


  INSERT OR REPLACE INTO exam_sessions (
    id, exam_id, user_id, attempt_number, status, started_at, expires_at,
    submitted_at, auto_score, manual_score, final_score, is_published,
    teacher_feedback, created_at, updated_at
  ) VALUES (
    'sess_past_elena', 'EXAM_CSE276_PAST_DIAGNOSTIC', 'usr_demo_elena', 1,
    'submitted', 1793208119582, 1793213519582,
    1793213579582, 20, 0, 20, 1,
    'Needs revision on pointer scaling and struct layout.',
    1793208119582, 1793215319582
  );


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_elena_q1', 'sess_past_elena', 'q_past_1', '{"selectedOptions":["opt_pa1"]}', 20, 'graded', 'Correct', 0, 1793211719582);


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_elena_q2', 'sess_past_elena', 'q_past_2', '{"numericalAnswer":7}', 0, 'graded', 'Incorrect: packed sizes are not natural alignment', 0, 1793211719582);


  INSERT OR REPLACE INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, grader_notes, flagged_for_review, updated_at)
  VALUES ('resp_elena_q3', 'sess_past_elena', 'q_past_3', '{"selectedOptions":["opt_u1"]}', 0, 'graded', 'Partial selection: missing memory overwrite leak', 0, 1793211719582);


    INSERT OR REPLACE INTO question_bank (
      id, teacher_id, classroom_id, subject, topic, difficulty,
      question_type, prompt_text, prompt_media_url, options_json,
      correct_answer_json, test_cases_json, initial_code, language,
      default_points, negative_marks, numerical_tolerance, tags_json,
      is_archived, created_at, updated_at
    ) VALUES (
      'qb_cs_01',
      'usr_mubernpn8x1dc',
      'CLS_1792819623330_ZF01',
      'Systems Programming',
      'Concurrency',
      'medium',
      'mcq_single',
      'Which synchronization primitive provides a solution to the Priority Inversion problem in real-time operating systems?',
      NULL,
      '[{"text":"Priority Ceiling Protocol (PCP) / Priority Inheritance","isCorrect":true},{"text":"Spinlocks with backoff","isCorrect":false},{"text":"Binary semaphores","isCorrect":false},{"text":"Read-Copy-Update (RCU)","isCorrect":false}]',
      '{}',
      '[]',
      NULL,
      NULL,
      10,
      0,
      0,
      '["concurrency","rtos","synchronization"]',
      0,
      1793035319582,
      1793467319582
    );
  

    INSERT OR REPLACE INTO question_bank (
      id, teacher_id, classroom_id, subject, topic, difficulty,
      question_type, prompt_text, prompt_media_url, options_json,
      correct_answer_json, test_cases_json, initial_code, language,
      default_points, negative_marks, numerical_tolerance, tags_json,
      is_archived, created_at, updated_at
    ) VALUES (
      'qb_cs_02',
      'usr_mubernpn8x1dc',
      'CLS_1792819623330_ZF01',
      'Systems Programming',
      'Memory Management',
      'hard',
      'mcq_multiple',
      'Which of the following memory allocator strategies help mitigate external fragmentation? (Select all that apply)',
      NULL,
      '[{"text":"Buddy memory allocation system","isCorrect":true},{"text":"Slab allocation for uniform objects","isCorrect":true},{"text":"First-fit without compaction","isCorrect":false},{"text":"Segmented paging with demand loading","isCorrect":false}]',
      '{}',
      '[]',
      NULL,
      NULL,
      15,
      0,
      0,
      '["memory","allocator","operating-systems"]',
      0,
      1793035319582,
      1793467319582
    );
  

    INSERT OR REPLACE INTO question_bank (
      id, teacher_id, classroom_id, subject, topic, difficulty,
      question_type, prompt_text, prompt_media_url, options_json,
      correct_answer_json, test_cases_json, initial_code, language,
      default_points, negative_marks, numerical_tolerance, tags_json,
      is_archived, created_at, updated_at
    ) VALUES (
      'qb_cs_03',
      'usr_mubernpn8x1dc',
      'CLS_1792819623330_ZF01',
      'Algorithms & Data Structures',
      'Trees',
      'easy',
      'mcq_single',
      'In a balanced Red-Black Tree with N nodes, what is the strict upper bound on tree height in terms of black-height hb(root)?',
      NULL,
      '[{"text":"Height <= 2 * log2(N + 1)","isCorrect":true},{"text":"Height <= log2(N)","isCorrect":false},{"text":"Height <= N / 2","isCorrect":false},{"text":"Height <= 1.44 * log2(N)","isCorrect":false}]',
      '{}',
      '[]',
      NULL,
      NULL,
      5,
      0,
      0,
      '["dsa","trees","complexity"]',
      0,
      1793035319582,
      1793467319582
    );
  

    INSERT OR REPLACE INTO question_bank (
      id, teacher_id, classroom_id, subject, topic, difficulty,
      question_type, prompt_text, prompt_media_url, options_json,
      correct_answer_json, test_cases_json, initial_code, language,
      default_points, negative_marks, numerical_tolerance, tags_json,
      is_archived, created_at, updated_at
    ) VALUES (
      'qb_cs_04',
      'usr_mubernpn8x1dc',
      'CLS_1792819623330_ZF01',
      'Computer Systems',
      'Networking',
      'medium',
      'numerical',
      'If a TCP connection experiences a Round Trip Time (RTT) of 50 milliseconds and the receiver window size (rwnd) is 64 KiB (65,536 bytes), what is the maximum theoretical throughput in Mbps? (Enter value rounded to one decimal place)',
      NULL,
      '[]',
      '{"numericalAnswer":10.5}',
      '[]',
      NULL,
      NULL,
      10,
      0,
      0.2,
      '["networking","tcp","throughput"]',
      0,
      1793035319582,
      1793467319582
    );
  