import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { authorizeRbacRequest, AuditRole } from '@/lib/lockdown/privacy-governance';
import { enforceTimeExtension } from '@/lib/lockdown/institutional-policy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; userId: string }> }
) {
  try {
    const { id, examId, userId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const teacher = await ClassroomAuth.getCurrentUser(req);
    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const sessions = await classroomDb.getUserExamSessions(examId, userId);
    const activeSession = sessions.find((s) => s.status === 'in_progress');

    if (!activeSession) {
      return NextResponse.json({ error: 'No active in-progress session found for this candidate' }, { status: 404 });
    }

    const body = await req.json();
    const additionalMinutes = parseInt(body.additionalMinutes, 10);
    if (isNaN(additionalMinutes) || additionalMinutes <= 0 || additionalMinutes > 120) {
      return NextResponse.json({ error: 'additionalMinutes must be between 1 and 120' }, { status: 400 });
    }

    const actorRole = (teacher.role === 'admin' ? 'department_dean' : 'faculty_lead') as AuditRole;
    const rbac = authorizeRbacRequest(
      {
        actorId: teacher.id,
        actorRole,
        assignedExamIds: [examId],
      },
      'AUTHORIZE_TIME_EXTENSION',
      {
        resourceType: 'session',
        targetExamId: examId,
        targetStudentId: userId,
        targetSessionId: activeSession.id,
      }
    );

    if (!rbac.authorized) {
      return NextResponse.json({
        error: rbac.message,
        errorCode: rbac.errorCode || 'FORBIDDEN',
      }, { status: 403 });
    }

    // Check institutional policy time multiplier limits
    const extensionCheck = enforceTimeExtension(activeSession.id, additionalMinutes, actorRole);
    if (!extensionCheck.allowed) {
      return NextResponse.json({
        error: extensionCheck.reason || 'Time extension disallowed by institutional exam policy',
        errorCode: 'POLICY_EXTENSION_EXCEEDED',
      }, { status: 403 });
    }

    const newExpiresAt = activeSession.expiresAt + (additionalMinutes * 60 * 1000);

    // 1. Audit trail event (In-table & Append-Only Hash Chain)
    await classroomDb.createExamIntegrityEvent({
      sessionId: activeSession.id,
      eventType: 'proctor_action',
      timestamp: Date.now(),
      details: {
        action: 'time_extension_granted',
        teacherId: teacher.id,
        teacherName: teacher.name,
        candidateUserId: userId,
        additionalMinutes,
        oldExpiresAt: activeSession.expiresAt,
        newExpiresAt,
      },
    });

    await classroomDb.appendLockdownAuditEntry({
      actorId: teacher.id,
      actorRole,
      action: 'AUTHORIZE_TIME_EXTENSION',
      resourceType: 'session',
      resourceId: activeSession.id,
      targetStudentId: userId,
      targetExamId: examId,
      outcome: 'GRANTED',
      reason: `Extended session by ${additionalMinutes} minutes`,
    });

    // 2. Update session expiration
    const updated = await classroomDb.updateExamSession(activeSession.id, {
      expiresAt: newExpiresAt,
    } as any);

    return NextResponse.json({
      success: true,
      message: `Granted ${additionalMinutes} additional minutes`,
      newExpiresAt,
      session: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to extend time' }, { status: 500 });
  }
}
