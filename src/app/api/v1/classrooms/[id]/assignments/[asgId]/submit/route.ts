import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';
import { runAssignmentTestCases, calculateCodeSimilarity } from '@/lib/classroom/tester';
import { Submission } from '@/lib/classroom/models';

const rateLimits = new Map<string, number>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; asgId: string }> }
) {
  try {
    const { id, asgId } = await params;
    const user = ClassroomAuth.getCurrentUser(req);
    const auth = ClassroomAuth.verifyAccess(req, id);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }
    if (auth.context?.membership?.role !== 'student' && user.role !== 'student') {
      return NextResponse.json({ error: 'Only students can submit assignment work.' }, { status: 403 });
    }

    const classroom = classroomDb.getClassroom(id);
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }
    if (classroom.status === 'archived') {
      return NextResponse.json({ error: 'Archived classrooms are read-only and do not accept submissions.' }, { status: 409 });
    }

    const assignment = classroomDb.getAssignment(asgId);
    if (!assignment || assignment.classroomId !== id) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const body = await req.json();
    const { code, language } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Submission code is required' }, { status: 400 });
    }

    const now = Date.now();

    // Rate Limiting
    const rateKey = `${id}_${asgId}_${user.id}`;
    const lastSub = rateLimits.get(rateKey);
    if (lastSub && now - lastSub < 5000) {
      return NextResponse.json({ 
        error: 'SUBMISSION_RATE_LIMITED', 
        message: 'Please wait a few seconds before submitting again.' 
      }, { status: 429 });
    }
    rateLimits.set(rateKey, now);

    const isLate = now > assignment.dueAt;

    if (isLate && !assignment.allowLateSubmission) {
      return NextResponse.json({ error: 'The deadline has passed and late submissions are not permitted.' }, { status: 400 });
    }





    const studentPrior = classroomDb.getStudentSubmission(asgId, user.id);
    const version = (studentPrior?.version || 0) + 1;

    if (assignment.attemptsAllowed > 0 && version > assignment.attemptsAllowed) {
      return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 400 });
    }

    // 1. Broadcast submission started
    realtimeCoordinator.broadcast(
      id,
      'submission.started',
      {
        assignmentId: asgId,
        studentId: user.id,
        studentName: user.name,
        timestamp: now,
      },
      { id: user.id, name: user.name }
    );

    // 2. Execute Automated Test Suite
    const executionStart = Date.now();
    const testOutcome = await runAssignmentTestCases(code, language || assignment.language, assignment.testCases || []);
    const executionComplete = Date.now();

    // 3. Compute score with late penalties if applicable
    let finalCalculatedScore = testOutcome.score;
    if (isLate && assignment.latePenaltyPercent > 0) {
      finalCalculatedScore = Math.max(0, finalCalculatedScore * (1 - assignment.latePenaltyPercent / 100));
    }

    // 4. Calculate similarity against other student submissions
    const existingSubs = classroomDb.listSubmissions(asgId);
    let maxSim = 0;
    let mostSimilarStudent = '';
    for (const priorSub of existingSubs) {
      if (priorSub.studentId !== user.id) {
        const sim = calculateCodeSimilarity(code, priorSub.code);
        if (sim > maxSim) {
          maxSim = sim;
          mostSimilarStudent = priorSub.studentName;
        }
      }
    }

    // 5. Persist Submission
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const submission: Submission = {
      id: submissionId,
      assignmentId: asgId,
      assignmentTitle: assignment.title,
      classroomId: id,
      studentId: user.id,
      studentName: user.name,
      code,
      language: language || assignment.language,
      version,
      status: 'completed',
      submittedAt: now,
      executionStartedAt: executionStart,
      executionCompletedAt: executionComplete,
      score: Math.round(finalCalculatedScore),
      maxScore: assignment.maxMarks,
      isLate,
      testResults: testOutcome.results,
      similarityScore: maxSim,
      similarStudentName: maxSim >= 50 ? mostSimilarStudent : undefined,
      grade: {
        id: `grd_${submissionId}`,
        submissionId,
        studentId: user.id,
        assignmentId: asgId,
        automaticScore: Math.round(finalCalculatedScore),
        manualAdjustment: 0,
        finalScore: Math.round(finalCalculatedScore),
        gradedBy: 'system',
        gradedByName: 'Cortex AutoGrader',
        gradedAt: executionComplete,
        releasedAt: executionComplete,
      },
    };

    classroomDb.saveSubmission(submission);

    // 6. Broadcast Real-Time Update to Teacher and Class
    realtimeCoordinator.broadcast(
      id,
      'submission.completed',
      {
        submission: {
          id: submission.id,
          assignmentId: submission.assignmentId,
          studentId: submission.studentId,
          studentName: submission.studentName,
          score: submission.score,
          maxScore: submission.maxScore,
          status: submission.status,
          submittedAt: submission.submittedAt,
          isLate: submission.isLate,
        },
      },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({
      success: true,
      submission,
      testOutcome,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Submission failed' }, { status: 500 });
  }
}
