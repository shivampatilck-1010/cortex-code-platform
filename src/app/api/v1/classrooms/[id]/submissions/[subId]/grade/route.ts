import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';
import { Grade, Feedback } from '@/lib/classroom/models';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const { id, subId } = await params;
    const user = ClassroomAuth.getCurrentUser(req);
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required to grade.' }, { status: 403 });
    }

    const submission = classroomDb.getSubmission(subId);
    if (!submission || submission.classroomId !== id) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const body = await req.json();
    const { finalScore, manualAdjustment, feedbackText, privateNotes, rubricScores, isDraft } = body;

    const computedFinal = finalScore !== undefined ? Number(finalScore) : submission.score;

    const grade: Grade = {
      id: `grd_${subId}`,
      submissionId: subId,
      studentId: submission.studentId,
      assignmentId: submission.assignmentId,
      automaticScore: submission.grade?.automaticScore ?? submission.score,
      manualAdjustment: manualAdjustment ? Number(manualAdjustment) : 0,
      finalScore: Math.min(submission.maxScore, Math.max(0, computedFinal)),
      gradedBy: user.id,
      gradedByName: user.name,
      gradedAt: Date.now(),
      releasedAt: isDraft ? undefined : Date.now(),
      rubricScores: rubricScores || submission.grade?.rubricScores,
    };

    classroomDb.saveGrade(grade);

    let feedbackRecord: Feedback | undefined;
    if ((feedbackText && feedbackText.trim()) || (privateNotes && privateNotes.trim())) {
      feedbackRecord = {
        id: `fbk_${subId}`,
        submissionId: subId,
        authorId: user.id,
        authorName: user.name,
        content: feedbackText?.trim() || '',
        privateNotes: privateNotes?.trim() || '',
        createdAt: submission.feedback?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      classroomDb.saveFeedback(feedbackRecord);
    }

    if (!isDraft) {
      // Broadcast Grade Update Live to Student & Teacher Dashboard
      realtimeCoordinator.broadcast(
        id,
        'grade.updated',
        {
          submissionId: subId,
          studentId: submission.studentId,
          assignmentId: submission.assignmentId,
          finalScore: grade.finalScore,
          gradedByName: user.name,
          feedback: feedbackRecord?.content,
        },
        { id: user.id, name: user.name }
      );

      // Notify student
      classroomDb.createNotification({
        id: `notif_${Date.now()}_${submission.studentId}`,
        userId: submission.studentId,
        classroomId: id,
        type: 'grade_released',
        title: 'Grade & Feedback Released',
        message: `Your score for ${submission.assignmentTitle} is ${grade.finalScore}/${submission.maxScore}`,
        data: { submissionId: subId, assignmentId: submission.assignmentId },
        createdAt: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      grade,
      feedback: feedbackRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update grade' }, { status: 500 });
  }
}
