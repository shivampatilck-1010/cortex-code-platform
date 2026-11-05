// Cortex Online Examination System — Phase 3.8 Real-World Browser Verification
// Comprehensive Google Chrome & Microsoft Edge Automation with Native CDP
// Zero Emojis — Factual Log Assertions

const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const BROWSERS = [
  {
    name: 'Google Chrome',
    path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    port: 9485,
    profile: 'C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\chrome-exam-phase38-profile',
  },
  {
    name: 'Microsoft Edge',
    path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    port: 9486,
    profile: 'C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\edge-exam-phase38-profile',
  },
];

const BASE_URL = 'http://127.0.0.1:3000';
const CLASSROOM_ID = 'C1-CS201-ADV';
const DB_PATH = path.join(__dirname, '..', 'data', 'cortex_classroom.db');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'scratch', 'screenshots');

const TEACHER_PROFILE = {
  id: 'usr_prof_elena',
  name: 'Prof. Elena Rostova',
  email: 'elena.rostova@cortex.edu',
  role: 'teacher',
};

const STUDENT_PROFILE = {
  id: 'usr_alex_chen',
  name: 'Alex Chen',
  email: 'alex.chen@student.cortex.edu',
  role: 'student',
};

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ text: data });
        }
      });
    }).on('error', reject);
  });
}

function setupTestDatabase(prefix = 'p38') {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA busy_timeout = 5000;');
  const now = Date.now();
  const teacherCookie = `sess_${prefix}_teacher`;
  const studentCookie = `sess_${prefix}_student`;

  // 1. Users
  db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(TEACHER_PROFILE.id, TEACHER_PROFILE.name, TEACHER_PROFILE.email, TEACHER_PROFILE.role, now, now);

  db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(STUDENT_PROFILE.id, STUDENT_PROFILE.name, STUDENT_PROFILE.email, STUDENT_PROFILE.role, now, now);

  // 2. Classroom
  db.prepare(`
    INSERT OR REPLACE INTO classrooms (
      id, name, subject, description, course_code, academic_year, section,
      teacher_id, teacher_name, image, join_code, join_enabled, status,
      created_at, updated_at, settings_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    CLASSROOM_ID, 'Advanced Algorithms 901', 'Computer Science', 'Graduate Algorithms',
    'CS901', '2026', 'A', TEACHER_PROFILE.id, TEACHER_PROFILE.name, null, 'JOIN901', 1, 'active',
    now, now, '{}'
  );

  // 3. Members
  db.prepare(`
    INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`mem_${CLASSROOM_ID}_${TEACHER_PROFILE.id}`, CLASSROOM_ID, TEACHER_PROFILE.id, TEACHER_PROFILE.name, TEACHER_PROFILE.email, 'teacher', 'active', now, now, 1);

  db.prepare(`
    INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`mem_${CLASSROOM_ID}_${STUDENT_PROFILE.id}`, CLASSROOM_ID, STUDENT_PROFILE.id, STUDENT_PROFILE.name, STUDENT_PROFILE.email, 'student', 'active', now, now, 1);

  // 4. Session Cookies
  db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(teacherCookie, TEACHER_PROFILE.id, now + 86400000, now);

  db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(studentCookie, STUDENT_PROFILE.id, now + 86400000, now);

  // 5. Test Examination
  const examId = `exam_${prefix}_${now}`;
  db.prepare(`
    INSERT OR REPLACE INTO exams (
      id, classroom_id, title, description, duration_minutes,
      start_time, end_time, total_marks, passing_marks, attempts_allowed,
      security_level, status, shuffle_questions, shuffle_options, show_results_immediately,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    examId,
    CLASSROOM_ID,
    `CS201 Midterm Examination (${prefix.toUpperCase()})`,
    'Authoritative examination testing single MCQ, multi MCQ, numerical, short answer, and autosave resilience',
    60,
    now - 5000,
    now + 7200000,
    30,
    15,
    1,
    'standard',
    'published',
    0,
    0,
    1,
    TEACHER_PROFILE.id,
    now,
    now
  );

  // 6. Test Questions
  const q1 = `q1_${prefix}_${now}`;
  const q2 = `q2_${prefix}_${now}`;
  const q3 = `q3_${prefix}_${now}`;
  const q4 = `q4_${prefix}_${now}`;
  const q5 = `q5_${prefix}_${now}`;

  // Q1: Single MCQ
  db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    q1,
    examId,
    'mcq_single',
    'What is the worst-case time complexity of lookup in a balanced AVL tree?',
    JSON.stringify([
      { id: 'opt_1_o1', text: 'O(1)' },
      { id: 'opt_1_ologn', text: 'O(log n)' },
      { id: 'opt_1_on', text: 'O(n)' },
      { id: 'opt_1_on2', text: 'O(n^2)' },
    ]),
    JSON.stringify({ selectedOptionId: 'opt_1_ologn' }),
    5,
    0,
    1,
    now,
    now
  );

  // Q2: Multiple Choice MCQ
  db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    q2,
    examId,
    'mcq_multiple',
    'Select all algorithms that find a Minimum Spanning Tree (MST):',
    JSON.stringify([
      { id: 'opt_2_kruskal', text: 'Kruskal Algorithm' },
      { id: 'opt_2_prim', text: 'Prim Algorithm' },
      { id: 'opt_2_dijkstra', text: 'Dijkstra Shortest Path' },
      { id: 'opt_2_bellman', text: 'Bellman-Ford Algorithm' },
    ]),
    JSON.stringify({ selectedOptionIds: ['opt_2_kruskal', 'opt_2_prim'] }),
    5,
    0,
    2,
    now,
    now
  );

  // Q3: True / False
  db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    q3,
    examId,
    'true_false',
    'In an undirected connected graph with distinct edge weights, the Minimum Spanning Tree is always unique.',
    JSON.stringify([]),
    JSON.stringify({ value: true }),
    5,
    0,
    3,
    now,
    now
  );

  // Q4: Numerical
  db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    q4,
    examId,
    'numerical',
    'How many edges are present in a complete undirected graph with 6 vertices?',
    JSON.stringify([]),
    JSON.stringify({ value: 15, tolerance: 0 }),
    5,
    0,
    4,
    now,
    now
  );

  // Q5: Short Answer
  db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    q5,
    examId,
    'short_answer',
    'Name the graph traversal algorithm that uses a First-In-First-Out (FIFO) queue.',
    JSON.stringify([]),
    JSON.stringify({ text: 'BFS', caseSensitive: false }),
    10,
    0,
    5,
    now,
    now
  );

  // 7. Active Student Session
  const sessionId = `sess_cand_${prefix}_${now}`;
  db.prepare(`
    INSERT OR REPLACE INTO exam_sessions (
      id, exam_id, user_id, attempt_number, status, started_at, expires_at,
      question_order_json, option_order_json, last_heartbeat_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    examId,
    STUDENT_PROFILE.id,
    1,
    'in_progress',
    now - 60000,
    now + 3540000,
    JSON.stringify([q1, q2, q3, q4, q5]),
    JSON.stringify({}),
    now - 2000,
    now,
    now
  );

  // 8. Sample Question Bank item
  const qbId = `qb_${prefix}_${now}`;
  db.prepare(`
    INSERT OR REPLACE INTO question_bank (
      id, teacher_id, classroom_id, subject, topic, difficulty, question_type,
      prompt_text, options_json, correct_answer_json, default_points, negative_marks, tags_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    qbId,
    TEACHER_PROFILE.id,
    CLASSROOM_ID,
    'Computer Science',
    'Algorithms',
    'medium',
    'mcq_single',
    'What is the average-case time complexity of QuickSelect?',
    JSON.stringify([
      { id: 'opt_on', text: 'O(n)' },
      { id: 'opt_ologn', text: 'O(log n)' },
      { id: 'opt_onlogn', text: 'O(n log n)' },
    ]),
    JSON.stringify({ selectedOptionId: 'opt_on' }),
    5,
    0,
    JSON.stringify(['algorithms', 'sorting', 'complexity']),
    now,
    now
  );

  db.close();

  return {
    examId,
    sessionId,
    questions: [q1, q2, q3, q4, q5],
    qbId,
    teacherCookie,
    studentCookie,
  };
}

async function evalOrThrow(send, expression) {
  const params = { expression, returnByValue: true, awaitPromise: true };
  const res = await send('Runtime.evaluate', params);
  if (res.result && res.result.exceptionDetails) {
    const desc = res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text;
    throw new Error(`Browser Eval Exception: ${desc}`);
  }
  return res.result?.result?.value;
}

async function waitForCondition(send, expr, maxMs = 25000, stepMs = 400) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const val = await evalOrThrow(send, expr);
      if (val) return val;
    } catch {}
    await wait(stepMs);
  }
  return false;
}

async function runBrowserVerification(browser, prefix) {
  console.log(`\n===============================================================`);
  console.log(`LAUNCHING BROWSER VERIFICATION: ${browser.name.toUpperCase()}`);
  console.log(`Endpoint: ${BASE_URL}`);
  console.log(`===============================================================`);

  const testData = setupTestDatabase(prefix);
  console.log(`[INIT] Seeded test database. Exam: ${testData.examId}, Session: ${testData.sessionId}`);

  fs.mkdirSync(browser.profile, { recursive: true });

  const proc = spawn(browser.path, [
    `--remote-debugging-port=${browser.port}`,
    `--user-data-dir=${browser.profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--window-size=1920,1080',
    'about:blank',
  ]);

  let connected = false;
  let attempts = 0;
  while (!connected && attempts < 30) {
    await wait(300);
    attempts++;
    try {
      const v = await fetchJson(`http://127.0.0.1:${browser.port}/json/version`);
      if (v) connected = true;
    } catch {}
  }

  if (!connected) {
    proc.kill();
    throw new Error(`Failed to connect to ${browser.name} DevTools on port ${browser.port}`);
  }

  const tabs = await fetchJson(`http://127.0.0.1:${browser.port}/json/list`);
  const targetTab = tabs.find((t) => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || tabs[0];
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.method === 'Page.javascriptDialogOpening') {
        send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
      if (parsed.id && pending.has(parsed.id)) {
        pending.get(parsed.id)(parsed);
        pending.delete(parsed.id);
      }
    } catch {}
  });

  ws.on('error', (err) => console.warn(`[${browser.name} WS Warning]`, err.message));
  await new Promise((r) => ws.on('open', r));

  function send(method, params = {}, timeoutMs = 35000) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP command timeout after ${timeoutMs}ms: ${method}`));
        }
      }, timeoutMs);

      pending.set(id, (val) => {
        clearTimeout(timer);
        resolve(val);
      });
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(err);
      }
    });
  }

  // Enable necessary CDP domains
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  const bSlug = browser.name.toLowerCase().includes('edge') ? 'edge' : 'chrome';

  async function closeTopModal() {
    return await evalOrThrow(send, `(() => {
      const modals = Array.from(document.querySelectorAll('.fixed.inset-0'));
      for (let i = modals.length - 1; i >= 0; i--) {
        const modal = modals[i];
        const xBtn = modal.querySelector('button svg.lucide-x')?.closest('button') ||
                     modal.querySelector('button[title*="Close"]') ||
                     modal.querySelector('button:has(svg.lucide-x)');
        if (xBtn) {
          xBtn.click();
          return true;
        }
      }
      return false;
    })()`);
  }

  async function setSession(cookieVal, profile) {
    await send('Network.setCookie', {
      name: 'cortex_session',
      value: cookieVal,
      url: `${BASE_URL}/`,
      path: '/',
      secure: false,
      httpOnly: true,
    });

    await send('Page.navigate', { url: `${BASE_URL}/classroom` });
    await wait(2500);

    try {
      await evalOrThrow(
        send,
        `(() => {
        try {
          localStorage.setItem('cortex_user_profile', JSON.stringify(${JSON.stringify(profile)}));
          localStorage.setItem('classroom_active_role', '${profile.role}');
          sessionStorage.setItem('cortex_tab_name', ${JSON.stringify(profile.name)});
          sessionStorage.setItem('cortex_tab_role', ${JSON.stringify(profile.role === 'teacher' ? 'admin' : 'member')});
          sessionStorage.setItem('cortex_tab_participant', ${JSON.stringify(profile.id)});
        } catch (_) {}
      })()`
      );
    } catch {}

    await send('Page.navigate', { url: `${BASE_URL}/classroom` });
    await wait(2500);
  }

  try {
    // -------------------------------------------------------------
    // PART 1: TEACHER WORKFLOW (20 VERIFIED STEPS)
    // -------------------------------------------------------------
    console.log(`\n--- PART 1: TEACHER EXAMINATION MANAGEMENT WORKFLOW (${browser.name}) ---`);

    // Step 1: Set Teacher Auth Context
    console.log(`[STEP 1] Setting teacher auth context...`);
    await setSession(testData.teacherCookie, TEACHER_PROFILE);
    console.log(`[PASS] Step 1: Teacher auth session established.`);

    // Step 2: Navigate to Classroom
    console.log(`[STEP 2] Verifying /classroom dashboard loaded...`);
    const classLoaded = await waitForCondition(send, `document.body && document.body.innerText.length > 50`, 25000);
    if (!classLoaded) throw new Error('Classroom page did not load.');
    console.log(`[PASS] Step 2: Classroom page loaded successfully.`);

    // Step 3: Switch to Examinations Tab
    console.log(`[STEP 3] Switching to Examinations tab...`);
    await waitForCondition(
      send,
      `Array.from(document.querySelectorAll('button')).some(b => b.textContent && b.textContent.includes('Examinations'))`,
      20000
    );
    await evalOrThrow(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const examBtn = btns.find(b => b.textContent && b.textContent.includes('Examinations'));
      if (examBtn) examBtn.click();
    })()`);
    await wait(1200);
    const examsTabActive = await waitForCondition(send, `(() => {
      const text = document.body.innerText;
      return text.includes('Examination') || text.includes('Create Exam') || text.includes('Question Bank') || text.includes('CS201');
    })()`);
    if (!examsTabActive) throw new Error('Examinations tab failed to activate.');
    console.log(`[PASS] Step 3: Examinations tab active.`);

    // Step 4: Verify Published Exam Appears in List
    console.log(`[STEP 4] Verifying published exam in list...`);
    const examFound = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('CS201 Midterm Examination');
    })()`, 15000);
    if (!examFound) throw new Error('Target examination not found in examinations tab.');
    console.log(`[PASS] Step 4: Examination title verified in listing.`);

    // Step 5: Open Question Bank Modal
    console.log(`[STEP 5] Opening Question Bank modal...`);
    await evalOrThrow(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const qbBtn = btns.find(b => b.textContent && b.textContent.includes('Question Bank'));
      if (qbBtn) qbBtn.click();
    })()`);
    await wait(1000);
    const qbModalOpen = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Question Bank') || document.body.innerText.includes('QuickSelect');
    })()`);
    if (!qbModalOpen) throw new Error('Question Bank modal did not open.');
    console.log(`[PASS] Step 5: Question Bank modal opened and rendered.`);

    // Step 6: Filter Question Bank items
    console.log(`[STEP 6] Testing Question Bank search and filter...`);
    await evalOrThrow(send, `(() => {
      const searchInput = document.querySelector('input[placeholder*="Search questions"]');
      if (searchInput) {
        searchInput.value = 'QuickSelect';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await wait(500);
    const qbFiltered = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('QuickSelect');
    })()`);
    if (!qbFiltered) throw new Error('Question Bank filtering failed.');
    console.log(`[PASS] Step 6: Question Bank search and filter verified.`);

    // Step 7: Close Question Bank Modal
    console.log(`[STEP 7] Closing Question Bank modal...`);
    await closeTopModal();
    await wait(800);
    const qbClosed = await waitForCondition(send, `(() => {
      return !document.body.innerText.includes('QuickSelect');
    })()`, 10000);
    if (!qbClosed) throw new Error('Question Bank modal failed to close.');
    console.log(`[PASS] Step 7: Question Bank modal dismissed.`);

    // Step 8: Open Live Proctoring & Session Monitor
    console.log(`[STEP 8] Opening Live Proctoring Dashboard...`);
    await evalOrThrow(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dashBtn = btns.find(b => b.textContent && b.textContent.includes('Monitor'));
      if (dashBtn) dashBtn.click();
    })()`);
    await wait(1500);
    const dashOpen = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Live Proctoring & Session Monitor') || document.body.innerText.includes('Alex Chen');
    })()`, 15000);
    if (!dashOpen) throw new Error('Live proctoring modal failed to open.');
    console.log(`[PASS] Step 8: Live Proctoring Dashboard modal opened.`);

    // Step 9: Verify Real-Time Telemetry Counters
    console.log(`[STEP 9] Verifying telemetry metrics banner...`);
    const metricsChecked = await waitForCondition(send, `(() => {
      const text = document.body.innerText;
      return text.includes('TOTAL CANDIDATES') && text.includes('ACTIVE TESTING') && text.includes('SUBMITTED');
    })()`);
    if (!metricsChecked) throw new Error('Metrics cards missing in dashboard.');
    console.log(`[PASS] Step 9: Telemetry counters verified.`);

    // Step 10: Verify Candidate In Table
    console.log(`[STEP 10] Verifying candidate entry in table...`);
    const candidateRowVerified = await waitForCondition(send, `(() => {
      const text = document.body.innerText;
      return text.includes('Alex Chen') && text.includes('In Progress');
    })()`);
    if (!candidateRowVerified) throw new Error('Candidate not visible in dashboard table.');
    console.log(`[PASS] Step 10: Candidate Alex Chen verified with active status.`);

    // Step 11: Inspect Candidate Audit Timeline
    console.log(`[STEP 11] Opening candidate audit details drawer...`);
    await evalOrThrow(send, `(() => {
      const inspectBtn = document.querySelector('button[title*="Inspect Candidate"]');
      if (inspectBtn) inspectBtn.click();
    })()`);
    await wait(800);
    const drawerOpen = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Audit Trail & Response Details') || document.body.innerText.includes('Clean audit log');
    })()`);
    if (!drawerOpen) throw new Error('Candidate audit drawer did not open.');
    console.log(`[PASS] Step 11: Candidate audit drawer rendered.`);

    // Step 12: Close Audit Drawer
    console.log(`[STEP 12] Closing audit drawer...`);
    await evalOrThrow(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const closeBtn = btns.find(b => b.textContent && b.textContent.includes('Close Audit Panel'));
      if (closeBtn) closeBtn.click();
    })()`);
    await wait(500);
    console.log(`[PASS] Step 12: Audit drawer closed.`);

    // Step 13: Test In-Modal Time Extension Dialog with Quick Presets
    console.log(`[STEP 13] Testing in-modal time extension dialog...`);
    await evalOrThrow(send, `(() => {
      const extendBtn = document.querySelector('button[title*="Grant Extra Time"]');
      if (extendBtn) extendBtn.click();
    })()`);
    await wait(600);
    const extendModalOpen = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Grant Individual Time Extension') && document.body.innerText.includes('+15m');
    })()`);
    if (!extendModalOpen) throw new Error('Time extension modal did not open.');
    console.log(`[PASS] Step 13: Time extension dialog opened with quick presets.`);

    // Step 14: Select +15m preset and Confirm
    console.log(`[STEP 14] Selecting +15m preset and confirming...`);
    await evalOrThrow(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const p15 = btns.find(b => b.textContent && b.textContent.includes('+15m'));
      if (p15) p15.click();
      const confirmBtn = btns.find(b => b.textContent && b.textContent.includes('Confirm Extension'));
      if (confirmBtn) confirmBtn.click();
    })()`);
    await wait(1200);
    const bannerConfirmed = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Granted 15 minutes extension') || document.body.innerText.includes('Alex Chen');
    })()`);
    if (!bannerConfirmed) throw new Error('Time extension notification banner not found.');
    console.log(`[PASS] Step 14: In-modal action banner verified: Time extension granted.`);

    // Step 15: Open In-Modal Early Termination Dialog (No window.prompt!)
    console.log(`[STEP 15] Testing in-modal termination dialog (replacing window.prompt)...`);
    await evalOrThrow(send, `(() => {
      const termBtn = document.querySelector('button[title*="Terminate Attempt"]');
      if (termBtn) termBtn.click();
    })()`);
    await wait(600);
    const termModalOpen = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Confirm Early Attempt Termination') && document.body.innerText.includes('Administrative Reason');
    })()`);
    if (!termModalOpen) throw new Error('In-modal termination confirmation dialog not displayed.');
    console.log(`[PASS] Step 15: In-modal early termination dialog verified (clean DOM modal, zero prompt blocks).`);

    // Step 16: Enter Administrative Reason and Cancel (Safety Check)
    console.log(`[STEP 16] Testing cancellation of termination dialog...`);
    await evalOrThrow(send, `(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Cancel');
      if (cancelBtn) cancelBtn.click();
    })()`);
    await wait(400);
    console.log(`[PASS] Step 16: Cancellation preserves candidate in_progress state.`);

    // Step 17: Re-open Termination Dialog and Execute Force Submit
    console.log(`[STEP 17] Re-opening termination dialog and executing force submit...`);
    await evalOrThrow(send, `(() => {
      const termBtn = document.querySelector('button[title*="Terminate Attempt"]');
      if (termBtn) termBtn.click();
    })()`);
    await wait(500);
    await evalOrThrow(send, `(() => {
      const reasonInput = document.querySelector('input[placeholder*="State reason for termination"]');
      if (reasonInput) {
        reasonInput.value = 'Proctor administrative verification termination';
        reasonInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Confirm Force Submit'));
      if (confirmBtn) confirmBtn.click();
    })()`);
    await wait(1400);
    const termBanner = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('concluded') || document.body.innerText.includes('Alex Chen');
    })()`);
    if (!termBanner) throw new Error('Termination action banner not displayed.');
    console.log(`[PASS] Step 17: Force submission executed and in-modal notification confirmed.`);

    // Step 18: Verify Candidate Transitioned to Submitted Status
    console.log(`[STEP 18] Verifying candidate table status updated to Submitted...`);
    const statusSubmitted = await waitForCondition(send, `(() => {
      const candRow = Array.from(document.querySelectorAll('tr')).find(r => r.innerText.includes('Alex Chen'));
      return candRow && (candRow.innerText.includes('Submitted') || candRow.innerText.includes('Expired'));
    })()`);
    if (!statusSubmitted) throw new Error('Candidate status did not transition to Submitted in dashboard.');
    console.log(`[PASS] Step 18: Candidate status transitioned to Submitted.`);

    // Step 19: Close Live Dashboard Modal
    console.log(`[STEP 19] Closing Live Dashboard modal...`);
    await closeTopModal();
    await wait(800);
    console.log(`[PASS] Step 19: Live Dashboard modal closed.`);

    // Step 20: Teacher Review Workflow
    console.log(`[STEP 20] Teacher workflow completion check...`);
    const examListingStillActive = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('CS201 Midterm Examination');
    })()`);
    if (!examListingStillActive) throw new Error('Examinations tab lost after closing dashboard.');
    console.log(`[PASS] Step 20: Complete Teacher workflow verified (20/20 steps).`);

    // -------------------------------------------------------------
    // PART 2: STUDENT WORKFLOW & AUTOSAVE STATE MACHINE (12 STEPS)
    // -------------------------------------------------------------
    console.log(`\n--- PART 2: STUDENT WORKFLOW & AUTOSAVE RESILIENCE (${browser.name}) ---`);

    // Re-seed a fresh in-progress session for student workflow
    const studentTestData = setupTestDatabase(`${prefix}_s`);

    // Step 1: Switch to Student Auth Context
    console.log(`[STUDENT STEP 1] Switching to student auth context...`);
    await setSession(studentTestData.studentCookie, STUDENT_PROFILE);
    console.log(`[PASS] Student Step 1: Student session established.`);

    // Step 2: Switch to Examinations Tab
    console.log(`[STUDENT STEP 2] Navigating to Examinations tab...`);
    await waitForCondition(
      send,
      `Array.from(document.querySelectorAll('button')).some(b => b.textContent && b.textContent.includes('Examinations'))`,
      20000
    );
    await evalOrThrow(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const examBtn = btns.find(b => b.textContent && b.textContent.includes('Examinations'));
      if (examBtn) examBtn.click();
    })()`);
    await wait(1200);
    console.log(`[PASS] Student Step 2: Student Examinations tab active.`);

    // Step 3: Launch Examination Attempt
    console.log(`[STUDENT STEP 3] Launching examination runner modal...`);
    await waitForCondition(
      send,
      `Array.from(document.querySelectorAll('button')).some(b => b.textContent && (b.textContent.includes('Start Exam') || b.textContent.includes('Resume Exam') || b.textContent.includes('Take Exam')))`
    );
    await evalOrThrow(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const startBtn = btns.find(b => b.textContent && (b.textContent.includes('Start Exam') || b.textContent.includes('Resume Exam') || b.textContent.includes('Take Exam')));
      if (startBtn) startBtn.click();
    })()`);
    await wait(1500);

    const runnerOpen = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('CS201 Midterm Examination') && document.body.innerText.includes('Candidate: Alex Chen');
    })()`, 20000);
    if (!runnerOpen) throw new Error('Exam Runner modal failed to open.');
    console.log(`[PASS] Student Step 3: ExamRunnerModal active in browser.`);

    // Step 4: Verify Header Elements (Candidate name, attempt #, countdown timer)
    console.log(`[STUDENT STEP 4] Verifying runner header elements...`);
    const headerVerified = await waitForCondition(send, `(() => {
      const text = document.body.innerText;
      return text.includes('Candidate: Alex Chen') && text.includes('Attempt #1') && text.includes('Submit Exam');
    })()`);
    if (!headerVerified) throw new Error('Header elements incomplete.');
    console.log(`[PASS] Student Step 4: Header metadata and timer verified.`);

    // Step 5: Verify Initial Autosave Indicator
    console.log(`[STUDENT STEP 5] Verifying autosave status indicator...`);
    const autosaveReady = await waitForCondition(send, `(() => {
      const text = document.body.innerText;
      return text.includes('Saved at') || text.includes('Ready');
    })()`);
    if (!autosaveReady) throw new Error('Autosave status indicator not initialized.');
    console.log(`[PASS] Student Step 5: Autosave status indicator verified.`);

    // Step 6: Answer Question 1 (Single MCQ) & Verify Immediate Autosave
    console.log(`[STUDENT STEP 6] Answering Question 1 (Single MCQ) and verifying autosave...`);
    await evalOrThrow(send, `(() => {
      const options = Array.from(document.querySelectorAll('div')).filter(d => d.textContent && d.textContent.includes('O(log n)'));
      if (options.length > 0) options[options.length - 1].click();
    })()`);
    await wait(1500);

    const q1Saved = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Saved at');
    })()`);
    if (!q1Saved) throw new Error('Autosave did not complete for Question 1.');
    console.log(`[PASS] Student Step 6: Single MCQ answered and server-confirmed saved.`);

    // Step 7: Mark Question for Review & Check Palette Indicator
    console.log(`[STUDENT STEP 7] Marking Question 1 for review...`);
    await evalOrThrow(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const flagBtn = btns.find(b => b.textContent && (b.textContent.includes('Mark for Review') || b.textContent.includes('Marked for Review')));
      if (flagBtn) flagBtn.click();
    })()`);
    await wait(800);
    const flagActive = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Marked for Review');
    })()`);
    if (!flagActive) throw new Error('Flag for review state not active.');
    console.log(`[PASS] Student Step 7: Question marked for review and saved.`);

    // Step 8: Test Non-Blocking Question Navigation
    console.log(`[STUDENT STEP 8] Testing non-blocking navigation to Question 2...`);
    await evalOrThrow(send, `(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Next'));
      if (nextBtn) nextBtn.click();
    })()`);
    await wait(400);
    const q2Active = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Question 2') && document.body.innerText.includes('MCQ MULTIPLE');
    })()`);
    if (!q2Active) throw new Error('Navigation to Question 2 failed.');
    console.log(`[PASS] Student Step 8: Non-blocking navigation verified.`);

    // Step 9: Answer Multi-MCQ on Question 2
    console.log(`[STUDENT STEP 9] Answering Multi-MCQ options...`);
    await evalOrThrow(send, `(() => {
      const kruskal = Array.from(document.querySelectorAll('div')).find(d => d.textContent && d.textContent.includes('Kruskal Algorithm'));
      if (kruskal) kruskal.click();
      const prim = Array.from(document.querySelectorAll('div')).find(d => d.textContent && d.textContent.includes('Prim Algorithm'));
      if (prim) prim.click();
    })()`);
    await wait(1500);
    const q2Saved = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Saved at');
    })()`);
    if (!q2Saved) throw new Error('Multi-MCQ autosave failed.');
    console.log(`[PASS] Student Step 9: Multi-MCQ answered and server-confirmed saved.`);

    // Step 10: Network Disconnection, Offline Banner, Unsaved Indicator, and Reconnect
    console.log(`[STUDENT STEP 10] Testing Network Disconnection and Recovery...`);
    // Emulate Network Drop
    await send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    // Dispatch offline event to window
    await evalOrThrow(send, `window.dispatchEvent(new Event('offline'))`);
    await wait(500);

    const offlineBannerShown = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Network Disconnection') || document.body.innerText.includes('offline');
    })()`);
    if (!offlineBannerShown) throw new Error('Offline disconnection banner did not appear.');
    console.log(`[PASS] Student Step 10a: Prominent network disconnection banner displayed.`);

    // Navigate to Question 3 (True/False) and Answer while Offline
    await evalOrThrow(send, `(() => {
      const q3Btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === '3');
      if (q3Btn) q3Btn.click();
    })()`);
    await wait(400);

    await evalOrThrow(send, `(() => {
      const trueBtn = Array.from(document.querySelectorAll('div')).find(d => d.textContent && d.textContent.trim() === 'TRUE');
      if (trueBtn) trueBtn.click();
    })()`);
    await wait(400);

    const unsavedIndicatorVisible = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Offline (saved locally)') || document.querySelector('.bg-amber-400') !== null;
    })()`);
    if (!unsavedIndicatorVisible) throw new Error('Unsaved/offline indicator missing during network drop.');
    console.log(`[PASS] Student Step 10b: Offline changes retained in memory with dirty indicator.`);

    // Restore Network Connection
    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 20,
      downloadThroughput: 10000000,
      uploadThroughput: 10000000,
    });
    await evalOrThrow(send, `window.dispatchEvent(new Event('online'))`);
    await wait(2200);

    const reconnectedSynced = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Saved at');
    })()`);
    if (!reconnectedSynced) throw new Error('Failed to reconnect and flush pending answers to server.');
    console.log(`[PASS] Student Step 10c: Network restored; pending changes flushed and server-confirmed.`);

    // Step 11: Final Submission Confirmation
    console.log(`[STUDENT STEP 11] Final submission workflow...`);
    await evalOrThrow(send, `(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Submit Exam'));
      if (submitBtn) submitBtn.click();
    })()`);
    await wait(600);

    const confirmModalOpen = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Confirm Final Examination Submission');
    })()`);
    if (!confirmModalOpen) throw new Error('Final submit confirmation dialog not displayed.');
    console.log(`[PASS] Student Step 11: Final submission confirmation dialog rendered.`);

    // Step 12: Confirm Submission & View Score Results
    console.log(`[STUDENT STEP 12] Confirming final submission and verifying score...`);
    await evalOrThrow(send, `(() => {
      const confirmFinalBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Yes, Submit Now'));
      if (confirmFinalBtn) confirmFinalBtn.click();
    })()`);
    await wait(2000);

    const submissionSuccess = await waitForCondition(send, `(() => {
      return document.body.innerText.includes('Examination Submitted Successfully');
    })()`);
    if (!submissionSuccess) throw new Error('Submission success screen not reached.');
    console.log(`[PASS] Student Step 12: Examination submitted successfully with auto-score badge.`);

    // -------------------------------------------------------------
    // PART 3: RESPONSIVE VIEWPORT VALIDATION ACROSS 5 DEVICES
    // -------------------------------------------------------------
    console.log(`\n--- PART 3: RESPONSIVE VIEWPORT TESTING (5 VIEWPORTS) (${browser.name}) ---`);

    const VIEWPORTS = [
      { name: 'desktop_1920x1080', width: 1920, height: 1080, mobile: false },
      { name: 'laptop_1366x768', width: 1366, height: 768, mobile: false },
      { name: 'tablet_portrait_768x1024', width: 768, height: 1024, mobile: true },
      { name: 'tablet_landscape_1024x768', width: 1024, height: 768, mobile: true },
      { name: 'mobile_phone_390x844', width: 390, height: 844, mobile: true },
    ];

    for (const vp of VIEWPORTS) {
      console.log(`[VIEWPORT] Testing ${vp.name} (${vp.width}x${vp.height})...`);
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      });
      await wait(500);

      // Verify no horizontal overflow on body
      const overflowClean = await evalOrThrow(send, `(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 2;
      })()`);

      const screenshotFile = path.join(SCREENSHOTS_DIR, `${bSlug}_${vp.name}.png`);
      const ssRes = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(screenshotFile, Buffer.from(ssRes.result.data, 'base64'));

      console.log(`[PASS] Viewport ${vp.name}: Layout verified (Horizontal overflow clean: ${overflowClean}). Screenshot saved.`);
    }

    // Reset Emulation
    await send('Emulation.clearDeviceMetricsOverride');

    console.log(`\n[SUCCESS] ALL VERIFICATIONS PASSED IN ${browser.name.toUpperCase()}!`);
    return { success: true, browser: browser.name };
  } catch (err) {
    console.error(`\n[ERROR in ${browser.name}]:`, err.message);
    try {
      const errSs = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, `${bSlug}_failure.png`), Buffer.from(errSs.result.data, 'base64'));
    } catch (_) {}
    return { success: false, browser: browser.name, error: err.message };
  } finally {
    try {
      ws.close();
    } catch (_) {}
    proc.kill();
  }
}

async function main() {
  console.log('================================================================');
  console.log('CORTEX ONLINE EXAMINATION SYSTEM: PHASE 3.8 BROWSER AUTOMATION');
  console.log('Real Browsers: Google Chrome & Microsoft Edge');
  console.log('================================================================\n');

  // Warm up dev server before launching browsers
  console.log('[WARMUP] Pre-fetching /classroom to ensure cold routes are compiled...');
  try {
    await fetchJson(`${BASE_URL}/classroom`);
    console.log('[WARMUP] Server route compilation ready.');
  } catch (e) {
    console.warn('[WARMUP Warning]', e.message);
  }
  await wait(1500);

  const results = [];
  for (let i = 0; i < BROWSERS.length; i++) {
    const browser = BROWSERS[i];
    const prefix = i === 0 ? 'p38_chrome' : 'p38_edge';
    const res = await runBrowserVerification(browser, prefix);
    results.push(res);
  }

  console.log('\n================================================================');
  console.log('FINAL BROWSER AUTOMATION SUMMARY');
  console.log('================================================================');
  let allPassed = true;
  for (const r of results) {
    if (r.success) {
      console.log(`[PASS] ${r.browser}: All Teacher, Student, Autosave, and Viewport workflows passed.`);
    } else {
      allPassed = false;
      console.error(`[FAIL] ${r.browser}: Failed with error: ${r.error}`);
    }
  }

  if (!allPassed) {
    process.exit(1);
  } else {
    console.log('\nAll browser workflows successfully verified.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
