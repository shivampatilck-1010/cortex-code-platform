import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Teacher authorization required to view examination analytics' },
        { status: 403 }
      );
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found in this classroom' }, { status: 404 });
    }

    const analytics = await classroomDb.getExamAnalytics(id, examId);

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format');

    if (format === 'csv') {
      const csvLines = [
        'Metric,Value',
        `Examination Title,"${analytics.examTitle.replace(/"/g, '""')}"`,
        `Classroom ID,${analytics.classroomId}`,
        `Total Candidates,${analytics.totalCandidates}`,
        `Started Count,${analytics.startedCount}`,
        `Submitted Count,${analytics.submittedCount}`,
        `Absent Count,${analytics.absentCount}`,
        `Completion Rate (%),${analytics.completionRate}`,
        `Passed Count,${analytics.passedCount}`,
        `Failed Count,${analytics.failedCount}`,
        `Pass Rate (%),${analytics.passRate}`,
        `Fail Rate (%),${analytics.failRate}`,
        `Average Score,${analytics.averageScore}`,
        `Median Score,${analytics.medianScore}`,
        `Highest Score,${analytics.highestScore}`,
        `Lowest Score,${analytics.lowestScore}`,
        `Grading Complete,${analytics.gradingCompletion.isGradingComplete}`,
        `Pending Manual Questions,${analytics.gradingCompletion.pendingManualCount}`,
        '',
        'Question ID,Max Points,Attempts,Correct Count,Avg Earned Points,Accuracy Rate (%)',
        ...analytics.questionPerformance.map(
          (q) =>
            `${q.questionId},${q.maxPoints},${q.attemptCount},${q.correctCount},${q.averageEarnedPoints},${q.accuracyRate}`
        ),
      ];

      return new NextResponse(csvLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="exam_analytics_${examId}.csv"`,
        },
      });
    }

    return NextResponse.json(analytics);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load examination analytics' },
      { status: 500 }
    );
  }
}
