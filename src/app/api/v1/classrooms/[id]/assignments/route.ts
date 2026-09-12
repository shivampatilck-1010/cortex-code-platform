import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';
import { Assignment } from '@/lib/classroom/models';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }
    
    const user = ClassroomAuth.getCurrentUser(req);
    const isTeacher = auth.context?.membership?.role === 'teacher' || classroomDb.getClassroom(id)?.teacherId === user.id;

    let assignments = classroomDb.listAssignments(id);
    
    // Strip hidden test cases for students
    if (!isTeacher) {
      assignments = assignments.map(a => {
        const assignment = JSON.parse(JSON.stringify(a)) as Assignment;
        const sanitizedTestCases = (assignment.testCases || []).map((tc: any) => {
          const isHidden = tc.visibility === 'hidden' || tc.isHidden === true || tc.hidden === true;
          if (isHidden) {
            return {
              ...tc,
              visibility: 'hidden',
              isHidden: true,
              hidden: true,
              input: '[HIDDEN TEST CASE]',
              expectedOutput: '[HIDDEN TEST CASE]'
            };
          }
          return tc;
        });
        return {
          ...assignment,
          testCases: sanitizedTestCases
        };
      });
    }

    return NextResponse.json({ assignments });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get assignments' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = ClassroomAuth.getCurrentUser(req);
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required to create assignments.' }, { status: 403 });
    }
    const classroom = classroomDb.getClassroom(id);
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }
    if (classroom.status === 'archived') {
      return NextResponse.json({ error: 'Archived classrooms are read-only.' }, { status: 409 });
    }

    const body = await req.json();
    const {
      title,
      description,
      instructions,
      type,
      difficulty,
      language,
      starterCode,
      dueAt,
      maxMarks,
      attemptsAllowed,
      allowLateSubmission,
      latePenaltyPercent,
      autoGrade,
      manualGrade,
      aiPolicy,
      plagiarismPolicy,
      testCases,
      rubric,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Assignment title is required' }, { status: 400 });
    }

    const assignmentId = `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const assignment: Assignment = {
      id: assignmentId,
      classroomId: id,
      title: title.trim(),
      description: description || '',
      instructions: instructions || 'Complete the task according to the specifications provided.',
      type: (type as any) || 'code',
      language: language || 'cpp',
      starterCode: starterCode || '// Write your solution here\n',
      difficulty: difficulty || 'Intermediate',
      maxMarks: maxMarks || 100,
      dueAt: dueAt || Date.now() + 7 * 24 * 3600 * 1000,
      publishedAt: Date.now(),
      attemptsAllowed: attemptsAllowed || 3,
      allowLateSubmission: allowLateSubmission !== undefined ? Boolean(allowLateSubmission) : true,
      latePenaltyPercent: latePenaltyPercent !== undefined ? Number(latePenaltyPercent) : 10,
      autoGrade: autoGrade !== undefined ? Boolean(autoGrade) : true,
      manualGrade: manualGrade !== undefined ? Boolean(manualGrade) : false,
      aiPolicy: (aiPolicy as any) || 'hints_only',
      plagiarismPolicy: (plagiarismPolicy as any) || 'review_only',
      status: 'published',
      createdBy: user.id,
      testCases: testCases || [
        {
          id: `tc_1`,
          input: '5',
          expectedOutput: '120',
          isHidden: false,
          points: 50,
          description: 'Basic sample test case',
          timeoutMs: 2000,
          memoryLimitMb: 128,
        },
      ],
      rubric: rubric || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    classroomDb.createAssignment(assignment);

    // Broadcast assignment.created event
    realtimeCoordinator.broadcast(
      id,
      'assignment.created',
      { assignment },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, assignment });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create assignment' }, { status: 500 });
  }
}
