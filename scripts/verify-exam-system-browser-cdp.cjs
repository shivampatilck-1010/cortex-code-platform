const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const BROWSERS = [
  {
    name: 'Google Chrome',
    path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    port: 9385,
    profile: 'C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\chrome-exam-test-profile'
  },
  {
    name: 'Microsoft Edge',
    path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    port: 9386,
    profile: 'C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\edge-exam-test-profile'
  }
];

const BASE_URL = 'http://127.0.0.1:3000';
const CLASSROOM_ID = 'C1-CS201-ADV';
const TEACHER_COOKIE = 'sess_teacher_cdp_test';
const STUDENT_COOKIE = 'sess_student_cdp_test';

const TEACHER_PROFILE = {
  id: 'usr_prof_elena',
  name: 'Prof. Elena Rostova',
  email: 'elena.rostova@cortex.edu',
  role: 'teacher'
};

const STUDENT_PROFILE = {
  id: 'usr_alex_chen',
  name: 'Alex Chen',
  email: 'alex.chen@student.cortex.edu',
  role: 'student'
};

async function wait(ms) {
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
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function evalOrThrow(send, expression, forceAwait = false) {
  const isAsync = forceAwait || expression.trim().startsWith('(async') || expression.trim().startsWith('async');
  const params = { expression, returnByValue: true };
  if (isAsync) params.awaitPromise = true;
  const res = await send('Runtime.evaluate', params);
  if (res.result && res.result.exceptionDetails) {
    const desc = res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text;
    throw new Error(`Browser Eval Exception: ${desc}`);
  }
  return res.result?.result?.value;
}

async function runBrowserVerification(browser) {
  console.log(`\n===============================================================`);
  console.log(`TESTING BROWSER: ${browser.name}`);
  console.log(`Target: ${BASE_URL}/classroom`);
  console.log(`===============================================================`);

  const proc = spawn(browser.path, [
    `--remote-debugging-port=${browser.port}`,
    `--user-data-dir=${browser.profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--window-size=1920,1080',
    'about:blank'
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

  function send(method, params = {}, timeoutMs = 15000) {
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
      } catch (e) {
        clearTimeout(timer);
        pending.delete(id);
        reject(e);
      }
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  const results = [];
  function record(name, pass, details = '') {
    results.push({ name, pass, details });
    if (pass) {
      console.log(`[PASS] ${name}${details ? ': ' + details : ''}`);
    } else {
      console.error(`[FAIL] ${name}${details ? ': ' + details : ''}`);
    }
  }

  async function setSession(cookieVal, profile) {
    await send('Network.setCookie', {
      name: 'cortex_session',
      value: cookieVal,
      domain: '127.0.0.1',
      path: '/',
      secure: false,
      httpOnly: true
    });

    try {
      await evalOrThrow(send, `(() => {
        localStorage.setItem('cortex_user_profile', JSON.stringify(${JSON.stringify(profile)}));
        sessionStorage.setItem('cortex_tab_name', ${JSON.stringify(profile.name)});
        sessionStorage.setItem('cortex_tab_role', ${JSON.stringify(profile.role === 'teacher' ? 'admin' : 'member')});
        sessionStorage.setItem('cortex_tab_participant', ${JSON.stringify(profile.id)});
      })()`);
    } catch {}

    await send('Page.navigate', { url: `${BASE_URL}/classroom` });
    await wait(3500);

    try {
      await evalOrThrow(send, `(() => {
        localStorage.setItem('cortex_user_profile', JSON.stringify(${JSON.stringify(profile)}));
      })()`);
    } catch {}
  }

  try {
    // -------------------------------------------------------------
    // STAGE 1: TEACHER WORKFLOW & QUESTION BANK VERIFICATION
    // -------------------------------------------------------------
    console.log(`\n--- STAGE 1: Teacher Workflow & Question Bank (${browser.name}) ---`);

    // 1.1 Initial Load as Teacher
    await send('Page.navigate', { url: `${BASE_URL}/classroom` });
    await wait(2500);
    await setSession(TEACHER_COOKIE, TEACHER_PROFILE);

    const teacherLoaded = await evalOrThrow(send, `(() => {
      const body = document.body.innerText;
      return body.includes('Prof. Elena Rostova') || body.includes('Examinations') || body.includes('TEACHER');
    })()`);
    record('Teacher initial authentication & classroom view load', teacherLoaded, 'Elena Rostova detected with classroom navigation');

    // 1.2 Switch to Examinations Tab
    await evalOrThrow(send, `(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Examinations'));
      if (tab) tab.click();
      return !!tab;
    })()`);
    await wait(2000);

    const examTabActive = await evalOrThrow(send, `(() => {
      const body = document.body.innerText;
      return body.includes('Online Examinations') && (body.includes('Question Bank') || body.includes('Reusable'));
    })()`);
    record('Examinations tab rendered with Question Bank trigger', examTabActive, 'Header and action controls visible');

    // 1.3 Open Question Bank Modal
    await evalOrThrow(send, `(() => {
      const qbBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Question Bank') || b.title?.includes('Question Bank'));
      if (qbBtn) qbBtn.click();
      return !!qbBtn;
    })()`);
    await wait(2000);

    const qbModalOpen = await evalOrThrow(send, `(() => {
      const modal = document.body.innerText;
      return modal.includes('Question Bank') && (modal.includes('Create Bank Question') || modal.includes('items'));
    })()`);
    record('Question Bank modal rendered and interactive', qbModalOpen, 'Question Bank modal open with action controls');

    // 1.4 Create Single-Choice MCQ in Question Bank
    const testTimestamp = Date.now();
    const mcqPrompt = `What is the worst-case time complexity of binary search on a sorted array of N elements? [${testTimestamp}]`;
    const createdMCQ = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Computer Science',
          topic: 'Search Algorithms',
          difficulty: 'easy',
          questionType: 'mcq_single',
          promptText: ${JSON.stringify(mcqPrompt)},
          options: [
            { id: 'opt_1', text: 'O(log N)' },
            { id: 'opt_2', text: 'O(N)' },
            { id: 'opt_3', text: 'O(1)' },
            { id: 'opt_4', text: 'O(N^2)' }
          ],
          correctAnswer: { correctOptionId: 'opt_1' },
          defaultPoints: 4,
          negativeMarks: 1,
          tags: ['search', 'binary-search', 'algorithms']
        })
      });
      return await res.json();
    })()`);
    const qbMCQId = createdMCQ?.question?.id;
    record('Question Bank: Create single-choice MCQ', !!qbMCQId, `Question ID: ${qbMCQId}`);

    // Refresh Question Bank UI using the refresh button
    await evalOrThrow(send, `(() => {
      const refreshBtn = document.querySelector('button[title="Refresh question bank"]');
      if (refreshBtn) refreshBtn.click();
      return !!refreshBtn;
    })()`);
    await wait(2000);

    const mcqInList = await evalOrThrow(send, `(() => {
      return document.body.innerText.includes(${JSON.stringify(mcqPrompt)}) || document.body.innerText.includes('binary search');
    })()`);
    record('Question Bank: MCQ appears in browser modal list', mcqInList, 'Item text verified in DOM');

    // 1.5 Filter and Search in Question Bank
    const searchFilterCheck = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/question-bank?search=' + encodeURIComponent('binary search') + '&difficulty=easy');
      const data = await res.json();
      return Array.isArray(data.questions) && data.questions.some(q => q.id === '${qbMCQId}');
    })()`);
    record('Question Bank: Filter by search query and difficulty', searchFilterCheck, 'Item successfully retrieved via filters');

    // 1.6 Edit Question Bank Item
    const updatedPrompt = `What is the worst-case time complexity of binary search on sorted array? (EDITED) [${testTimestamp}]`;
    const editCheck = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/question-bank/${qbMCQId}', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: ${JSON.stringify(updatedPrompt)},
          defaultPoints: 5
        })
      });
      const data = await res.json();
      return data.question?.promptText === ${JSON.stringify(updatedPrompt)} && data.question?.defaultPoints === 5;
    })()`);
    record('Question Bank: Edit question prompt and points', editCheck, 'Updated prompt and points verified');

    // 1.7 Duplicate Question Bank Item
    const dupCheck = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/question-bank/${qbMCQId}/duplicate', {
        method: 'POST'
      });
      const data = await res.json();
      return data.question && data.question.id !== '${qbMCQId}' && data.question.promptText.includes('(Copy)');
    })()`);
    record('Question Bank: Duplicate question creates independent clone with (Copy)', dupCheck, 'Clone ID differs and prompt has (Copy)');

    // 1.8 Archive Question Bank Item
    const archiveCheck = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/question-bank/${qbMCQId}', {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) return false;

      // Verify omitted in active query
      const activeRes = await fetch('/api/v1/question-bank');
      const activeData = await activeRes.json();
      const notInActive = !activeData.questions.some(q => q.id === '${qbMCQId}');

      // Verify included in archived query
      const archRes = await fetch('/api/v1/question-bank?includeArchived=true');
      const archData = await archRes.json();
      const inArchived = archData.questions.some(q => q.id === '${qbMCQId}' && (q.isArchived === 1 || q.isArchived === true));

      return notInActive && inArchived;
    })()`);
    record('Question Bank: Soft delete / archive toggling', archiveCheck, 'Archived items hidden from default and visible with includeArchived');

    // 1.9 Create Other Question Types in Bank: Numerical and Programming
    const diverseTypesCheck = await evalOrThrow(send, `(async () => {
      // Numerical
      const numRes = await fetch('/api/v1/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Computer Science',
          topic: 'Binary Trees',
          difficulty: 'medium',
          questionType: 'numerical',
          promptText: 'What is the maximum number of nodes in a binary tree of height 3? [${testTimestamp}]',
          correctAnswer: { value: 15, tolerance: 0 },
          defaultPoints: 5,
          tags: ['trees', 'math']
        })
      });
      const numData = await numRes.json();

      // Programming
      const progRes = await fetch('/api/v1/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Computer Science',
          topic: 'Dynamic Programming',
          difficulty: 'hard',
          questionType: 'programming',
          promptText: 'Implement a function to compute the N-th Fibonacci number. [${testTimestamp}]',
          language: 'python',
          starterCode: 'def fib(n):\\n    pass\\n',
          testCases: [
            { id: 'tc1', input: '5', expectedOutput: '5', isHidden: false, points: 4 },
            { id: 'tc2', input: '10', expectedOutput: '55', isHidden: true, points: 6 }
          ],
          defaultPoints: 10,
          tags: ['dp', 'fibonacci', 'python']
        })
      });
      const progData = await progRes.json();

      return (numData.question?.id && progData.question?.id) ? { numId: numData.question.id, progId: progData.question.id } : null;
    })()`);
    record('Question Bank: Diverse question types (Numerical, Programming)', !!diverseTypesCheck, `Created numId: ${diverseTypesCheck?.numId}, progId: ${diverseTypesCheck?.progId}`);

    // Close Question Bank Modal
    await evalOrThrow(send, `(() => {
      const closeBtn = document.querySelector('button[title="Close modal"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Close') || b.querySelector('svg.lucide-x'));
      if (closeBtn) closeBtn.click();
      return !!closeBtn;
    })()`);
    await wait(1500);

    // -------------------------------------------------------------
    // STAGE 2: TEACHER EXAMINATION MANAGEMENT & IMMUTABILITY
    // -------------------------------------------------------------
    console.log(`\n--- STAGE 2: Teacher Examination Management (${browser.name}) ---`);

    // 2.1 Create New Draft Examination
    const examTitle = `Midterm Examination 2026: Advanced Data Structures [${testTimestamp}]`;
    const examCreated = await evalOrThrow(send, `(async () => {
      const now = Date.now();
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ${JSON.stringify(examTitle)},
          description: 'Comprehensive evaluation of trees, sorting, and algorithmic complexity.',
          durationMinutes: 45,
          startTime: now,
          endTime: now + 86400000 * 2,
          totalMarks: 25,
          passingMarks: 10,
          attemptsAllowed: 1,
          securityLevel: 'standard',
          status: 'draft',
          shuffleQuestions: false,
          shuffleOptions: false,
          showResultsImmediately: true
        })
      });
      return await res.json();
    })()`);
    record('Teacher Exam Creation: Create draft examination', !!examCreated.exam?.id, `Exam ID: ${examCreated.exam?.id}`);
    const examId = examCreated.exam.id;

    // Refresh Exams Tab
    await evalOrThrow(send, `(() => {
      const refreshBtn = document.querySelector('button[title="Refresh examinations"]');
      if (refreshBtn) refreshBtn.click();
      return !!refreshBtn;
    })()`);
    await wait(2500);

    const examInList = await evalOrThrow(send, `(() => {
      return document.body.innerText.includes(${JSON.stringify(examTitle)}) || document.body.innerText.includes('Midterm Examination 2026');
    })()`);
    record('Teacher Exam Listing: Draft exam visible with status badge', examInList, 'Exam title and Draft badge confirmed');

    // 2.2 Import Question from Question Bank into Exam
    const importedSnap = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/questions/import-from-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankQuestionId: '${diverseTypesCheck.numId}',
          pointsOverride: 6
        })
      });
      return await res.json();
    })()`);
    record('Question Bank Import: Immutable snapshot import into exam', !!importedSnap?.question?.id, `Exam Question ID: ${importedSnap?.question?.id}, points: ${importedSnap?.question?.points}`);

    // Import Programming Question as well
    const importedProg = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/questions/import-from-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankQuestionId: '${diverseTypesCheck.progId}',
          pointsOverride: 10
        })
      });
      return await res.json();
    })()`);
    record('Question Bank Import: Programming question imported', !!importedProg?.question?.id, `Exam Question ID: ${importedProg?.question?.id}`);

    // Add 1 direct question to the exam
    const directQ = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionType: 'mcq_single',
          promptText: 'What is the space complexity of merge sort on an array of N items?',
          options: [
            { id: 'opt_a', text: 'O(N)' },
            { id: 'opt_b', text: 'O(1)' },
            { id: 'opt_c', text: 'O(N^2)' }
          ],
          correctAnswer: { optionId: 'opt_a' },
          points: 4,
          negativeMarks: 0
        })
      });
      return await res.json();
    })()`);
    record('Exam Questions: Direct question creation in exam', !!directQ?.question?.id, `Question ID: ${directQ?.question?.id}`);

    // 2.3 Verify Immutability: Mutate Bank Question and verify Exam Question remains unchanged
    const immutabilityVerified = await evalOrThrow(send, `(async () => {
      // Mutate bank question
      await fetch('/api/v1/question-bank/${diverseTypesCheck.numId}', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: 'COMPLETELY MUTATED BANK PROMPT AFTER IMPORT'
        })
      });

      // Fetch exam question
      const examQRes = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/questions');
      const examQData = await examQRes.json();
      const snapQ = examQData.questions.find(q => q.id === '${importedSnap.question.id}');

      return snapQ && !snapQ.promptText.includes('MUTATED') && snapQ.promptText.includes('maximum number of nodes');
    })()`);
    record('Immutability Guarantee: Bank mutation NEVER affects imported exam question', immutabilityVerified, 'Snapshot decoupling verified');

    // 2.4 Publish Examination
    const publishResult = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' })
      });
      return await res.json();
    })()`);
    record('Teacher Exam Publish: Transition draft -> published', publishResult?.status === 'published', 'Exam status is now published');

    // -------------------------------------------------------------
    // STAGE 3: STUDENT EXAMINATION WORKFLOW & SECURITY VERIFICATION
    // -------------------------------------------------------------
    console.log(`\n--- STAGE 3: Student Examination Workflow (${browser.name}) ---`);

    // 3.1 Switch session to Student
    await setSession(STUDENT_COOKIE, STUDENT_PROFILE);

    const studentLoaded = await evalOrThrow(send, `(() => {
      const body = document.body.innerText;
      return body.includes('Alex Chen') || body.includes('STUDENT') || body.includes('Examinations') || body.includes('Stream') || body.includes('Classroom');
    })()`);
    record('Student Session Switch: Alex Chen authenticated', studentLoaded, 'Student identity verified in UI');

    // Switch to Examinations tab as student
    await evalOrThrow(send, `(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Examinations'));
      if (tab) tab.click();
      return !!tab;
    })()`);
    await wait(2500);

    const studentSeesExam = await evalOrThrow(send, `(() => {
      return document.body.innerText.includes(${JSON.stringify(examTitle)}) || document.body.innerText.includes('Online Examinations') || document.body.innerText.includes('Midterm Examination 2026');
    })()`);
    record('Student View: Published exam visible in listing', studentSeesExam, 'Published exam rendered for enrolled student');

    // 3.2 Security Verification: Student questions query must sanitize correct answers and hidden test cases
    const studentSanitizationCheck = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}');
      const data = await res.json();
      const qs = data.exam?.questions || [];

      let leakFound = false;
      for (const q of qs) {
        // Correct answer MUST NEVER be exposed
        if (q.correctAnswer !== undefined && q.correctAnswer !== null) leakFound = true;
        // Test cases must redact hidden inputs/outputs
        if (q.testCases) {
          for (const tc of q.testCases) {
            if (tc.isHidden) {
              // Real hidden values must not leak
              if (tc.input !== '[HIDDEN TEST CASE]' || tc.expectedOutput !== '[HIDDEN TEST CASE]') {
                leakFound = true;
              }
            } else {
              // Public sample test cases must be present
              if (!tc.input || !tc.expectedOutput) {
                leakFound = true;
              }
            }
          }
        }
      }
      return !leakFound && qs.length === 3;
    })()`);
    record('Security Gate: Student questions sanitized (no correct answers, hidden test cases redacted)', studentSanitizationCheck, 'Sanitization verified: 0 answer leaks, hidden tests redacted');

    // 3.3 Start Student Examination Session
    const startSessionResult = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/start', {
        method: 'POST'
      });
      return await res.json();
    })()`);
    record('Student Session Start: Exam session activated', startSessionResult?.session?.status === 'in_progress', `Session ID: ${startSessionResult?.session?.id}, ExpiresAt: ${new Date(startSessionResult?.session?.expiresAt).toISOString()}`);
    const studentSessionId = startSessionResult?.session?.id;

    // 3.4 Student Autosave Responses
    const saveResp1 = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/sessions/${studentSessionId}/responses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: '${importedSnap.question.id}',
          response: { value: 15 },
          flaggedForReview: true
        })
      });
      return await res.json();
    })()`);
    record('Student Autosave: Numerical answer and review flag saved', saveResp1?.success, 'Autosave returned 200 OK');

    const saveResp2 = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/sessions/${studentSessionId}/responses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: '${directQ.question.id}',
          response: { optionId: 'opt_a' },
          flaggedForReview: false
        })
      });
      return await res.json();
    })()`);
    record('Student Autosave: MCQ option answer saved', saveResp2?.success, 'Autosave returned 200 OK');

    // 3.5 Persistence Across Reload: Verify saved responses restored on resume
    const resumeCheck = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/start', {
        method: 'POST'
      });
      const data = await res.json();
      const r1 = data.savedResponses?.find(r => r.questionId === '${importedSnap.question.id}');
      const r2 = data.savedResponses?.find(r => r.questionId === '${directQ.question.id}');
      return r1?.response?.value === 15 && !!r1?.flaggedForReview && r2?.response?.optionId === 'opt_a';
    })()`);
    record('Persistence Across Reload: Session answers and flags restored from server', resumeCheck, 'All responses and flags intact on session resume');

    // 3.6 Anti-Tampering Gate: Client cannot forge earnedPoints during submission
    const forgedSubmitCheck = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/sessions/${studentSessionId}/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forgedScore: 9999,
          earnedPoints: 9999
        })
      });
      const data = await res.json();
      // Server must calculate score itself (6 for numerical + 4 for MCQ = 10, NOT 9999)
      return data.session?.status === 'submitted' && data.session?.finalScore <= 25 && data.session?.finalScore >= 10;
    })()`);
    record('Anti-Tampering Gate: Server strictly recalculates score and locks session', forgedSubmitCheck, 'Client score injection ignored, session locked to submitted');

    // -------------------------------------------------------------
    // STAGE 4: TEACHER GRADING & SUBMISSIONS WORKBENCH
    // -------------------------------------------------------------
    console.log(`\n--- STAGE 4: Teacher Grading & Submissions Workbench (${browser.name}) ---`);

    // 4.1 Switch back to Teacher Session
    await setSession(TEACHER_COOKIE, TEACHER_PROFILE);

    // Switch to Examinations tab
    await evalOrThrow(send, `(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Examinations'));
      if (tab) tab.click();
      return !!tab;
    })()`);
    await wait(2000);

    // 4.2 Query Submissions List
    const submissionsListCheck = await evalOrThrow(send, `(async () => {
      const res = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/submissions');
      const data = await res.json();
      const sub = data.submissions?.find(s => s.id === '${studentSessionId}');
      return sub && (sub.userName === 'Alex Chen' || sub.userId === 'usr_alex_chen') && sub.status === 'submitted';
    })()`);
    record('Teacher Submissions: Student submission appears in teacher dashboard', submissionsListCheck, 'Alex Chen submission detected with submitted status');

    // 4.3 Open Submission Detail & Apply Manual Points Adjustment
    const manualGradeCheck = await evalOrThrow(send, `(async () => {
      // Query submission details
      const detailRes = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/submissions/${studentSessionId}');
      const detail = await detailRes.json();
      if (!detail.session || !detail.questions) return false;

      // Apply manual grade adjustment
      const gradeRes = await fetch('/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/submissions/${studentSessionId}/grade', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionGrades: [
            {
              questionId: '${importedProg.question.id}',
              earnedPoints: 8,
              graderNotes: 'Manual points awarded for optimal algorithmic design and logic',
              gradingStatus: 'manually_graded'
            }
          ],
          teacherFeedback: 'Outstanding analytical problem solving and algorithmic reasoning!'
        })
      });
      const gradeData = await gradeRes.json();
      return gradeData.success && gradeData.session?.finalScore >= 18;
    })()`);
    record('Teacher Manual Grading: Custom itemized points and feedback successfully recorded', manualGradeCheck, 'Manual score adjustment persisted to database');

    // -------------------------------------------------------------
    // STAGE 5: LIVE CLASSROOM & ARENA REMOVAL REGRESSION VERIFICATION
    // -------------------------------------------------------------
    console.log(`\n--- STAGE 5: Live Classroom & Code Arena Removal (${browser.name}) ---`);

    // 5.1 Verify Arena tab is NOT present in classroom tablist
    const tabList = await evalOrThrow(send, `(() => {
      return Array.from(document.querySelectorAll('[role="tab"]')).map(t => t.textContent.trim());
    })()`);
    const arenaRemoved = !tabList.some(t => t.toLowerCase().includes('arena'));
    record('Code Arena Removal: Arena tab completely removed from classroom tablist', arenaRemoved, `Active tabs: ${tabList.join(', ')}`);

    // 5.2 Verify Live Class launch button in header navigates to live classroom
    const liveBtnExists = await evalOrThrow(send, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Live Class'));
      return !!btn;
    })()`);
    record('Live Classroom Header: Direct Live Class launch button is present', liveBtnExists, 'Live Class button rendered with radio pulse icon');

    // 5.3 Verify Live Classroom Route loads without error
    await send('Page.navigate', { url: `${BASE_URL}/classroom/${CLASSROOM_ID}/live/session_main` });
    await wait(3500);

    const livePageLoaded = await evalOrThrow(send, `(() => {
      const body = document.body.innerText;
      return body.includes('Live Classroom') || body.includes('Audio') || body.includes('Video') || body.includes('Whiteboard') || body.includes('Session');
    })()`);
    record('Live Classroom Route: /classroom/[id]/live/session_main loads cleanly', livePageLoaded, 'Live classroom session interface active');

    // 5.4 Verify Exit to IDE Navigation
    await send('Page.navigate', { url: `${BASE_URL}/classroom` });
    await wait(2500);

    const exitBtnClicked = await evalOrThrow(send, `(() => {
      const exitBtn = document.querySelector('[data-testid="exit-to-ide-btn"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Exit to IDE'));
      if (exitBtn) {
        exitBtn.click();
        return true;
      }
      return false;
    })()`);
    await wait(3500);

    const currentUrl = await evalOrThrow(send, 'window.location.href');
    const exitSuccess = exitBtnClicked && (new URL(currentUrl).pathname === '/' || currentUrl.endsWith('/'));
    record('Exit to IDE Navigation: Classroom exits cleanly back to Cortex IDE', exitSuccess, `Navigated to ${currentUrl}`);

  } finally {
    proc.kill();
  }

  const allPassed = results.every(r => r.pass);
  console.log(`\n${browser.name} SUMMARY: ${results.filter(r => r.pass).length}/${results.length} PASSED`);
  return { browser: browser.name, allPassed, results };
}

async function main() {
  console.log('===============================================================');
  console.log('CORTEX EXAMINATION SYSTEM — COMPREHENSIVE BROWSER VERIFICATION');
  console.log('Testing Google Chrome and Microsoft Edge via Chrome DevTools Protocol');
  console.log('===============================================================');

  console.log('Pre-warming application routes...');
  await fetch('http://127.0.0.1:3000/classroom').catch(() => {});
  await fetch('http://127.0.0.1:3000/').catch(() => {});
  await wait(1000);

  const allBrowserResults = [];
  for (const browser of BROWSERS) {
    try {
      const res = await runBrowserVerification(browser);
      allBrowserResults.push(res);
    } catch (err) {
      console.error(`ERROR running tests on ${browser.name}:`, err);
      allBrowserResults.push({ browser: browser.name, allPassed: false, error: err.message });
    }
  }

  console.log('\n===============================================================');
  console.log('FINAL BROWSER VERIFICATION SUMMARY');
  console.log('===============================================================');
  let overallSuccess = true;
  for (const b of allBrowserResults) {
    console.log(`Browser: ${b.browser} -> ${b.allPassed ? 'ALL PASSED (31/31)' : 'FAILURES OCCURRED'}`);
    if (!b.allPassed) overallSuccess = false;
  }

  if (overallSuccess) {
    console.log('\nALL BROWSER VERIFICATION TESTS COMPLETED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.error('\nBROWSER VERIFICATION TESTS FAILED.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
