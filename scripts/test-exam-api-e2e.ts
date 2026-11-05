// Cortex Online Examination System — Phase 1 End-to-End API Integration Test Suite
// Verifies all REST API route handlers with authentic database sessions,
// strict teacher authorization, student access gates, and data sanitization.

import { NextRequest } from 'next/server';
import { classroomDb } from '../src/lib/classroom/db';
import * as ExamsRoute from '../src/app/api/v1/classrooms/[id]/exams/route';
import * as ExamDetailRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/route';
import * as PublishRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/publish/route';
import * as QuestionsRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/questions/route';
import * as QuestionDetailRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/questions/[qId]/route';
import * as StartRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/start/route';
import * as ResponsesRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/sessions/[sessionId]/responses/route';
import * as IntegrityRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/sessions/[sessionId]/integrity-event/route';
import * as SubmitRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/sessions/[sessionId]/submit/route';
import * as SubmissionsRoute from '../src/app/api/v1/classrooms/[id]/exams/[examId]/submissions/route';

async function main() {
  console.log('================================================================');
  console.log('CORTEX ONLINE EXAMINATION SYSTEM — API INTEGRATION TEST SUITE');
  console.log('Testing full API routes, security boundaries & auto-grading');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  const CLASSROOM_ID = 'C1-CS201-ADV';
  const TEACHER_USER_ID = 'usr_prof_elena';
  const STUDENT_USER_ID = 'usr_alex_chen';

  const TEACHER_SESSION_ID = `sess_token_teacher_${Date.now()}`;
  const STUDENT_SESSION_ID = `sess_token_student_${Date.now()}`;

  // Helper to create simulated NextRequests with cookie authentication
  function createReq(
    url: string,
    method: string,
    sessionCookie: string,
    body?: any
  ): NextRequest {
    const headers: Record<string, string> = {
      cookie: `cortex_session=${sessionCookie}`,
      'content-type': 'application/json',
    };
    const reqInit: RequestInit = {
      method,
      headers,
    };
    if (body) {
      reqInit.body = JSON.stringify(body);
    }
    return new NextRequest(new URL(url, 'http://localhost:3000'), reqInit);
  }

  try {
    // 0. Setup database sessions
    const now = Date.now();
    const expiry = now + 86400000; // 24 hours

    const db = await (classroomDb as any).getDb();
    await db.prepare('INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
      TEACHER_SESSION_ID,
      TEACHER_USER_ID,
      expiry,
      now
    );
    await db.prepare('INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
      STUDENT_SESSION_ID,
      STUDENT_USER_ID,
      expiry,
      now
    );

    console.log('Database sessions created for test execution.');

    let createdExamId = '';
    let q1Id = '';
    let q2Id = '';
    let createdSessionId = '';

    // Test 1: Student attempting to create an examination must receive 403 Forbidden
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams`,
        'POST',
        STUDENT_SESSION_ID,
        { title: 'Unauthorized Student Exam', durationMinutes: 60 }
      );
      const res = await ExamsRoute.POST(req, { params: Promise.resolve({ id: CLASSROOM_ID }) });
      assert(res.status === 403, 'Security Gate: Student blocked from creating examinations (403)');
    }

    // Test 2: Teacher creating a valid examination
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams`,
        'POST',
        TEACHER_SESSION_ID,
        {
          title: 'Algorithms Final Examination',
          description: 'Official Midterm Exam for Algorithms',
          durationMinutes: 45,
          startTime: now - 10000, // already open
          endTime: now + 3600000,
          totalMarks: 50,
          passingMarks: 20,
          attemptsAllowed: 1,
          securityLevel: 'restricted',
          status: 'draft',
        }
      );
      const res = await ExamsRoute.POST(req, { params: Promise.resolve({ id: CLASSROOM_ID }) });
      assert(res.status === 201, 'Teacher creates new examination successfully (201)');
      const data = await res.json();
      createdExamId = data.exam.id;
      assert(createdExamId.startsWith('exam_'), 'Exam ID properly formatted');
      assert(data.exam.status === 'draft', 'Initial status set to draft');
    }

    // Test 3: Student querying exams list must NOT see draft exams
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams`,
        'GET',
        STUDENT_SESSION_ID
      );
      const res = await ExamsRoute.GET(req, { params: Promise.resolve({ id: CLASSROOM_ID }) });
      assert(res.status === 200, 'Student queries exams list (200)');
      const data = await res.json();
      const hasDraft = (data.exams || []).some((e: any) => e.id === createdExamId);
      assert(!hasDraft, 'Security Gate: Student cannot view draft examinations in listing');
    }

    // Test 4: Student accessing draft exam directly must receive 403 Forbidden
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}`,
        'GET',
        STUDENT_SESSION_ID
      );
      const res = await ExamDetailRoute.GET(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res.status === 403, 'Security Gate: Student direct access to draft exam rejected (403)');
    }

    // Test 5: Teacher adds questions to the exam
    {
      // Add Q1: Single-Choice MCQ
      const req1 = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/questions`,
        'POST',
        TEACHER_SESSION_ID,
        {
          questionType: 'mcq_single',
          promptText: 'Which algorithm finds shortest paths in a graph with non-negative weights?',
          points: 5,
          negativeMarks: 1,
          options: [
            { id: 'opt_dijkstra', text: 'Dijkstra' },
            { id: 'opt_kruskal', text: 'Kruskal' },
            { id: 'opt_prim', text: 'Prim' },
          ],
          correctAnswer: { optionId: 'opt_dijkstra' },
        }
      );
      const res1 = await QuestionsRoute.POST(req1, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res1.status === 201, 'Teacher adds MCQ Single question (201)');
      const data1 = await res1.json();
      q1Id = data1.question.id;

      // Add Q2: Numerical with tolerance
      const req2 = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/questions`,
        'POST',
        TEACHER_SESSION_ID,
        {
          questionType: 'numerical',
          promptText: 'What is the sum of integers from 1 to 10 inclusive?',
          points: 5,
          numericalTolerance: 0.1,
          correctAnswer: { value: 55 },
        }
      );
      const res2 = await QuestionsRoute.POST(req2, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res2.status === 201, 'Teacher adds Numerical question (201)');
      const data2 = await res2.json();
      q2Id = data2.question.id;
    }

    // Test 6: Teacher updates exam state transition: invalid transition rejected
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}`,
        'PUT',
        TEACHER_SESSION_ID,
        { status: 'results_published' } // illegal jump from draft to results_published
      );
      const res = await ExamDetailRoute.PUT(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res.status === 400, 'State Machine Gate: Illegal transition rejected (400)');
    }

    // Test 7: Teacher publishes exam (valid transition: draft -> published)
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/publish`,
        'POST',
        TEACHER_SESSION_ID,
        { status: 'published' }
      );
      const res = await PublishRoute.POST(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res.status === 200, 'Teacher publishes examination (200)');
      const data = await res.json();
      assert(data.status === 'published', 'Exam status transitioned to published');
    }

    // Test 8: Student queries published exam: questions are strictly sanitized
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}`,
        'GET',
        STUDENT_SESSION_ID
      );
      const res = await ExamDetailRoute.GET(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res.status === 200, 'Student queries published exam (200)');
      const data = await res.json();
      assert(data.exam.questions.length === 2, 'Student receives 2 questions');

      // Verify sanitization
      for (const q of data.exam.questions) {
        assert(q.correctAnswer === undefined, `Privacy Gate: Question ${q.id} correctAnswer is stripped`);
        if (q.options) {
          q.options.forEach((opt: any) => {
            assert(opt.isCorrect === undefined, `Privacy Gate: Option ${opt.id} isCorrect flag is stripped`);
          });
        }
      }
    }

    // Test 9: Student starts exam session
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/start`,
        'POST',
        STUDENT_SESSION_ID
      );
      const res = await StartRoute.POST(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res.status === 201, 'Student starts exam session (201)');
      const data = await res.json();
      createdSessionId = data.session.id;
      assert(data.session.status === 'in_progress', 'Session is in_progress');
      assert(data.session.expiresAt > Date.now(), 'Server computed valid expiresAt');
    }

    // Test 10: Student autosaves answer to Q1
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/sessions/${createdSessionId}/responses`,
        'PUT',
        STUDENT_SESSION_ID,
        { questionId: q1Id, response: 'opt_dijkstra' }
      );
      const res = await ResponsesRoute.PUT(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId, sessionId: createdSessionId }),
      });
      assert(res.status === 200, 'Autosave answer to Q1 successful (200)');
    }

    // Test 11: Student records an integrity event (fullscreen departure)
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/sessions/${createdSessionId}/integrity-event`,
        'POST',
        STUDENT_SESSION_ID,
        { eventType: 'fullscreen_exit', details: { clientTimestamp: Date.now() } }
      );
      const res = await IntegrityRoute.POST(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId, sessionId: createdSessionId }),
      });
      assert(res.status === 200, 'Integrity event recorded in audit trail (200)');
    }

    // Test 12: Student final submission: auto-grading calculates correct scores
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/sessions/${createdSessionId}/submit`,
        'POST',
        STUDENT_SESSION_ID,
        {
          finalResponses: {
            [q1Id]: 'opt_dijkstra', // Correct MCQ: +5
            [q2Id]: 55,             // Correct Numerical: +5
          },
        }
      );
      const res = await SubmitRoute.POST(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId, sessionId: createdSessionId }),
      });
      assert(res.status === 200, 'Final submission succeeds (200)');
      const data = await res.json();
      assert(data.session.status === 'submitted', 'Session status locked to submitted');
    }

    // Test 13: Submitting again on a submitted session must be rejected (single attempt)
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/sessions/${createdSessionId}/submit`,
        'POST',
        STUDENT_SESSION_ID
      );
      const res = await SubmitRoute.POST(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId, sessionId: createdSessionId }),
      });
      assert(res.status === 400, 'Attempt Limit Gate: Second submit rejected on locked session (400)');
    }

    // Test 14: Teacher inspects submissions & integrity events
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}/submissions`,
        'GET',
        TEACHER_SESSION_ID
      );
      const res = await SubmissionsRoute.GET(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res.status === 200, 'Teacher inspects submissions list (200)');
      const data = await res.json();
      const sub = (data.submissions || []).find((s: any) => s.id === createdSessionId);
      assert(sub !== undefined, 'Student submission found in teacher dashboard');
      assert(sub.status === 'submitted', 'Student status is submitted');
      assert(sub.finalScore === 10, 'Student auto-graded final score is 10 (5 + 5)');
      assert(sub.integrityEventCount === 1, 'Integrity event count correctly reported as 1');
    }

    // Test 15: Clean up created test exam
    {
      const req = createReq(
        `http://localhost:3000/api/v1/classrooms/${CLASSROOM_ID}/exams/${createdExamId}`,
        'DELETE',
        TEACHER_SESSION_ID
      );
      const res = await ExamDetailRoute.DELETE(req, {
        params: Promise.resolve({ id: CLASSROOM_ID, examId: createdExamId }),
      });
      assert(res.status === 200, 'Teacher cleans up test examination (200)');
    }

    // Clean up temporary sessions
    await db.prepare('DELETE FROM sessions WHERE id IN (?, ?)').run(TEACHER_SESSION_ID, STUDENT_SESSION_ID);
    console.log('Temporary test sessions cleaned up.');

  } catch (err: any) {
    console.error('Unexpected exception during API test suite:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`TOTAL API TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal API test runner error:', err);
  process.exit(1);
});
