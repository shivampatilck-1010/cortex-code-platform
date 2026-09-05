import { NextRequest, NextResponse } from 'next/server';
import { saveFeedback, getAllFeedback, FeedbackDiagnostics } from '@/lib/feedback/feedback-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      type = 'bug',
      title = 'Untitled Report',
      description = '',
      email = '',
      severity = 'medium',
      diagnostics = {},
      category,
    } = body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json(
        { error: 'Description is required to submit feedback or report a bug.' },
        { status: 400 }
      );
    }

    const validTypes = ['bug', 'error', 'feature', 'general'] as const;
    const feedbackType = validTypes.includes(type) ? type : 'bug';

    const validSeverities = ['low', 'medium', 'high', 'critical'] as const;
    const feedbackSeverity = validSeverities.includes(severity) ? severity : 'medium';

    const record = await saveFeedback({
      type: feedbackType,
      title: title.trim() || `${feedbackType.toUpperCase()} Report`,
      description: description.trim(),
      email: typeof email === 'string' ? email.trim() : undefined,
      severity: feedbackSeverity,
      category,
      diagnostics: diagnostics as FeedbackDiagnostics,
    });

    return NextResponse.json({
      success: true,
      id: record.id,
      record,
      message: record.emailDelivery?.sent
        ? `Report ${record.id} sent via email and preserved in database.`
        : `Report ${record.id} successfully recorded in database.`,
    });
  } catch (error: any) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const all = getAllFeedback();
    return NextResponse.json({
      success: true,
      count: all.length,
      feedback: all,
    });
  } catch (error: any) {
    console.error('Feedback retrieval error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve feedback records' },
      { status: 500 }
    );
  }
}
