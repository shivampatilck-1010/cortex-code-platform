import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const { id, subId } = await params;
    const user = ClassroomAuth.getCurrentUser(req);
    const auth = ClassroomAuth.verifyAccess(req, id);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const submission = classroomDb.getSubmission(subId);
    if (!submission || submission.classroomId !== id) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const isTeacher = auth.context?.membership?.role === 'teacher' || classroomDb.getClassroom(id)?.teacherId === user.id;

    // Student can only view their own submission
    if (!isTeacher && submission.studentId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to view this submission' }, { status: 403 });
    }

    // Filter hidden test cases for students
    if (!isTeacher && submission.testResults) {
      submission.testResults = submission.testResults.map(tr => {
        if (tr.visibility === 'hidden') {
          return {
            ...tr,
            input: 'Hidden',
            expectedOutput: 'Hidden',
            actualOutput: 'Hidden',
            error: tr.error ? 'Hidden test execution error' : undefined
          };
        }
        return tr;
      });
    }

    // Hide draft grades and private notes
    if (!isTeacher) {
      if (submission.grade && !submission.grade.releasedAt) {
        submission.grade = undefined;
        submission.feedback = undefined;
      }
      if (submission.feedback && submission.feedback.privateNotes) {
        delete submission.feedback.privateNotes;
      }
    }

    return NextResponse.json({ submission });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get submission' }, { status: 500 });
  }
}
