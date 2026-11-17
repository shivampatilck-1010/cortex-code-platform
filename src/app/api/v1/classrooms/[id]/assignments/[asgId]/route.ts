import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';
import { sanitizeBrandingTheme } from '@/lib/classroom/models';
import {
  verifySafeExamBrowserRequest,
  verifyAndConsumeSebLaunchToken,
  hashQuitPassword,
} from '@/lib/classroom/seb-security';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; asgId: string }> }
) {
  try {
    const { id, asgId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const assignment = await classroomDb.getAssignment(asgId);
    if (!assignment || (assignment.classroomId !== id && assignment.classroomId !== id.toUpperCase().trim() && assignment.classroomId.toLowerCase() !== id.toLowerCase().trim())) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const user = await ClassroomAuth.getCurrentUser(req);
    const classroom = await classroomDb.getClassroom(id);
    const isTeacher =
      user.role === 'admin' ||
      auth.context?.membership?.role === 'teacher' ||
      classroom?.teacherId === user.id;

    // Strict Safe Exam Browser (SEB) verification & problem statement redaction
    const isSebRequired =
      assignment.securityLevel === 'seb' ||
      (assignment.securityLevel as string) === 'seb_required' ||
      (assignment as any).security_level === 'seb';

    if (isSebRequired && !isTeacher) {
      const clientConfigKey = req.headers.get('x-seb-client-config-key') || undefined;
      const clientBrowserExamKey = req.headers.get('x-seb-client-browser-exam-key') || undefined;
      const sebVerify = verifySafeExamBrowserRequest(req, assignment, {
        clientConfigKey,
        clientBrowserExamKey,
        authoritative: true,
      });

      let hasValidToken = false;
      const rawToken =
        req.nextUrl.searchParams.get('launchToken') ||
        req.nextUrl.searchParams.get('sebToken') ||
        req.headers.get('x-seb-launch-token');

      if (rawToken) {
        const tokenResult = await verifyAndConsumeSebLaunchToken(rawToken, {
          userId: user.id,
          assessmentId: asgId,
          assessmentType: 'assignment',
          classroomId: id,
        });
        hasValidToken = tokenResult.valid;
      }

      if (!sebVerify.verified && !hasValidToken) {
        const redactedAssignment = {
          ...assignment,
          instructions: 'Safe Exam Browser is required to view this assignment.',
          starterCode: '',
          startercode: '',
          testCases: [],
        };
        return NextResponse.json({
          id: assignment.id,
          title: assignment.title,
          securityLevel: 'seb',
          sebRequired: true,
          downloadUrl: 'https://safeexambrowser.org/download_en.html',
          configUrl: `/api/v1/classrooms/${encodeURIComponent(id)}/assignments/${encodeURIComponent(asgId)}/seb-config`,
          instructions: 'Safe Exam Browser is required to view this assignment.',
          starterCode: '',
          testCases: [],
          assignment: redactedAssignment,
        }, { status: 403 });
      }
    }

    // Filter hidden test cases for students
    if (!isTeacher && assignment.testCases) {
      assignment.testCases = assignment.testCases.map((tc) => {
        const isHidden = tc.visibility === 'hidden' || (tc as any).isHidden === true || (tc as any).hidden === true;
        if (isHidden) {
          return {
            ...tc,
            visibility: 'hidden',
            isHidden: true,
            hidden: true,
            input: '[HIDDEN TEST CASE]',
            expectedOutput: '[HIDDEN TEST CASE]',
          };
        }
        return tc;
      });
    }

    return NextResponse.json({
      assignment,
      id: assignment.id,
      title: assignment.title,
      securityLevel: assignment.securityLevel || 'standard',
      instructions: assignment.instructions,
      starterCode: assignment.starterCode || (assignment as any).startercode || '',
      testCases: assignment.testCases,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get assignment' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; asgId: string }> }
) {
  try {
    const { id, asgId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      const status = auth.error?.includes('Authentication required') ? 401 : 403;
      return NextResponse.json({ error: auth.error || 'Teacher access required' }, { status });
    }

    const assignment = await classroomDb.getAssignment(asgId);
    if (!assignment || (assignment.classroomId !== id && assignment.classroomId !== id.toUpperCase().trim() && assignment.classroomId.toLowerCase() !== id.toLowerCase().trim())) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const updates = await req.json();

    // Mass assignment prevention: explicit writable field allowlist
    const allowedFields = [
      'title', 'description', 'instructions', 'starterCode', 'dueAt',
      'maxMarks', 'maxScore', 'attemptsAllowed', 'allowLateSubmission',
      'latePenaltyPercent', 'status', 'testCases', 'rubric', 'type', 'difficulty', 'language',
      'securityLevel', 'sebConfigKey', 'sebBrowserExamKey', 'sebQuitPassword',
      'sebQuitPasswordHash', 'sebAllowReload', 'sebShowReloadWarning',
      'durationMinutes', 'brandingTheme'
    ];
    const sanitizedUpdates: any = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (updates.sebQuitPassword && typeof updates.sebQuitPassword === 'string' && updates.sebQuitPassword.trim()) {
      sanitizedUpdates.sebQuitPasswordHash = hashQuitPassword(updates.sebQuitPassword.trim());
      sanitizedUpdates.hasQuitPassword = true;
      sanitizedUpdates.sebQuitPassword = null;
    }

    if (updates.brandingTheme !== undefined) {
      sanitizedUpdates.brandingTheme = sanitizeBrandingTheme(updates.brandingTheme);
    }

    const updatedAssignment = {
      ...assignment,
      ...sanitizedUpdates,
      id: assignment.id, // IMMUTABLE
      classroomId: assignment.classroomId, // IMMUTABLE
      createdBy: assignment.createdBy, // IMMUTABLE
      createdAt: assignment.createdAt, // IMMUTABLE
      updatedAt: Date.now()
    };

    await classroomDb.createAssignment(updatedAssignment);
    
    realtimeCoordinator.broadcast(
      id,
      'assignment.updated',
      { assignment: updatedAssignment },
      { id: auth.context!.user.id, name: auth.context!.user.name }
    );

    return NextResponse.json({ success: true, assignment: updatedAssignment });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update assignment' }, { status: 500 });
  }
}
