/**
 * CORTEX ONLINE EXAMINATION SYSTEM
 * PHASE 4.0: POST-DEPLOYMENT AUTOMATED SMOKE TEST SUITE
 *
 * Verifies core edge worker routing, minimal health probes, synthetic teacher
 * account registration, classroom provisioning, Track A examination lifecycle,
 * student candidate answering, autosave persistence, final submission receipt,
 * and automated test data cleanup.
 *
 * SAFETY GUARDRAILS:
 * - Default execution targets staging ONLY.
 * - Production execution is HARD-LOCKED and fail-closed by default.
 * - Synthetic identities use isolated '@smoke-test.edu' domains with high-entropy run IDs.
 * - Created resources are tracked in memory and cleaned up permanently in teardown.
 *
 * Usage:
 *   npx tsx scripts/test-phase4-production-smoke.ts --target=staging
 *   npx tsx scripts/test-phase4-production-smoke.ts --target=local
 */

import { fetch } from 'undici';

const TARGET_ARG = process.argv.find((arg) => arg.startsWith('--target=')) || '--target=staging';
const TARGET_ENV = TARGET_ARG.split('=')[1].toLowerCase();

// Fail-closed Production Guardrail
if (TARGET_ENV === 'production') {
  const allowProd = process.env.ALLOW_PRODUCTION_SMOKE === 'true';
  if (!allowProd) {
    console.error('================================================================');
    console.error('FATAL PRODUCTION GUARDRAIL: PRODUCTION SMOKE EXECUTION BLOCKED');
    console.error('================================================================');
    console.error('Production execution is disabled by default to prevent unintended mutations.');
    console.error('To execute against production, explicit authorization is required via:');
    console.error('  ALLOW_PRODUCTION_SMOKE=true npx tsx scripts/test-phase4-production-smoke.ts --target=production');
    console.error('Deployment execution remains paused at the Human Authorization Gate.');
    process.exit(1);
  }
}

const BASE_URLS: Record<string, string> = {
  staging: 'https://cortex-code-platform-staging.cortexbuild1.workers.dev',
  production: 'https://cortex-code-platform.cortexbuild1.workers.dev',
  local: 'http://localhost:3000',
};

const BASE_URL = BASE_URLS[TARGET_ENV] || BASE_URLS.staging;

interface AssertionResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
  durationMs?: number;
}

const results: AssertionResult[] = [];

function assert(condition: boolean, suite: string, name: string, detail?: string) {
  results.push({
    suite,
    name,
    passed: Boolean(condition),
    message: detail,
  });
  const tag = condition ? '[PASS]' : '[FAIL]';
  console.log(`${tag} [${suite}] ${name}${detail ? ` (${detail})` : ''}`);
}

async function api(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data, headers: res.headers };
}

async function runSmokeSuite() {
  console.log('================================================================');
  console.log('PHASE 4.0: POST-DEPLOYMENT SMOKE TEST SUITE');
  console.log(`Target Environment: ${TARGET_ENV.toUpperCase()} (${BASE_URL})`);
  console.log('================================================================\n');

  // Tracked Test Resources for Safe Cleanup
  const tracker = {
    classroomId: '',
    examId: '',
    teacherEmail: '',
    studentEmail: '',
    teacherCookie: '',
  };

  const timestamp = Date.now();
  const runEntropy = Math.random().toString(36).substring(2, 9);
  const runId = `${timestamp}_${runEntropy}`;

  try {
    // --- SMOKE 1: PUBLIC HEALTH PROBE ---
    console.log('--- SMOKE 1: EDGE WORKER & PUBLIC HEALTH PROBE ---');
    const t0 = Date.now();
    try {
      const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
      const healthDuration = Date.now() - t0;
      assert(healthRes.status === 200, 'HEALTH', 'Public health probe returns HTTP 200', `received: ${healthRes.status}`);

      const healthJson = (await healthRes.json()) as any;
      assert(healthJson.status === 'healthy', 'HEALTH', 'Health status is healthy', `status: ${healthJson.status}`);
      assert(Boolean(healthJson.timestamp), 'HEALTH', 'Timestamp is present');
      assert(!healthJson.checks, 'HEALTH', 'Internal subsystem telemetry shielded');
      assert(!healthJson.environment, 'HEALTH', 'Environment tier shielded');
      assert(healthDuration < 2000, 'HEALTH', 'Health response latency within budget', `${healthDuration}ms`);
    } catch (err: any) {
      assert(false, 'HEALTH', 'Health probe reached without network error', err.message);
    }

    // --- SMOKE 2: SYNTHETIC TEACHER PROVISIONING ---
    console.log('\n--- SMOKE 2: SYNTHETIC TEACHER PROVISIONING ---');
    tracker.teacherEmail = `smoke_prof_${runId}@smoke-test.edu`;
    const password = `SmokePass!${runEntropy}`;

    const regRes = await api('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: `Smoke Instructor ${runEntropy}`,
        email: tracker.teacherEmail,
        cortexId: `p_smk_${runEntropy.substring(0, 6)}`,
        password,
        confirmPassword: password,
        role: 'teacher',
        inviteCode: 'cortex-prof-2026',
      }),
    });

    assert(regRes.status === 200 || regRes.status === 201, 'TEACHER', 'Teacher registered successfully', `status: ${regRes.status}`);
    tracker.teacherCookie = regRes.headers.get('set-cookie') || '';
    assert(Boolean(tracker.teacherCookie), 'TEACHER', 'Session cookie issued');

    // Create Classroom
    const roomRes = await api('/api/v1/classrooms', {
      method: 'POST',
      headers: { Cookie: tracker.teacherCookie },
      body: JSON.stringify({
        name: `Smoke Classroom ${runEntropy}`,
        subject: 'Automated Post-Deploy Verification',
        courseCode: `SMK-${runEntropy.substring(0, 4).toUpperCase()}`,
        academicYear: '2026-2027',
        section: 'A',
        joinEnabled: true,
        settings: {},
      }),
    });

    assert(roomRes.status === 200 || roomRes.status === 201, 'TEACHER', 'Classroom provisioned', `status: ${roomRes.status}`);
    const room = roomRes.data.classroom || roomRes.data;
    tracker.classroomId = room.id;
    const joinCode = room.joinCode || room.joincode;
    assert(Boolean(tracker.classroomId), 'TEACHER', 'Classroom UUID generated');
    assert(Boolean(joinCode), 'TEACHER', 'Join code generated', joinCode);

    // Create Examination
    const examRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams`, {
      method: 'POST',
      headers: { Cookie: tracker.teacherCookie },
      body: JSON.stringify({
        title: `Smoke Assessment ${runEntropy}`,
        description: 'Automated post-deployment smoke examination',
        durationMinutes: 30,
        passingMarks: 50,
        showResultsImmediately: true,
      }),
    });

    assert(examRes.status === 200 || examRes.status === 201, 'TEACHER', 'Examination created', `status: ${examRes.status}`);
    const exam = examRes.data.exam || examRes.data;
    tracker.examId = exam.id;
    assert(Boolean(tracker.examId), 'TEACHER', 'Examination UUID generated');

    // Add Section
    const secRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams/${tracker.examId}/sections`, {
      method: 'POST',
      headers: { Cookie: tracker.teacherCookie },
      body: JSON.stringify({
        title: 'Smoke Section',
        description: 'Verification questions',
        sortOrder: 1,
      }),
    });
    const section = secRes.data.section || secRes.data;

    // Add Question
    const qRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams/${tracker.examId}/questions`, {
      method: 'POST',
      headers: { Cookie: tracker.teacherCookie },
      body: JSON.stringify({
        sectionId: section.id,
        questionType: 'mcq_single',
        promptText: 'What is the capital of France?',
        points: 10,
        sortOrder: 1,
        options: [
          { text: 'Paris', isCorrect: true },
          { text: 'London', isCorrect: false },
          { text: 'Berlin', isCorrect: false },
          { text: 'Madrid', isCorrect: false },
        ],
      }),
    });

    assert(qRes.status === 200 || qRes.status === 201, 'TEACHER', 'Question added to exam', `status: ${qRes.status}`);
    const question = qRes.data.question || qRes.data;
    const questionId = question.id;

    // Publish Examination
    const pubRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams/${tracker.examId}/publish`, {
      method: 'POST',
      headers: { Cookie: tracker.teacherCookie },
      body: JSON.stringify({ status: 'published' }),
    });

    assert(pubRes.status === 200, 'TEACHER', 'Examination published', `status: ${pubRes.status}`);

    // --- SMOKE 3: SYNTHETIC STUDENT LIFECYCLE ---
    console.log('\n--- SMOKE 3: SYNTHETIC STUDENT LIFECYCLE ---');
    tracker.studentEmail = `smoke_student_${runId}@smoke-test.edu`;
    let studentCookie = '';
    let sessionId = '';

    const sRegRes = await api('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: `Smoke Student ${runEntropy}`,
        email: tracker.studentEmail,
        cortexId: `s_smk_${runEntropy.substring(0, 6)}`,
        password,
        confirmPassword: password,
        role: 'student',
      }),
    });

    assert(sRegRes.status === 200 || sRegRes.status === 201, 'STUDENT', 'Student registered', `status: ${sRegRes.status}`);
    studentCookie = sRegRes.headers.get('set-cookie') || '';
    assert(Boolean(studentCookie), 'STUDENT', 'Student session cookie issued');

    // Join Classroom
    const joinRes = await api('/api/v1/classrooms/join', {
      method: 'POST',
      headers: { Cookie: studentCookie },
      body: JSON.stringify({ joinCode }),
    });
    assert(joinRes.status === 200, 'STUDENT', 'Student joined classroom', `status: ${joinRes.status}`);

    // Start Exam Session
    const startRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams/${tracker.examId}/start`, {
      method: 'POST',
      headers: { Cookie: studentCookie },
    });

    assert(startRes.status === 200 || startRes.status === 201, 'STUDENT', 'Examination session started', `status: ${startRes.status}`);
    const session = startRes.data.session || startRes.data;
    sessionId = session.id;
    assert(Boolean(sessionId), 'STUDENT', 'Session attempt UUID generated');

    // Anti-Leaking Check on Questions
    const examDetailsRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams/${tracker.examId}`, {
      method: 'GET',
      headers: { Cookie: studentCookie },
    });
    assert(examDetailsRes.status === 200, 'STUDENT', 'Student exam view retrieved');
    const examData = examDetailsRes.data.exam || examDetailsRes.data;
    const questions = examData.questions || [];
    if (questions.length > 0) {
      const q = questions[0];
      const leakedKey = q.options?.some((opt: any) => opt.isCorrect !== undefined);
      assert(!leakedKey, 'STUDENT', 'Question answer keys scrubbed from student response');
    }

    // Autosave Answering
    const saveRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams/${tracker.examId}/sessions/${sessionId}/responses`, {
      method: 'PUT',
      headers: { Cookie: studentCookie },
      body: JSON.stringify({
        questionId,
        selectedOptions: ['Paris'],
        clientSequenceNumber: 1,
      }),
    });

    assert(saveRes.status === 200, 'STUDENT', 'Response autosaved successfully', `status: ${saveRes.status}`);

    // Heartbeat Telemetry
    const beatRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams/${tracker.examId}/sessions/${sessionId}/heartbeat`, {
      method: 'POST',
      headers: { Cookie: studentCookie },
      body: JSON.stringify({
        clientTimestamp: Date.now(),
        focusLostCount: 0,
        fullscreenExitCount: 0,
      }),
    });

    assert(beatRes.status === 200, 'STUDENT', 'Heartbeat acknowledged', `status: ${beatRes.status}`);

    // Final Submission
    const subRes = await api(`/api/v1/classrooms/${tracker.classroomId}/exams/${tracker.examId}/sessions/${sessionId}/submit`, {
      method: 'POST',
      headers: { Cookie: studentCookie },
      body: JSON.stringify({}),
    });

    assert(subRes.status === 200, 'STUDENT', 'Final submission accepted', `status: ${subRes.status}`);
    const subData = subRes.data;
    assert(
      Boolean(subData.submissionReceipt || subData.receipt || subData.session?.status === 'submitted' || subData.status === 'submitted'),
      'STUDENT',
      'Submission finalized and locked'
    );
  } finally {
    // --- SMOKE 4: TEARDOWN & SAFE CLEANUP ---
    console.log('\n--- SMOKE 4: AUTOMATED CLEANUP & RESOURCE PURGE ---');
    if (tracker.classroomId && tracker.teacherCookie) {
      try {
        const delRes = await api(`/api/v1/classrooms/${tracker.classroomId}?permanent=true`, {
          method: 'DELETE',
          headers: { Cookie: tracker.teacherCookie },
        });
        assert(delRes.status === 200, 'CLEANUP', 'Smoke test classroom permanently purged', `classroomId: ${tracker.classroomId}`);
      } catch (err: any) {
        console.error('Warning: Failed to purge smoke test classroom:', err.message);
      }
    }
  }

  // --- SUMMARY ---
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n================================================================');
  console.log(`SMOKE SUITE COMPLETED: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeSuite().catch((err) => {
  console.error('Smoke suite fatal error:', err);
  process.exit(1);
});
