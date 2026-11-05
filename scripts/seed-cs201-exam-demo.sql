
  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    'EXAM_DSA_ACTIVE_TREES',
    'CLS_DEMO_DSA_2026',
    'Midterm Exam: Trees, Heaps & Graph Algorithms',
    'Comprehensive algorithmic evaluation on Binary Search Trees, AVL balance factors, Dijkstra shortest path, and dynamic programming.',
    45,
    1793466827301,
    1793478227301,
    60,
    30,
    2,
    'restricted',
    'active',
    0,
    1,
    1,
    '[]',
    'usr_mubernpn8x1dc',
    1793294627301,
    1793467427301
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_dsa_1',
    'EXAM_DSA_ACTIVE_TREES',
    NULL,
    'mcq_single',
    'What is the worst-case time complexity of inserting a key into an unbalanced Binary Search Tree with N elements?',
    NULL,
    '[{"id":"opt_dsa_1","text":"O(N)","isCorrect":true},{"id":"opt_dsa_2","text":"O(log N)","isCorrect":false},{"id":"opt_dsa_3","text":"O(1)","isCorrect":false},{"id":"opt_dsa_4","text":"O(N log N)","isCorrect":false}]',
    '{"selectedOptions":["opt_dsa_1"]}',
    '[]',
    NULL,
    NULL,
    20,
    0,
    0,
    1,
    1793294627301,
    1793467427301
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_dsa_2',
    'EXAM_DSA_ACTIVE_TREES',
    NULL,
    'numerical',
    'What is the minimum number of nodes in an AVL tree of height 4 (where a single root node has height 0)?',
    NULL,
    '[]',
    '{"numericalAnswer":12}',
    '[]',
    NULL,
    NULL,
    20,
    0,
    0,
    2,
    1793294627301,
    1793467427301
  );


  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_dsa_3',
    'EXAM_DSA_ACTIVE_TREES',
    NULL,
    'mcq_multiple',
    'Which of the following shortest-path algorithms can correctly handle graphs with negative edge weights as long as there are no negative-weight cycles? (Select all that apply)',
    NULL,
    '[{"id":"opt_sp_1","text":"Bellman-Ford Algorithm","isCorrect":true},{"id":"opt_sp_2","text":"Floyd-Warshall Algorithm","isCorrect":true},{"id":"opt_sp_3","text":"Dijkstra Algorithm with Min-Heap","isCorrect":false},{"id":"opt_sp_4","text":"Breadth-First Search (BFS)","isCorrect":false}]',
    '{"selectedOptions":["opt_sp_1","opt_sp_2"]}',
    '[]',
    NULL,
    NULL,
    20,
    0,
    0,
    3,
    1793294627301,
    1793467427301
  );


  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    'EXAM_DSA_DRAFT_GRAPHS',
    'CLS_DEMO_DSA_2026',
    'Quiz 5: Strongly Connected Components & Tarjan Algorithm',
    'Unpublished draft quiz on directed graph connectivity, DFS discovery/low-link values, and topological sorting.',
    20,
    1793553827301,
    1793561027301,
    20,
    10,
    1,
    'level_1_standard',
    'draft',
    0,
    1,
    1,
    '[]',
    'usr_mubernpn8x1dc',
    1793381027301,
    1793467427301
  );
