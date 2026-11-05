import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { verifyLaunchGrant, getServerPepper, generateSubmissionReceipt, canonicalAnswerDigest, isSessionRevoked } from '@/lib/lockdown/security-policy';
import { isEntityRevoked } from '@/lib/lockdown/pilot-config';
import { gradeQuestionResponse } from '@/lib/classroom/exam-grader';
import { institutionalPolicyRegistry } from '@/lib/lockdown/institutional-policy';

/**
 * CORTEX LOCKDOWN - SERVER-AUTHORITATIVE SUBMISSION ENDPOINT
 *
 * Enforces:
 * 1. Dual Authentication: User session cookie OR x-cortex-lockdown-grant token.
 * 2. Immutable Candidate Binding: Mismatch between active student and token/session rejected.
 * 3. Server-Enforced Deadlines: Validates submission timestamp against session.expiresAt + 30s grace period.
 * 4. Idempotency & Safe Retries: Returns existing confirmed receipt for identical prior submissions.
 * 5. Replay & Duplicate Defense: Atomic status transition via CAS prevents race conditions.
 * 6. Cryptographic Receipt Generation: Server-derived HMAC-SHA256 receipt bound to pepper and answer digest.
 * 7. Durable Answer Sealing: Commits all final responses into exam_question_responses.
 *
 * Strictly zero emojis.
 */
export async function POST(req: NextRequest) {
  try {
    let authenticatedUserId: string | null = null;
    let grantExamId: string | null = null;
    let grantDeviceId: string | null = null;

    // 1. Authenticate via user session cookie
    try {
      const user = await ClassroomAuth.authenticateRequest(req);
      if (user && user.id) {
        authenticatedUserId = user.id;
      }
    } catch (_) {}

    // 2. Authenticate via cryptographic launch grant header or body parameter
    const body = await req.json().catch(() => ({}));
    const grantToken = req.headers.get('x-cortex-lockdown-grant') || body.launchGrant;
    if (grantToken) {
      const grantResult = verifyLaunchGrant(grantToken);
      if (grantResult.valid && grantResult.claims) {
        authenticatedUserId = grantResult.claims.sub;
        grantExamId = grantResult.claims.examId;
        grantDeviceId = grantResult.claims.deviceId;
      } else if (!authenticatedUserId) {
        return NextResponse.json({
          error: `Invalid or expired launch grant: ${grantResult.error || 'Signature verification failed'}`,
          code: 'GRANT_INVALID',
        }, { status: 401 });
      }
    }

    if (!authenticatedUserId) {
      return NextResponse.json({
        error: 'Authentication required via session cookie or valid x-cortex-lockdown-grant token',
        code: 'UNAUTHENTICATED',
      }, { status: 401 });
    }

    const { examId, sessionId, studentId, answers, sequenceNumber } = body;

    if (!examId || !sessionId) {
      return NextResponse.json({
        error: 'examId and sessionId are required parameters for examination submission',
        code: 'MISSING_PARAMETERS',
      }, { status: 400 });
    }

    // Strict subject binding check: prevent candidate impersonation
    const effectiveStudentId = studentId || authenticatedUserId;
    if (effectiveStudentId !== authenticatedUserId) {
      return NextResponse.json({
        error: `Submission rejected: Target student ID '${effectiveStudentId}' does not match authenticated identity '${authenticatedUserId}'`,
        code: 'SUBJECT_MISMATCH',
      }, { status: 403 });
    }

    // Cross-exam authorization check: ensure token belongs to requested exam
    if (grantExamId && grantExamId !== examId) {
      return NextResponse.json({
        error: `Launch grant was issued for exam '${grantExamId}', cannot be used to submit to '${examId}'`,
        code: 'EXAM_MISMATCH',
      }, { status: 403 });
    }

    if (isSessionRevoked(sessionId) || (await classroomDb.isSessionRevoked(sessionId)) || (await classroomDb.isTokenRevoked(sessionId))) {
      return NextResponse.json({
        error: `Submission rejected: Session '${sessionId}' has been revoked or terminated`,
        code: 'SESSION_REVOKED',
      }, { status: 403 });
    }

    // Verify revocation status
    const studentRevoked = isEntityRevoked('student', effectiveStudentId);
    if (studentRevoked.revoked) {
      return NextResponse.json({
        error: `Submission rejected: Candidate access has been revoked (${studentRevoked.record?.reason || 'Administrative action'})`,
        code: 'ACCESS_REVOKED',
      }, { status: 403 });
    }
    if (grantDeviceId) {
      const deviceRevoked = isEntityRevoked('device', grantDeviceId);
      if (deviceRevoked.revoked) {
        return NextResponse.json({
          error: `Submission rejected: Device has been revoked (${deviceRevoked.record?.reason || 'Hardware policy violation'})`,
          code: 'DEVICE_REVOKED',
        }, { status: 403 });
      }
    }

    // Verify session policy integrity hash
    const clientHash = body.policyHash || req.headers.get('x-cortex-lockdown-policy-hash');
    if (clientHash) {
      const policyVerification = institutionalPolicyRegistry.verifySessionPolicyIntegrity(sessionId, clientHash);
      if (!policyVerification.valid) {
        return NextResponse.json({
          error: policyVerification.reason || 'Client-side policy modifications are rejected.',
          code: policyVerification.errorCode || 'TAMPERED_POLICY_REJECTED',
        }, { status: 403 });
      }
    }

    const now = Date.now();
    const GRACE_PERIOD_MS = 30 * 1000; // 30-second network delivery grace period strictly for in-flight packet transport

    // 3. Retrieve or provision exam and session records
    const exam = await classroomDb.getExam(examId);
    let session = await classroomDb.getExamSession(sessionId);

    // If session does not exist in DB, provision it if within valid parameters
    if (!session) {
      const durationMs = (exam?.durationMinutes || 60) * 60 * 1000;
      try {
        session = await classroomDb.createExamSession({
          id: sessionId,
          examId,
          userId: effectiveStudentId,
          status: 'in_progress',
          startedAt: now - 60000,
          expiresAt: now + durationMs,
        });
      } catch (err: any) {
        // Concurrency defense: if concurrent requests raced, re-read created session
        session = await classroomDb.getExamSession(sessionId);
        if (!session) {
          const userSessions = await classroomDb.getUserExamSessions(examId, effectiveStudentId);
          session = userSessions.find((s) => s.id === sessionId) || userSessions[0];
        }
        if (!session) throw err;
      }
    }

    if (session.userId !== effectiveStudentId) {
      return NextResponse.json({
        error: 'Cannot submit an examination session belonging to another student',
        code: 'SESSION_FORBIDDEN',
      }, { status: 403 });
    }

    // 4. IDEMPOTENT SAFE RETRY & NETWORK INTERRUPTION RECOVERY
    // If the session has already been submitted by this candidate, return the existing confirmed receipt!
    if (session.status === 'submitted') {
      const existingReceipt = session.submissionReceipt || `CORTEX-SUB-${session.id.substring(0, 12).toUpperCase()}`;
      return NextResponse.json({
        success: true,
        idempotent: true,
        receipt: existingReceipt,
        submittedAt: session.submittedAt || now,
        status: 'submitted',
        message: 'Examination submission already confirmed by server (Idempotent safe retry).',
      });
    }

    if (session.status === 'timed_out' || session.status === 'cancelled') {
      return NextResponse.json({
        error: `Cannot submit a session with terminal status '${session.status}'`,
        status: session.status,
        code: 'INVALID_SESSION_STATUS',
      }, { status: 400 });
    }

    // 5. DEADLINE ENFORCEMENT WITH 30-SECOND GRACE PERIOD
    const isLate = session.expiresAt ? now > (session.expiresAt + GRACE_PERIOD_MS) : false;
    const finalStatus = isLate ? 'timed_out' : 'submitted';

    // 6. PERSIST QUESTION RESPONSES & CALCULATE DIGEST
    const answersObj = answers || {};
    let totalScore = 0;
    let questionsCount = 0;

    const questions = await classroomDb.listExamQuestions(examId);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    for (const [qId, ansVal] of Object.entries(answersObj)) {
      questionsCount++;
      const q = questionMap.get(qId);
      let earnedPoints = 0;
      let gradingStatus: any = 'pending';
      let graderNotes = '';

      if (q) {
        const gradeRes = gradeQuestionResponse(q, ansVal);
        earnedPoints = gradeRes.earnedPoints;
        gradingStatus = gradeRes.status;
        graderNotes = gradeRes.feedback || '';
        totalScore += earnedPoints;
      }

      await classroomDb.saveExamResponse({
        sessionId,
        questionId: qId,
        response: ansVal,
        earnedPoints,
        gradingStatus,
        graderNotes,
        updatedAt: now,
      });
    }

    // Compute canonical SHA-256 answer integrity digest using recursive key normalization
    const answerDigest = canonicalAnswerDigest(answersObj);

    // Generate server-authoritative submission receipt bound to server pepper, candidate, exam, timestamp, and answer digest
    const submissionReceipt = generateSubmissionReceipt({
      examId,
      studentId: effectiveStudentId,
      sessionId,
      submittedAt: now,
      answerDigest,
    });

    // 7. ATOMIC CONDITIONAL STATUS TRANSITION (CAS: expectedStatus = 'in_progress')
    const updatedSession = await classroomDb.updateExamSession(
      sessionId,
      {
        status: finalStatus,
        submittedAt: now,
        autoScore: Math.round(totalScore * 100) / 100,
        submissionReceipt,
        answerDigest,
      },
      'in_progress'
    );

    // If CAS failed (concurrent write won race), re-fetch and return confirmed receipt
    if (!updatedSession) {
      const currentSession = await classroomDb.getExamSession(sessionId);
      if (currentSession && currentSession.status === 'submitted') {
        return NextResponse.json({
          success: true,
          idempotent: true,
          receipt: currentSession.submissionReceipt || submissionReceipt,
          submittedAt: currentSession.submittedAt || now,
          status: 'submitted',
          message: 'Examination submission already confirmed by server.',
        });
      }
      return NextResponse.json({
        error: 'Concurrent submission conflict. Session is no longer in progress.',
        code: 'CONCURRENT_CONFLICT',
      }, { status: 409 });
    }

    // 8. LOG INTEGRITY AUDIT EVENT
    await classroomDb.createExamIntegrityEvent({
      id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      eventType: (isLate ? 'exam_submitted_late_timed_out' : 'exam_submitted_and_sealed') as any,
      timestamp: now,
      details: {
        examId,
        studentId: effectiveStudentId,
        deviceId: grantDeviceId || 'native_client',
        receipt: submissionReceipt,
        answerDigest,
        questionsAnswered: questionsCount,
        autoScore: totalScore,
      },
    });

    return NextResponse.json({
      success: true,
      receipt: submissionReceipt,
      submittedAt: now,
      status: finalStatus,
      answerDigest,
      questionsAnswered: questionsCount,
      autoScore: exam?.showResultsImmediately ? totalScore : null,
      message: isLate
        ? 'Examination submitted after deadline (recorded as timed out).'
        : 'Examination submitted successfully and cryptographically confirmed by server.',
    });
  } catch (err: any) {
    console.error('[LockdownSubmit] Error during server submission:', err);
    return NextResponse.json({
      error: err?.message || 'Server error during examination submission',
      code: 'SERVER_ERROR',
    }, { status: 500 });
  }
}
