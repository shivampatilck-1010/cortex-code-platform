import fs from 'fs';
import path from 'path';
import { classroomDb } from '../src/lib/classroom/db';
import { ClassroomAuth } from '../src/lib/classroom/auth';

async function seedShowcase() {
  console.log('--- Initializing Showcase Demo Dataset ---');
  const db = await classroomDb.getDb();
  if (!db) {
    throw new Error('Failed to acquire database instance.');
  }

  // 1. Read and execute seed-teacher-demo.sql
  const sqlFile = path.resolve(process.cwd(), 'scripts', 'seed-teacher-demo.sql');
  const rawSql = fs.readFileSync(sqlFile, 'utf8');
  const statements = rawSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Executing ${statements.length} SQL statements from seed-teacher-demo.sql...`);
  for (const stmt of statements) {
    await db.exec(stmt);
  }

  // 2. Generate standard deterministic demo hash for password 'Cortex2026!'
  const demoHash = await ClassroomAuth.hashPassword('Cortex2026!');
  console.log('Generated PBKDF2 password hash for Cortex2026!');

  // 3. Update all demo teachers and students to have active status and valid password hashes
  const demoAccounts = [
    { id: 'usr_teacher_stg2', email: 'shivam@cortex.edu', name: 'Professor Shivam', role: 'teacher' },
    { id: 'usr_mvlyg1pd44g4k', email: 'shivampatilcka@gmail.com', name: 'shivam', role: 'teacher' },
    { id: 'usr_demo_alex', email: 'alex.chen@student.cortex.edu', name: 'Alex Chen', role: 'student' },
    { id: 'usr_student_stg2', email: 'alex@student.cortex.edu', name: 'Alex Chen', role: 'student' },
    { id: 'usr_demo_sophia', email: 'sophia.patel@student.cortex.edu', name: 'Sophia Patel', role: 'student' },
    { id: 'usr_demo_marcus', email: 'marcus.vance@student.cortex.edu', name: 'Marcus Vance', role: 'student' },
    { id: 'usr_demo_elena', email: 'elena.rostova@student.cortex.edu', name: 'Elena Rostova', role: 'student' },
    { id: 'usr_demo_liam', email: 'liam.wright@student.cortex.edu', name: 'Liam Wright', role: 'student' },
    { id: 'usr_mvly9ov4snurx', email: 'aniket.agr2007@gmail.com', name: 'Aniket Agarwal', role: 'student' },
    { id: 'usr_e2e_student', email: 'john@cortex.edu', name: 'John Connor', role: 'student' },
    { id: 'usr_e2e_teacher', email: 'sarah@cortex.edu', name: 'Dr. Sarah Connor', role: 'teacher' },
  ];

  const now = Date.now();
  for (const acc of demoAccounts) {
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(acc.email);
    if (existing) {
      await db.prepare('UPDATE users SET password_hash = ?, status = ?, role = ? WHERE email = ?').run(
        demoHash,
        'active',
        acc.role,
        acc.email
      );
    } else {
      await db.prepare(`
        INSERT INTO users (id, name, email, cortex_id, role, status, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).run(
        acc.id,
        acc.name,
        acc.email,
        acc.name.replace(/\s+/g, '_').toUpperCase(),
        acc.role,
        demoHash,
        now - 86400000,
        now
      );
    }
  }

  // 4. Ensure Professor Shivam (shivam@cortex.edu) is explicitly a member & teacher in both demo classes
  const demoClassIds = ['CLS_1792819623330_ZF01', 'CLS_DEMO_DSA_2026'];
  for (const cid of demoClassIds) {
    await db.prepare(`
      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (?, ?, ?, ?, ?, 'teacher', 'active', ?, ?, 1)
    `).run(
      `mem_${cid}_usr_teacher_stg2`,
      cid,
      'usr_teacher_stg2',
      'Professor Shivam',
      'shivam@cortex.edu',
      now - 86400000 * 2,
      now
    );

    await db.prepare(`
      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (?, ?, ?, ?, ?, 'student', 'active', ?, ?, 1)
    `).run(
      `mem_${cid}_usr_student_stg2`,
      cid,
      'usr_student_stg2',
      'Alex Chen',
      'alex@student.cortex.edu',
      now - 86400000 * 2,
      now
    );
  }

  // 5. Seed Assignment for CS 201: Data Structures and Algorithms
  const dsaTestCases = JSON.stringify([
    { input: "two_sum([2, 7, 11, 15], 9)", expectedOutput: "[0, 1]", isHidden: false, points: 50 },
    { input: "two_sum([3, 2, 4], 6)", expectedOutput: "[1, 2]", isHidden: false, points: 25 },
    { input: "two_sum([3, 3], 6)", expectedOutput: "[0, 1]", isHidden: true, points: 25 },
  ]);

  const dsaStarterCode = `def two_sum(nums, target):
    # Complete this function in O(n) time complexity using a hash table
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

if __name__ == '__main__':
    result = two_sum([2, 7, 11, 15], 9)
    print(f"Result: {result}")
`;

  await db.prepare(`
    INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language,
      starter_code, difficulty, max_marks, due_at, published_at,
      attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy,
      status, created_by, created_at, updated_at, test_cases_json
    ) VALUES (
      'asg_dsa_twosum',
      'CLS_DEMO_DSA_2026',
      'Lab 1: Two Sum Hash Map Optimization',
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. Optimize lookup using a hash map.',
      '1. Implement linear time O(n) hash table solution.\n2. Handle duplicate and negative inputs.\n3. Return 0-indexed list.',
      'coding',
      'python',
      ?,
      'easy',
      100,
      ?,
      ?,
      3,
      1,
      10,
      1,
      1,
      'hints_only',
      'review_only',
      'published',
      'usr_teacher_stg2',
      ?,
      ?,
      ?
    )
  `).run(
    dsaStarterCode,
    now + 86400000 * 7,
    now - 86400000,
    now - 86400000,
    now,
    dsaTestCases
  );

  // 6. Seed Sample Submission for DSA Lab 1
  const dsaSubResults = JSON.stringify([
    { id: 1, name: 'Sample Positive Pair', status: 'passed', executionTimeMs: 8 },
    { id: 2, name: 'Duplicate Target Pair', status: 'passed', executionTimeMs: 11 },
    { id: 3, name: 'Hidden Large Array Stress', status: 'passed', executionTimeMs: 24 }
  ]);

  await db.prepare(`
    INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name,
      code, language, version, status, submitted_at, execution_started_at, execution_completed_at,
      score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_dsa_alex_1',
      'asg_dsa_twosum',
      'Lab 1: Two Sum Hash Map Optimization',
      'CLS_DEMO_DSA_2026',
      'usr_student_stg2',
      'Alex Chen',
      ?,
      'python',
      1,
      'completed',
      ?,
      ?,
      ?,
      100,
      100,
      0,
      ?
    )
  `).run(
    dsaStarterCode,
    now - 3600000 * 4,
    now - 3600000 * 4,
    now - 3600000 * 4 + 43,
    dsaSubResults
  );

  await db.prepare(`
    INSERT OR REPLACE INTO grades (
      id, submission_id, student_id, assignment_id,
      automatic_score, manual_adjustment, final_score,
      graded_by, graded_by_name, graded_at
    ) VALUES (
      'grd_dsa_alex_1',
      'sub_dsa_alex_1',
      'usr_student_stg2',
      'asg_dsa_twosum',
      100,
      0,
      100,
      'usr_teacher_stg2',
      'Professor Shivam',
      ?
    )
  `).run(now - 3600000 * 3);

  // 7. Seed Resources for CS 201
  const dsaResources = [
    {
      id: 'res_dsa_syllabus',
      name: 'CS 201 Algorithmic Syllabus & LeetCode RoadMap',
      description: 'Weekly schedule of algorithmic paradigms: Divide & Conquer, Dynamic Programming, Greedy, and Graphs.',
      url: 'https://cortexcode.io/docs/cs201-syllabus.pdf'
    },
    {
      id: 'res_dsa_cheatsheet',
      name: 'Asymptotic Big-O Complexity Quick Reference',
      description: 'Time and space complexity bounds for arrays, linked lists, trees, heaps, and graphs.',
      url: 'https://cortexcode.io/docs/big-o-cheatsheet.pdf'
    }
  ];

  for (const r of dsaResources) {
    await db.prepare(`
      INSERT OR REPLACE INTO resources (
        id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
      ) VALUES (?, 'CLS_DEMO_DSA_2026', 'usr_teacher_stg2', 'Professor Shivam', ?, 'document', ?, ?, 'General', ?, 1, 'public')
    `).run(r.id, r.name, r.url, r.description, now - 86400000);
  }

  // 8. Verification queries
  const cs276 = await db.prepare('SELECT id, name, course_code, join_code FROM classrooms WHERE id = ?').get('CLS_1792819623330_ZF01');
  const dsa = await db.prepare('SELECT id, name, course_code, join_code FROM classrooms WHERE id = ?').get('CLS_DEMO_DSA_2026');
  const asgs = await db.prepare('SELECT COUNT(*) as count FROM assignments WHERE classroom_id IN (?, ?)').get('CLS_1792819623330_ZF01', 'CLS_DEMO_DSA_2026');
  const subs = await db.prepare('SELECT COUNT(*) as count FROM submissions WHERE classroom_id IN (?, ?)').get('CLS_1792819623330_ZF01', 'CLS_DEMO_DSA_2026');

  console.log('--- Showcase Seeding Complete ---');
  console.log('Course 1:', cs276.name, `(${cs276.course_code}) Join Code: ${cs276.join_code}`);
  console.log('Course 2:', dsa.name, `(${dsa.course_code}) Join Code: ${dsa.join_code}`);
  console.log('Total Assignments:', asgs.count);
  console.log('Total Submissions:', subs.count);
  console.log('Demo Credentials: All accounts password = Cortex2026!');
}

seedShowcase().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
