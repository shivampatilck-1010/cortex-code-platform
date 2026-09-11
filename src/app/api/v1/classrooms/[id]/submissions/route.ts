import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { Submission } from '@/lib/classroom/models';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = ClassroomAuth.getCurrentUser(req);
    const auth = ClassroomAuth.verifyAccess(req, id);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const classroom = classroomDb.getClassroom(id);
    const isTeacher = classroom?.teacherId === user.id || auth.context?.membership?.role === 'teacher';

    const assignmentId = req.nextUrl.searchParams.get('assignmentId');
    let submissions: Submission[] = assignmentId
      ? classroomDb.listSubmissions(assignmentId)
      : classroomDb.listSubmissionsForClassroom(id);

    // If student, filter to only their submissions
    if (!isTeacher) {
      submissions = submissions.filter((s: Submission) => s.studentId === user.id);
      
      // Remove draft grades and private notes
      submissions = submissions.map(s => {
        if (s.grade && !s.grade.releasedAt) {
          s.grade = undefined;
          s.feedback = undefined;
        }
        if (s.feedback && s.feedback.privateNotes) {
          delete s.feedback.privateNotes;
        }
        return s;
      });
    }

    return NextResponse.json({ submissions });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list submissions' }, { status: 500 });
  }
}
