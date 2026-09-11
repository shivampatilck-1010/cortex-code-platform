import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

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
    const isTeacher = auth.context?.membership?.role === 'teacher' || classroom?.teacherId === user.id;

    // Get all assignments for the classroom to form the columns
    let assignments = classroomDb.listAssignments(id);
    
    // Hide un-published assignments from students
    if (!isTeacher) {
      assignments = assignments.filter(a => a.status === 'published' || a.status === 'closed');
    }

    // Get members
    let members = classroomDb.listMembers(id);
    // Student sees only themselves
    if (!isTeacher) {
      members = members.filter(m => m.userId === user.id);
    } else {
      // Teacher only sees students in the rows
      members = members.filter(m => m.role === 'student');
    }

    // Get all submissions for the classroom
    let submissions = classroomDb.listSubmissionsForClassroom(id);

    // If student, filter submissions
    if (!isTeacher) {
      submissions = submissions.filter(s => s.studentId === user.id);
      
      // Hide drafts
      submissions = submissions.map(s => {
        if (s.grade && !s.grade.releasedAt) {
          s.grade = undefined;
        }
        return s;
      });
    }

    // Construct gradebook grid data
    // rows: array of { student: member, scores: { [asgId]: submission_data } }
    
    // Sort assignments by created at
    assignments.sort((a, b) => a.createdAt - b.createdAt);

    const rows = members.map(student => {
      const scores: Record<string, any> = {};
      
      for (const asg of assignments) {
        // Find best or latest submission? In this simple model, we just find the student's latest submission for the assignment
        // Since listSubmissions returns all, we should get the one with the highest version
        const studentSubs = submissions.filter(s => s.assignmentId === asg.id && s.studentId === student.userId);
        if (studentSubs.length > 0) {
          studentSubs.sort((a, b) => b.version - a.version);
          const latestSub = studentSubs[0];
          scores[asg.id] = {
            submitted: true,
            submissionId: latestSub.id,
            score: latestSub.score,
            finalScore: latestSub.grade?.finalScore,
            isGraded: !!latestSub.grade?.releasedAt,
            isLate: latestSub.isLate
          };
        } else {
          scores[asg.id] = {
            submitted: false
          };
        }
      }

      return {
        student,
        scores
      };
    });

    return NextResponse.json({
      assignments: assignments.map(a => ({ id: a.id, title: a.title, maxMarks: a.maxMarks })),
      rows
    });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get gradebook' }, { status: 500 });
  }
}
