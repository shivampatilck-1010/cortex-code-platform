import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { VALID_EXAM_TRANSITIONS, ExamStatus, ExamSecurityLevel } from '@/lib/classroom/models';
import { sanitizeExamForStudent } from '@/lib/classroom/exam-sanitizer';

export async function GET(
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
    const isTeacher =
      user.role === 'admin' ||
      auth.context?.membership?.role === 'teacher' ||
      (await classroomDb.getClassroom(id))?.teacherId === user.id;

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    if (isTeacher) {
      const { sebQuitPasswordHash, ...safeExam } = exam;
      return NextResponse.json({
        exam: {
          ...safeExam,
          hasQuitPassword: !!exam.hasQuitPassword || !!sebQuitPasswordHash,
        },
      });
    }

    // Student access validation
    if (exam.status === 'draft') {
      return NextResponse.json({ error: 'This examination is currently a draft and unavailable to students' }, { status: 403 });
    }

    if (exam.assignedStudentIds && exam.assignedStudentIds.length > 0) {
      if (!exam.assignedStudentIds.includes(user.id)) {
        return NextResponse.json({ error: 'You are not assigned to this examination' }, { status: 403 });
      }
    }

    // Student history & attempts
    const sessions = await classroomDb.getUserExamSessions(exam.id, user.id);
    const activeSession = sessions.find((s) => s.status === 'in_progress');
    const latestSession = sessions[0] || null;

    const sanitized = sanitizeExamForStudent(exam, user.id, activeSession);

    return NextResponse.json({
      exam: {
        ...sanitized,
        studentState: {
          attemptsCount: sessions.length,
          attemptsRemaining: Math.max(0, exam.attemptsAllowed - sessions.length),
          activeSessionId: activeSession ? activeSession.id : null,
          hasActiveSession: !!activeSession,
          latestSessionStatus: latestSession ? latestSession.status : null,
          latestScore: exam.showResultsImmediately || exam.status === 'results_published' || (latestSession && latestSession.isPublished)
            ? (latestSession ? latestSession.finalScore : null)
            : null,
          teacherFeedback: exam.showResultsImmediately || exam.status === 'results_published' || (latestSession && latestSession.isPublished)
            ? (latestSession ? latestSession.teacherFeedback : '')
            : '',
          isSubmitted: latestSession ? latestSession.status === 'submitted' : false,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get examination' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const existing = await classroomDb.getExam(examId);
    if (!existing || existing.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const body = await req.json();

    // Validate state transition if status is changing
    if (body.status && body.status !== existing.status) {
      const targetStatus: ExamStatus = body.status;
      const allowedTransitions = VALID_EXAM_TRANSITIONS[existing.status] || [];

      if (!allowedTransitions.includes(targetStatus)) {
        return NextResponse.json({
          error: `Invalid examination state transition from '${existing.status}' to '${targetStatus}'. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
        }, { status: 400 });
      }
    }

    // Validate timing if updated
    const startTime = body.startTime !== undefined ? parseInt(body.startTime, 10) : existing.startTime;
    const endTime = body.endTime !== undefined ? parseInt(body.endTime, 10) : existing.endTime;

    if (endTime <= startTime) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    const totalMarks = body.totalMarks !== undefined ? parseFloat(body.totalMarks) : existing.totalMarks;
    const passingMarks = body.passingMarks !== undefined ? parseFloat(body.passingMarks) : existing.passingMarks;

    if (passingMarks > totalMarks) {
      return NextResponse.json({ error: 'Passing marks cannot exceed total marks' }, { status: 400 });
    }

    const updated = await classroomDb.updateExam(examId, {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      durationMinutes: body.durationMinutes !== undefined ? parseInt(body.durationMinutes, 10) : undefined,
      startTime,
      endTime,
      totalMarks,
      passingMarks,
      attemptsAllowed: body.attemptsAllowed !== undefined ? parseInt(body.attemptsAllowed, 10) : undefined,
      securityLevel: body.securityLevel !== undefined ? body.securityLevel : undefined,
      status: body.status !== undefined ? body.status : undefined,
      shuffleQuestions: body.shuffleQuestions !== undefined ? !!body.shuffleQuestions : undefined,
      shuffleOptions: body.shuffleOptions !== undefined ? !!body.shuffleOptions : undefined,
      showResultsImmediately: body.showResultsImmediately !== undefined ? !!body.showResultsImmediately : undefined,
      assignedStudentIds: body.assignedStudentIds !== undefined ? body.assignedStudentIds : undefined,
      sebConfigKey: body.sebConfigKey !== undefined ? body.sebConfigKey : undefined,
      sebBrowserExamKey: body.sebBrowserExamKey !== undefined ? body.sebBrowserExamKey : undefined,
      sebQuitPassword: body.sebQuitPassword !== undefined ? body.sebQuitPassword : undefined,
      sebAllowReload: body.sebAllowReload !== undefined ? !!body.sebAllowReload : undefined,
      sebShowReloadWarning: body.sebShowReloadWarning !== undefined ? !!body.sebShowReloadWarning : undefined,
    });

    const { sebQuitPasswordHash, ...safeExam } = (updated || {}) as any;
    return NextResponse.json({
      exam: {
        ...safeExam,
        hasQuitPassword: !!updated?.hasQuitPassword || !!sebQuitPasswordHash,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update examination' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const existing = await classroomDb.getExam(examId);
    if (!existing || existing.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    await classroomDb.deleteExam(examId);
    return NextResponse.json({ success: true, message: 'Examination deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete examination' }, { status: 500 });
  }
}
