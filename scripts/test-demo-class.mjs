const PROD_URL = 'https://cortex-code-platform.cortexbuild1.workers.dev';
const SESSION_ID = 'e01fd32d0e16b388289969fe9f78a615ba167e818e7ace532b08c7c651853e1b';

const headers = {
  'Cookie': `cortex_session=${SESSION_ID}`,
  'Content-Type': 'application/json',
};

async function runTests() {
  console.log('Testing demo classroom endpoints with authenticated teacher session on:', PROD_URL);
  let failed = 0;

  // 1. Verify Authentication
  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/me`, { headers });
    const data = await res.json();
    if (res.ok && data.user && data.user.id === 'usr_mvlwemxk12ink') {
      console.log('Teacher Auth Verification: PASS - Logged in as:', data.user.name, `(${data.user.role})`);
    } else {
      console.error('Teacher Auth Verification: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Teacher Auth Verification: ERROR -', e.message);
    failed++;
  }

  // 2. Test Classroom Details
  try {
    const res = await fetch(`${PROD_URL}/api/v1/classrooms/CLS_DEMO_DSA_2026`, { headers });
    const data = await res.json();
    if (res.ok && data.classroom && data.classroom.name.includes('CS 201')) {
      console.log('Classroom Details: PASS -', data.classroom.name, `[Join Code: ${data.classroom.joincode || data.classroom.join_code}]`);
    } else {
      console.error('Classroom Details: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Classroom Details: ERROR -', e.message);
    failed++;
  }

  // 3. Test Members Roster
  try {
    const res = await fetch(`${PROD_URL}/api/v1/classrooms/CLS_DEMO_DSA_2026/members`, { headers });
    const data = await res.json();
    if (res.ok && Array.isArray(data.members) && data.members.length >= 5) {
      console.log('Student Roster: PASS -', data.members.length, 'total members:');
      data.members.forEach(m => console.log(`  - ${m.userName || m.user_name} (${m.role}) - ${m.userEmail || m.user_email}`));
    } else {
      console.error('Student Roster: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Student Roster: ERROR -', e.message);
    failed++;
  }

  // 4. Test Announcements
  try {
    const res = await fetch(`${PROD_URL}/api/v1/classrooms/CLS_DEMO_DSA_2026/announcements`, { headers });
    const data = await res.json();
    if (res.ok && Array.isArray(data.announcements) && data.announcements.length >= 2) {
      console.log('Announcements: PASS -', data.announcements.length, 'announcements loaded');
    } else {
      console.error('Announcements: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Announcements: ERROR -', e.message);
    failed++;
  }

  // 5. Test Assignments & Hidden/Public Test Cases
  try {
    const res = await fetch(`${PROD_URL}/api/v1/classrooms/CLS_DEMO_DSA_2026/assignments`, { headers });
    const data = await res.json();
    if (res.ok && Array.isArray(data.assignments) && data.assignments.length >= 3) {
      console.log('Assignments & Test Cases: PASS -', data.assignments.length, 'assignments:');
      data.assignments.forEach(a => {
        const tests = a.testCases || a.test_cases || [];
        const hiddenCount = tests.filter(t => t.isHidden || t.is_hidden).length;
        const publicCount = tests.length - hiddenCount;
        console.log(`  - [${a.language}] ${a.title} -> ${publicCount} Public, ${hiddenCount} Hidden test cases`);
      });
    } else {
      console.error('Assignments: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Assignments: ERROR -', e.message);
    failed++;
  }

  // 6. Test Submissions
  try {
    const res = await fetch(`${PROD_URL}/api/v1/classrooms/CLS_DEMO_DSA_2026/submissions`, { headers });
    const data = await res.json();
    if (res.ok && Array.isArray(data.submissions) && data.submissions.length >= 2) {
      console.log('Submissions: PASS -', data.submissions.length, 'submissions:');
      data.submissions.forEach(s => {
        console.log(`  - ${s.studentName || s.student_name}: ${s.score}/${s.maxScore || s.max_score} (${s.status}) on ${s.assignmentTitle || s.assignment_title}`);
      });
    } else {
      console.error('Submissions: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Submissions: ERROR -', e.message);
    failed++;
  }

  // 7. Test Gradebook
  try {
    const res = await fetch(`${PROD_URL}/api/v1/classrooms/CLS_DEMO_DSA_2026/grades`, { headers });
    const data = await res.json();
    if (res.ok && Array.isArray(data.rows) && data.rows.length >= 5) {
      console.log('Gradebook & Feedback: PASS -', data.rows.length, 'student rows with assignment scores');
    } else {
      console.error('Gradebook: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Gradebook: ERROR -', e.message);
    failed++;
  }

  // 8. Test Resources
  try {
    const res = await fetch(`${PROD_URL}/api/v1/classrooms/CLS_DEMO_DSA_2026/resources`, { headers });
    const data = await res.json();
    if (res.ok && Array.isArray(data.resources) && data.resources.length >= 2) {
      console.log('Resources: PASS -', data.resources.length, 'resources available');
    } else {
      console.error('Resources: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Resources: ERROR -', e.message);
    failed++;
  }

  // 9. Test Python Sandbox Execution
  try {
    const res = await fetch(`${PROD_URL}/api/v1/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'print("Python Sandbox Execution: OK")' }]
      })
    });
    const data = await res.json();
    if (res.ok && data.stdout && data.stdout.includes('Python Sandbox Execution: OK')) {
      console.log('Python Sandbox Execution: PASS - output:', data.stdout.trim());
    } else {
      console.error('Python Sandbox Execution: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Python Sandbox Execution: ERROR -', e.message);
    failed++;
  }

  // 10. Test C++ Sandbox Execution
  try {
    const res = await fetch(`${PROD_URL}/api/v1/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'cpp',
        files: [{ id: '1', name: 'main.cpp', path: '/main.cpp', content: '#include <iostream>\nint main() { std::cout << "C++ Sandbox Execution: OK\\n"; return 0; }' }]
      })
    });
    const data = await res.json();
    if (res.ok && data.stdout && data.stdout.includes('C++ Sandbox Execution: OK')) {
      console.log('C++ Sandbox Execution: PASS - output:', data.stdout.trim());
    } else {
      console.error('C++ Sandbox Execution: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('C++ Sandbox Execution: ERROR -', e.message);
    failed++;
  }

  // 11. Test Live Dual-Workspace Arena
  try {
    const res = await fetch(`${PROD_URL}/api/v1/classroom/CORTEX26?requesterId=usr_mvlwemxk12ink&requesterName=shivam&requesterRole=admin`);
    const data = await res.json();
    if (res.ok && data.room) {
      console.log('Live Dual-Workspace Arena: PASS - Room State: active, RoomId:', data.room.roomId);
    } else {
      console.error('Live Dual-Workspace Arena: FAIL -', data);
      failed++;
    }
  } catch (e) {
    console.error('Live Dual-Workspace Arena: ERROR -', e.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Final Result: ${11 - failed}/11 functions verified.`);
  console.log(`========================================`);
}

runTests();
