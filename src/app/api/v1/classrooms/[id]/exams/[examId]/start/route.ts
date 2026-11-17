import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import {
  sanitizeExamForStudent,
  generateSessionQuestionOrder,
  generateSessionOptionOrder,
} from '@/lib/classroom/exam-sanitizer';
import {
  verifySafeExamBrowserRequest,
  verifyAndConsumeSebLaunchToken,
  createSebLaunchToken,
} from '@/lib/classroom/seb-security';
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

    if (!exam || (exam.classroomId !== id && exam.classroomId !== id.toUpperCase().trim() && exam.classroomId.toLowerCase() !== id.toLowerCase().trim())) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    // Prohibit starting draft examinations
    if (exam.status === 'draft') {
      return NextResponse.json({ error: 'This examination is currently a draft and cannot be started' }, { status: 403 });
    }

    // Strict Safe Exam Browser (SEB) cryptographic verification
    if (exam.securityLevel === 'seb' || (exam.securityLevel as string) === 'seb_required') {
      // Support client-forwarded JS API keys (window.SafeExamBrowser.security.updateKeys)
      const clientConfigKey = req.headers.get('x-seb-client-config-key') || undefined;
      const clientBrowserExamKey = req.headers.get('x-seb-client-browser-exam-key') || undefined;

      const sebResult = verifySafeExamBrowserRequest(req, exam, {
        clientConfigKey,
        clientBrowserExamKey,
        authoritative: true,
      });

      if (!sebResult.verified) {
        const fwdProto = req.headers.get('x-forwarded-proto');
        const fwdHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host || 'localhost:3000';
        const proto = (fwdProto || '').toLowerCase() === 'https' ? 'https' : (req.nextUrl.protocol.replace(':', '') || 'http');
        const origin = `${proto}://${fwdHost.trim()}`;

        // Generate fresh single-use launch token for the student setup gate
        const launchToken = createSebLaunchToken({
          userId: user.id,
          assessmentId: exam.id,
          assessmentType: 'exam',
          classroomId: id,
          durationMinutes: exam.durationMinutes,
        });

        const configUrl = `/api/v1/classrooms/${encodeURIComponent(id)}/exams/${encodeURIComponent(examId)}/seb-config?launchToken=${encodeURIComponent(launchToken)}`;
        const fullConfigUrl = `${origin}${configUrl}`;
        const protocolUri = fullConfigUrl.replace(/^http:\/\//i, 'seb://').replace(/^https:\/\//i, 'sebs://');

        return NextResponse.json({
          error: 'Safe Exam Browser is required for this examination. A genuine, cryptographically verified Safe Exam Browser session must be used.',
          sebRequired: true,
          verificationReason: sebResult.reason,
          downloadUrl: 'https://safeexambrowser.org/download_en.html',
          configUrl,
          protocolUri,
          launchToken,
        }, { status: 403 });
      }

      // Extract and validate single-use launch token on verified requests
      let launchToken =
        req.headers.get('x-seb-launch-token') ||
        req.nextUrl.searchParams.get('launchToken') ||
        req.nextUrl.searchParams.get('sebToken');

      if (!launchToken) {
        try {
          const clonedReq = req.clone();
          const body = await clonedReq.json();
          if (body && typeof body.launchToken === 'string') {
            launchToken = body.launchToken;
          } else if (body && typeof body.sebToken === 'string') {
            launchToken = body.sebToken;
          }
        } catch (_) {}
      }

      // If initializing a new session, consume and validate launch token
      if (launchToken) {
        const tokenValidation = await verifyAndConsumeSebLaunchToken(launchToken, {
          userId: user.id,
          assessmentId: exam.id,
          assessmentType: 'exam',
          classroomId: id,
        });
        if (!tokenValidation.valid) {
          return NextResponse.json({
            error: `Launch token validation failed: ${tokenValidation.reason || 'Invalid or replayed token'}`,
            sebRequired: true,
            tokenInvalid: true,
            reason: tokenValidation.reason,
          }, { status: 403 });
        }
      } else {
        // Allow session resumption for in-progress session without consuming a second token
        const existingSessions = await classroomDb.getUserExamSessions(examId, user.id);
        const hasActiveSession = existingSessions.some((s) => s.status === 'in_progress');
        if (!hasActiveSession) {
          return NextResponse.json({
            error: 'Missing single-use launch token for SEB-enforced examination.',
            sebRequired: true,
            tokenMissing: true,
          }, { status: 403 });
        }
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
        } catch (e) {
          console.warn('[Classroom Exam Start] Non-fatal error reading launchGrant body:', e instanceof Error ? e.message : String(e));
        }
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
