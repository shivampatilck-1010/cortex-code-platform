import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; ruleId: string }> }
) {
  try {
    const { id, examId, ruleId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const rule = await classroomDb.getExamBranchingRule(ruleId);
    if (!rule || rule.examId !== examId) {
      return NextResponse.json({ error: 'Branching rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get branching rule' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; ruleId: string }> }
) {
  try {
    const { id, examId, ruleId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const existing = await classroomDb.getExamBranchingRule(ruleId);
    if (!existing || existing.examId !== examId) {
      return NextResponse.json({ error: 'Branching rule not found' }, { status: 404 });
    }

    const body = await req.json();
    const updated = await classroomDb.updateExamBranchingRule(ruleId, {
      sourceQuestionId: body.sourceQuestionId,
      conditionOperator: body.conditionOperator,
      conditionValue: body.conditionValue !== undefined ? String(body.conditionValue) : undefined,
      destinationType: body.destinationType,
      destinationId: body.destinationId,
      defaultDestinationType: body.defaultDestinationType,
      defaultDestinationId: body.defaultDestinationId,
      priority: typeof body.priority === 'number' ? body.priority : undefined,
    });

    // Check cycles
    const validation = await classroomDb.validateBranchingRules(examId);
    if (!validation.valid) {
      return NextResponse.json({
        warning: `Branching rule saved with validation errors: ${validation.errors.join('; ')}`,
        rule: updated,
        validation,
      });
    }

    return NextResponse.json({ rule: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update branching rule' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; ruleId: string }> }
) {
  try {
    const { id, examId, ruleId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const existing = await classroomDb.getExamBranchingRule(ruleId);
    if (!existing || existing.examId !== examId) {
      return NextResponse.json({ error: 'Branching rule not found' }, { status: 404 });
    }

    await classroomDb.deleteExamBranchingRule(ruleId);
    return NextResponse.json({ success: true, message: 'Branching rule deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete branching rule' }, { status: 500 });
  }
}
