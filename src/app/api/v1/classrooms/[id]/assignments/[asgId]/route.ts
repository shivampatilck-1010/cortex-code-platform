import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; asgId: string }> }
) {
  try {
    const { id, asgId } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const assignment = classroomDb.getAssignment(asgId);
    if (!assignment || assignment.classroomId !== id) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const user = ClassroomAuth.getCurrentUser(req);
    const isTeacher = auth.context?.membership?.role === 'teacher' || classroomDb.getClassroom(id)?.teacherId === user.id;

    // Filter hidden test cases for students
    if (!isTeacher) {
      assignment.testCases = assignment.testCases.map(tc => {
        if (tc.visibility === 'hidden') {
          return {
            ...tc,
            input: 'Hidden',
            expectedOutput: 'Hidden'
          };
        }
        return tc;
      });
    }

    return NextResponse.json({ assignment });
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
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Teacher access required' }, { status: 403 });
    }

    const assignment = classroomDb.getAssignment(asgId);
    if (!assignment || assignment.classroomId !== id) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const updates = await req.json();
    const updatedAssignment = {
      ...assignment,
      ...updates,
      updatedAt: Date.now()
    };

    classroomDb.createAssignment(updatedAssignment);
    
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
