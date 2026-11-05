import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import {
  sanitizeExamForStudent,
  generateSessionQuestionOrder,
  generateSessionOptionOrder,
} from '@/lib/classroom/exam-sanitizer';
import { verifySafeExamBrowserRequest } from '@/lib/classroom/seb-security';
import { verifyLaunchGrant } from '@/lib/lockdown/security-policy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const user = await ClassroomAuth.getCurrentUser(req);
    const exam = await classroomDb.getExam(examId);

    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    // Prohibit starting draft examinations
    if (exam.status === 'draft') {
      return NextResponse.json({ error: 'This examination is currently a draft and cannot be started' }, { status: 403 });
    }

    // Strict Safe Exam Browser (SEB) cryptographic verification
    if (exam.securityLevel === 'seb' || (exam.securityLevel as string) === 'seb_required') {
      const sebResult = verifySafeExamBrowserRequest(req, exam);
      if (!sebResult.verified) {
        return NextResponse.json({
          error: 'Safe Exam Browser is required for this examination. A genuine, cryptographically verified Safe Exam Browser session must be used.',
          sebRequired: true,
          verificationReason: sebResult.reason,
          downloadUrl: 'https://safeexambrowser.org',
          configUrl: `/api/v1/classrooms/${id}/exams/${examId}/seb-config`,
        }, { status: 403 });
      }
    }

    // Strict Cortex Lockdown application verification for restricted examinations
    if (exam.securityLevel === 'restricted') {
      let grantToken = req.headers.get('x-cortex-lockdown-grant') || req.nextUrl.searchParams.get('launchGrant');
      if (!grantToken) {
        try {
          const clonedReq = req.clone();
          const body = await clonedReq.json();
          if (body && typeof body.launchGrant === 'string') {
            grantToken = body.launchGrant;
          }
        } catch (_) {}
      }

      if (!grantToken) {
        return NextResponse.json({
          error: 'Cortex Lockdown is required for this examination. Please launch the exam from the official Cortex Lockdown application.',
          lockdownRequired: true,
          downloadUrl: '/lockdown',
        }, { status: 403 });
      }

      const grantVerification = verifyLaunchGrant(grantToken);
      if (!grantVerification.valid || !grantVerification.claims) {
        return NextResponse.json({
          error: `Cortex Lockdown verification failed: ${grantVerification.error || 'Invalid launch grant token'}.`,
          lockdownRequired: true,
          verificationReason: grantVerification.error,
        }, { status: 403 });
      }

      if (grantVerification.claims.sub !== user.id) {
        return NextResponse.json({
          error: 'Cortex Lockdown launch grant was issued for a different student account.',
          lockdownRequired: true,
          verificationReason: 'SUBJECT_MISMATCH',
        }, { status: 403 });
      }

      if (grantVerification.claims.examId !== examId) {
        return NextResponse.json({
          error: 'Cortex Lockdown launch grant was issued for a different examination.',
          lockdownRequired: true,
          verificationReason: 'EXAM_MISMATCH',
        }, { status: 403 });
      }
    }

    // Check student cohort assignment
    if (exam.assignedStudentIds && exam.assignedStudentIds.length > 0) {
      if (!exam.assignedStudentIds.includes(user.id)) {
        return NextResponse.json({ error: 'You are not assigned to this examination' }, { status: 403 });
      }
    }

    const now = Date.now();

    // Check start and end time windows
    if (now < exam.startTime) {
      return NextResponse.json({
        error: `Examination has not started yet. Starts at ${new Date(exam.startTime).toISOString()}`,
        startTime: exam.startTime,
        serverTime: now,
      }, { status: 400 });
    }

    if (now >= exam.endTime) {
      return NextResponse.json({
        error: `Examination window has closed. Closed at ${new Date(exam.endTime).toISOString()}`,
        endTime: exam.endTime,
        serverTime: now,
      }, { status: 400 });
    }

    // Check existing student sessions
    const sessions = await classroomDb.getUserExamSessions(examId, user.id);
    const existingActive = sessions.find((s) => s.status === 'in_progress');

    // 30-second network grace period
    const GRACE_PERIOD_MS = 30 * 1000;

    if (existingActive) {
      if (now <= existingActive.expiresAt + GRACE_PERIOD_MS) {
        // Resume active session
        const savedResponses = await classroomDb.listExamResponses(existingActive.id);
        const sanitizedExam = sanitizeExamForStudent(exam, user.id, existingActive);

        return NextResponse.json({
          session: existingActive,
          exam: sanitizedExam,
          serverTime: now,
          savedResponses,
          resumed: true,
        });
      } else {
        // Session expired, mark as timed_out
        await classroomDb.updateExamSession(existingActive.id, { status: 'timed_out' });
      }
    }

    // Check attempts limit
    const completedAttempts = sessions.filter((s) => s.status === 'submitted' || s.status === 'timed_out');
    if (completedAttempts.length >= exam.attemptsAllowed) {
      return NextResponse.json({
        error: `You have reached the maximum allowed attempts (${exam.attemptsAllowed}) for this examination`,
        attemptsUsed: completedAttempts.length,
        attemptsAllowed: exam.attemptsAllowed,
      }, { status: 400 });
    }

    // Compute absolute expiration
    const durationMs = exam.durationMinutes * 60 * 1000;
    const expiresAt = Math.min(now + durationMs, exam.endTime);
    const attemptNumber = completedAttempts.length + 1;

    // Generate authoritative attempt-level randomization
    let questionOrder: string[] | undefined = undefined;
    if (exam.shuffleQuestions && exam.questions && exam.questions.length > 1) {
      questionOrder = generateSessionQuestionOrder(exam.questions);
    } else if (exam.questions) {
      questionOrder = exam.questions.map((q) => q.id);
    }

    let optionOrder: Record<string, string[]> | undefined = undefined;
    if (exam.shuffleOptions && exam.questions) {
      optionOrder = generateSessionOptionOrder(exam.questions);
    }

    const firstSectionId = exam.sections && exam.sections.length > 0 ? exam.sections[0].id : null;
    const initialRoute = firstSectionId ? [firstSectionId] : [];

    let newSession;
    try {
      newSession = await classroomDb.createExamSession({
        examId,
        userId: user.id,
        attemptNumber,
        status: 'in_progress',
        startedAt: now,
        expiresAt,
        questionOrder,
        optionOrder,
        currentSectionId: firstSectionId,
        traversedRoute: initialRoute,
        lastHeartbeatAt: now,
      });
    } catch (createErr: any) {
      // Gracefully recover if a concurrent request / rapid double-click created the session
      const retrySessions = await classroomDb.getUserExamSessions(examId, user.id);
      const active = retrySessions.find((s) => s.status === 'in_progress');
      if (active) {
        const savedResponses = await classroomDb.listExamResponses(active.id);
        const sanitizedExam = sanitizeExamForStudent(exam, user.id, active);
        return NextResponse.json({
          session: active,
          exam: sanitizedExam,
          serverTime: now,
          savedResponses,
          resumed: true,
        });
      }
      throw createErr;
    }

    const sanitizedExam = sanitizeExamForStudent(exam, user.id, newSession);

    return NextResponse.json({
      session: newSession,
      exam: sanitizedExam,
      serverTime: now,
      savedResponses: [],
      resumed: false,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to start examination session' }, { status: 500 });
  }
}
