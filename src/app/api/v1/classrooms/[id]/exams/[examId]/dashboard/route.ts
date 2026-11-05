import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { authorizeRbacRequest, AuditRole } from '@/lib/lockdown/privacy-governance';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Authorization required' }, { status: 403 });
    }

    const user = await ClassroomAuth.getCurrentUser(req);
    const roleParam = req.headers.get('x-cortex-role') || (user?.role === 'admin' ? 'department_dean' : user?.role === 'teacher' ? 'faculty_lead' : 'student');
    const effectiveRole = roleParam as AuditRole;

    const rbac = authorizeRbacRequest(
      {
        actorId: user?.id || 'unknown',
        actorRole: effectiveRole,
        assignedExamIds: [examId],
        assignedClassroomIds: [id],
      },
      'ACCESS_LIVE_TELEMETRY',
      {
        resourceType: 'telemetry',
        targetExamId: examId,
        targetClassroomId: id,
      }
    );

    if (!rbac.authorized) {
      return NextResponse.json({
        error: rbac.message,
        errorCode: rbac.errorCode || 'FORBIDDEN',
      }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found in this classroom' }, { status: 404 });
    }

    const dashboardData = await classroomDb.getExamLiveDashboardData(id, examId);
    return NextResponse.json(dashboardData);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load live examination dashboard' }, { status: 500 });
  }
}
