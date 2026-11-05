/**
 * Seed exams for CS 201: Data Structures and Algorithms (CLS_DEMO_DSA_2026)
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
const classCS201 = 'CLS_DEMO_DSA_2026';
const teacherShivam1 = 'usr_mubernpn8x1dc';

// Exam 1: Active in CS 201
const examDsaActive = 'EXAM_DSA_ACTIVE_TREES';
statements.push(`
  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    ${esc(examDsaActive)},
    ${esc(classCS201)},
    'Midterm Exam: Trees, Heaps & Graph Algorithms',
    'Comprehensive algorithmic evaluation on Binary Search Trees, AVL balance factors, Dijkstra shortest path, and dynamic programming.',
    45,
    ${now - 10 * oneMinute},
    ${now + 3 * oneHour},
    60,
    30,
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

statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_dsa_1',
    ${esc(examDsaActive)},
    NULL,
    'mcq_single',
    'What is the worst-case time complexity of inserting a key into an unbalanced Binary Search Tree with N elements?',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_dsa_1', text: 'O(N)', isCorrect: true },
      { id: 'opt_dsa_2', text: 'O(log N)', isCorrect: false },
      { id: 'opt_dsa_3', text: 'O(1)', isCorrect: false },
      { id: 'opt_dsa_4', text: 'O(N log N)', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_dsa_1'] }))},
    '[]',
    NULL,
    NULL,
    20,
    0,
    0,
    1,
    ${now - 2 * oneDay},
    ${now}
  );
`);

statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_dsa_2',
    ${esc(examDsaActive)},
    NULL,
    'numerical',
    'What is the minimum number of nodes in an AVL tree of height 4 (where a single root node has height 0)?',
    NULL,
    '[]',
    ${esc(JSON.stringify({ numericalAnswer: 12 }))},
    '[]',
    NULL,
    NULL,
    20,
    0,
    0,
    2,
    ${now - 2 * oneDay},
    ${now}
  );
`);

statements.push(`
  INSERT OR REPLACE INTO exam_questions (
    id, exam_id, section_id, question_type, prompt_text, prompt_media_url,
    options_json, correct_answer_json, test_cases_json, initial_code, language,
    points, negative_marks, numerical_tolerance, sort_order, created_at, updated_at
  ) VALUES (
    'q_dsa_3',
    ${esc(examDsaActive)},
    NULL,
    'mcq_multiple',
    'Which of the following shortest-path algorithms can correctly handle graphs with negative edge weights as long as there are no negative-weight cycles? (Select all that apply)',
    NULL,
    ${esc(JSON.stringify([
      { id: 'opt_sp_1', text: 'Bellman-Ford Algorithm', isCorrect: true },
      { id: 'opt_sp_2', text: 'Floyd-Warshall Algorithm', isCorrect: true },
      { id: 'opt_sp_3', text: 'Dijkstra Algorithm with Min-Heap', isCorrect: false },
      { id: 'opt_sp_4', text: 'Breadth-First Search (BFS)', isCorrect: false },
    ]))},
    ${esc(JSON.stringify({ selectedOptions: ['opt_sp_1', 'opt_sp_2'] }))},
    '[]',
    NULL,
    NULL,
    20,
    0,
    0,
    3,
    ${now - 2 * oneDay},
    ${now}
  );
`);

// Exam 2: Draft in CS 201
const examDsaDraft = 'EXAM_DSA_DRAFT_GRAPHS';
statements.push(`
  INSERT OR REPLACE INTO exams (
    id, classroom_id, title, description, duration_minutes,
    start_time, end_time, total_marks, passing_marks, attempts_allowed,
    security_level, status, shuffle_questions, shuffle_options,
    show_results_immediately, assigned_student_ids_json, created_by,
    created_at, updated_at
  ) VALUES (
    ${esc(examDsaDraft)},
    ${esc(classCS201)},
    'Quiz 5: Strongly Connected Components & Tarjan Algorithm',
    'Unpublished draft quiz on directed graph connectivity, DFS discovery/low-link values, and topological sorting.',
    20,
    ${now + 24 * oneHour},
    ${now + 26 * oneHour},
    20,
    10,
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

const outSql = statements.join('\n');
const outPath = path.resolve(process.cwd(), 'scripts', 'seed-cs201-exam-demo.sql');
fs.writeFileSync(outPath, outSql, 'utf8');
console.log(`Generated ${statements.length} SQL statements in ${outPath}`);
