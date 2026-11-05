import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { BranchingOperator, BranchingDestinationType } from '@/lib/classroom/models';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const rules = await classroomDb.listExamBranchingRules(examId);
    return NextResponse.json({ rules });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list branching rules' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const body = await req.json();

    // Validate source question
    if (!body.sourceQuestionId) {
      return NextResponse.json({ error: 'sourceQuestionId is required' }, { status: 400 });
    }
    const sourceQ = await classroomDb.getExamQuestion(body.sourceQuestionId);
    if (!sourceQ || sourceQ.examId !== examId) {
      return NextResponse.json({ error: 'Source question not found in this examination' }, { status: 404 });
    }

    // Validate operator against strict allowlist
    const ALLOWED_OPERATORS: BranchingOperator[] = ['equals', 'not_equals', 'selected_option'];
    const op = body.conditionOperator as BranchingOperator;
    if (!ALLOWED_OPERATORS.includes(op)) {
      return NextResponse.json({
        error: `Invalid condition operator. Must be one of: ${ALLOWED_OPERATORS.join(', ')}`,
      }, { status: 400 });
    }

    // Validate destination type
    const ALLOWED_DEST_TYPES: BranchingDestinationType[] = ['section', 'question', 'end'];
    const destType = (body.destinationType || 'section') as BranchingDestinationType;
    if (!ALLOWED_DEST_TYPES.includes(destType)) {
      return NextResponse.json({
        error: `Invalid destination type. Must be one of: ${ALLOWED_DEST_TYPES.join(', ')}`,
      }, { status: 400 });
    }

    // Validate destination ID exists in this exam
    if (destType === 'section' && body.destinationId) {
      const sec = await classroomDb.getExamSection(body.destinationId);
      if (!sec || sec.examId !== examId) {
        return NextResponse.json({ error: 'Destination section does not exist in this examination' }, { status: 400 });
      }
    }
    if (destType === 'question' && body.destinationId) {
      const q = await classroomDb.getExamQuestion(body.destinationId);
      if (!q || q.examId !== examId) {
        return NextResponse.json({ error: 'Destination question does not exist in this examination' }, { status: 400 });
      }
    }

    const defaultDestType = (body.defaultDestinationType || 'section') as BranchingDestinationType;
    if (defaultDestType === 'section' && body.defaultDestinationId) {
      const sec = await classroomDb.getExamSection(body.defaultDestinationId);
      if (!sec || sec.examId !== examId) {
        return NextResponse.json({ error: 'Default destination section does not exist in this examination' }, { status: 400 });
      }
    }
    if (defaultDestType === 'question' && body.defaultDestinationId) {
      const q = await classroomDb.getExamQuestion(body.defaultDestinationId);
      if (!q || q.examId !== examId) {
        return NextResponse.json({ error: 'Default destination question does not exist in this examination' }, { status: 400 });
      }
    }

    const rule = await classroomDb.createExamBranchingRule({
      examId,
      sourceQuestionId: body.sourceQuestionId,
      conditionOperator: op,
      conditionValue: String(body.conditionValue || ''),
      destinationType: destType,
      destinationId: body.destinationId || null,
      defaultDestinationType: defaultDestType,
      defaultDestinationId: body.defaultDestinationId || null,
      priority: typeof body.priority === 'number' ? body.priority : 0,
    });

    // Run cycle validation
    const validation = await classroomDb.validateBranchingRules(examId);
    if (!validation.valid) {
      // Revert rule creation if cycle detected
      await classroomDb.deleteExamBranchingRule(rule.id);
      return NextResponse.json({
        error: `Branching rule rejected: ${validation.errors.join('; ')}`,
        cycleDetected: true,
      }, { status: 400 });
    }

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create branching rule' }, { status: 500 });
  }
}
