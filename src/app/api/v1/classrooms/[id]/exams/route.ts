import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { Exam, ExamStatus, ExamSecurityLevel } from '@/lib/classroom/models';
import { sanitizeExamForStudent } from '@/lib/classroom/exam-sanitizer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const user = await ClassroomAuth.getCurrentUser(req);
    const isTeacher =
      user.role === 'admin' ||
      auth.context?.membership?.role === 'teacher' ||
      (await classroomDb.getClassroom(id))?.teacherId === user.id;

    const allExams = await classroomDb.listExams(id);

    if (isTeacher) {
      // Teachers receive full list of exams with administrative metadata
      return NextResponse.json({ exams: allExams });
    }

    // Students only receive active/published/ended exams they are assigned to
    const visibleExams: any[] = [];

    for (const exam of allExams) {
      // Exclude draft exams
      if (exam.status === 'draft') continue;

      // Check student cohort restriction
      if (exam.assignedStudentIds && exam.assignedStudentIds.length > 0) {
        if (!exam.assignedStudentIds.includes(user.id)) {
          continue; // Not assigned to this student
        }
      }

      // Check student's session history for this exam
      const sessions = await classroomDb.getUserExamSessions(exam.id, user.id);
      const activeSession = sessions.find((s) => s.status === 'in_progress');
      const latestSession = sessions[0] || null;

      // Sanitize questions if questions are attached
      const sanitized = sanitizeExamForStudent(exam, user.id);

      visibleExams.push({
        ...sanitized,
        studentState: {
          attemptsCount: sessions.length,
          attemptsRemaining: Math.max(0, exam.attemptsAllowed - sessions.length),
          activeSessionId: activeSession ? activeSession.id : null,
          hasActiveSession: !!activeSession,
          latestSessionStatus: latestSession ? latestSession.status : null,
          latestScore: exam.showResultsImmediately || exam.status === 'results_published'
            ? (latestSession ? latestSession.finalScore : null)
            : null,
          isSubmitted: latestSession ? latestSession.status === 'submitted' : false,
        },
      });
    }

    return NextResponse.json({ exams: visibleExams });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list examinations' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await ClassroomAuth.getCurrentUser(req);
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required to create examinations' }, { status: 403 });
    }

    const body = await req.json();

    // Field validation
    const title = (body.title || '').trim();
    if (!title || title.length < 3) {
      return NextResponse.json({ error: 'Title is required and must be at least 3 characters' }, { status: 400 });
    }

    const durationMinutes = parseInt(body.durationMinutes, 10);
    if (isNaN(durationMinutes) || durationMinutes < 5 || durationMinutes > 600) {
      return NextResponse.json({ error: 'Duration must be between 5 and 600 minutes' }, { status: 400 });
    }

    const now = Date.now();
    const startTime = body.startTime ? parseInt(body.startTime, 10) : now;
    const endTime = body.endTime ? parseInt(body.endTime, 10) : now + durationMinutes * 60 * 1000 * 2;

    if (endTime <= startTime) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    const totalMarks = body.totalMarks !== undefined ? parseFloat(body.totalMarks) : 100;
    const passingMarks = body.passingMarks !== undefined ? parseFloat(body.passingMarks) : 40;
    if (passingMarks > totalMarks) {
      return NextResponse.json({ error: 'Passing marks cannot exceed total marks' }, { status: 400 });
    }

    const attemptsAllowed = body.attemptsAllowed !== undefined ? parseInt(body.attemptsAllowed, 10) : 1;
    if (isNaN(attemptsAllowed) || attemptsAllowed < 1 || attemptsAllowed > 10) {
      return NextResponse.json({ error: 'Attempts allowed must be between 1 and 10' }, { status: 400 });
    }

    const validSecurityLevels: ExamSecurityLevel[] = ['standard', 'restricted', 'seb'];
    const securityLevel: ExamSecurityLevel = validSecurityLevels.includes(body.securityLevel)
      ? body.securityLevel
      : 'standard';

    const validInitialStatuses: ExamStatus[] = ['draft', 'scheduled', 'published', 'active'];
    const status: ExamStatus = validInitialStatuses.includes(body.status) ? body.status : 'draft';

    const assignedStudentIds = Array.isArray(body.assignedStudentIds)
      ? body.assignedStudentIds.map((s: any) => String(s).trim()).filter(Boolean)
      : [];

    const exam = await classroomDb.createExam({
      classroomId: id,
      title,
      description: (body.description || '').trim(),
      durationMinutes,
      startTime,
      endTime,
      totalMarks,
      passingMarks,
      attemptsAllowed,
      securityLevel,
      sebConfigKey: body.sebConfigKey || null,
      sebBrowserExamKey: body.sebBrowserExamKey || null,
      sebQuitPassword: body.sebQuitPassword || null,
      sebAllowReload: !!body.sebAllowReload,
      sebShowReloadWarning: body.sebShowReloadWarning !== false,
      status,
      shuffleQuestions: !!body.shuffleQuestions,
      shuffleOptions: !!body.shuffleOptions,
      showResultsImmediately: !!body.showResultsImmediately,
      assignedStudentIds,
      createdBy: user.id,
    });

    return NextResponse.json({ exam }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create examination' }, { status: 500 });
  }
}
