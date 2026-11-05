// Cortex Online Examination System — Advanced Assessment Engine (Phase 3)
// Conditional Branching, Dynamic Route Evaluation, Cycle Detection & Route-Based Scoring

import { Exam, ExamQuestion, ExamSection, ExamBranchingRule } from './models';

export interface RouteEvaluationResult {
  activeSectionIds: string[];
  activeQuestionIds: string[];
  traversedNodeIds: string[];
  currentDestinationId: string | null;
  effectiveTotalMarks: number;
}

/**
 * Evaluates whether a student answer satisfies a branching rule condition.
 * Uses a strict allowlist of operators ('equals', 'not_equals', 'selected_option').
 * No arbitrary expression or script evaluation.
 */
export function evaluateBranchCondition(rule: ExamBranchingRule, studentAnswer: any): boolean {
  if (studentAnswer === undefined || studentAnswer === null) {
    return false;
  }

  // Extract student response value
  let actualValue: any = studentAnswer;
  if (typeof studentAnswer === 'object' && !Array.isArray(studentAnswer)) {
    if (studentAnswer.selectedOptionId !== undefined) {
      actualValue = studentAnswer.selectedOptionId;
    } else if (studentAnswer.value !== undefined) {
      actualValue = studentAnswer.value;
    } else if (studentAnswer.text !== undefined) {
      actualValue = studentAnswer.text;
    }
  }

  const expectedStr = String(rule.conditionValue).trim().toLowerCase();
  const actualStr = String(actualValue).trim().toLowerCase();

  switch (rule.conditionOperator) {
    case 'equals':
    case 'selected_option': {
      if (Array.isArray(actualValue)) {
        // Multi-select: check if selected option exists in array
        return actualValue.map((v) => String(v).trim().toLowerCase()).includes(expectedStr);
      }
      return actualStr === expectedStr;
    }
    case 'not_equals': {
      if (Array.isArray(actualValue)) {
        return !actualValue.map((v) => String(v).trim().toLowerCase()).includes(expectedStr);
      }
      return actualStr !== expectedStr;
    }
    default:
      return false;
  }
}

/**
 * Computes the active examination route and questions based on student answers and branching rules.
 * Traverses sections and questions deterministically on the server.
 * Ensures questions on bypassed or inactive branches do NOT contribute to points or scoring.
 */
export function computeActiveExamRoute(params: {
  exam: Exam;
  rules?: ExamBranchingRule[];
  responses: Record<string, any>;
}): RouteEvaluationResult {
  const { exam, rules = [], responses } = params;
  const sections = [...(exam.sections || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const questions = [...(exam.questions || [])].sort((a, b) => a.sortOrder - b.sortOrder);

  // If no branching rules exist, standard linear traversal of all questions/sections
  if (!rules || rules.length === 0) {
    const activeSectionIds = sections.map((s) => s.id);
    const activeQuestionIds = questions.map((q) => q.id);
    const effectiveTotalMarks = questions.reduce((sum, q) => sum + (q.points || 0), 0);
    return {
      activeSectionIds,
      activeQuestionIds,
      traversedNodeIds: activeSectionIds.length > 0 ? activeSectionIds : activeQuestionIds,
      currentDestinationId: null,
      effectiveTotalMarks,
    };
  }

  // Group branching rules by sourceQuestionId
  const rulesByQuestion = new Map<string, ExamBranchingRule[]>();
  for (const rule of rules) {
    const list = rulesByQuestion.get(rule.sourceQuestionId) || [];
    list.push(rule);
    list.sort((a, b) => a.priority - b.priority);
    rulesByQuestion.set(rule.sourceQuestionId, list);
  }

  const sectionMap = new Map<string, ExamSection>(sections.map((s) => [s.id, s]));
  const questionMap = new Map<string, ExamQuestion>(questions.map((q) => [q.id, q]));

  // Questions grouped by sectionId (or 'unsectioned')
  const questionsBySection = new Map<string, ExamQuestion[]>();
  for (const q of questions) {
    const secKey = q.sectionId || 'unsectioned';
    const list = questionsBySection.get(secKey) || [];
    list.push(q);
    questionsBySection.set(secKey, list);
  }

  const activeSectionIds: string[] = [];
  const activeQuestionIds: string[] = [];
  const traversedNodeIds: string[] = [];
  const visitedSections = new Set<string>();
  const visitedQuestions = new Set<string>();

  // Determine starting point
  let currentSecIndex = 0;
  let hasEnded = false;

  while (currentSecIndex < sections.length && !hasEnded) {
    const currentSection = sections[currentSecIndex];
    if (visitedSections.has(currentSection.id)) {
      // Prevent infinite traversal loops
      break;
    }
    visitedSections.add(currentSection.id);
    activeSectionIds.push(currentSection.id);
    traversedNodeIds.push(currentSection.id);

    const sectionQuestions = questionsBySection.get(currentSection.id) || [];
    let branchTaken: { type: string; id: string | null } | null = null;

    for (const q of sectionQuestions) {
      if (!visitedQuestions.has(q.id)) {
        visitedQuestions.add(q.id);
        activeQuestionIds.push(q.id);
      }

      // Check if this question is a branching decision node
      const qRules = rulesByQuestion.get(q.id);
      if (qRules && qRules.length > 0) {
        const studentAns = responses[q.id];
        let matched = false;

        for (const rule of qRules) {
          if (evaluateBranchCondition(rule, studentAns)) {
            matched = true;
            branchTaken = { type: rule.destinationType, id: rule.destinationId || null };
            break;
          }
        }

        // If student answered and none matched, use default destination
        if (!matched && studentAns !== undefined && qRules[0].defaultDestinationType) {
          branchTaken = {
            type: qRules[0].defaultDestinationType,
            id: qRules[0].defaultDestinationId || null,
          };
        }
      }
    }

    if (branchTaken) {
      if (branchTaken.type === 'end') {
        hasEnded = true;
        break;
      } else if (branchTaken.type === 'section' && branchTaken.id) {
        const nextIndex = sections.findIndex((s) => s.id === branchTaken!.id);
        if (nextIndex !== -1 && !visitedSections.has(branchTaken.id)) {
          currentSecIndex = nextIndex;
          continue;
        }
      } else if (branchTaken.type === 'question' && branchTaken.id) {
        const targetQ = questionMap.get(branchTaken.id);
        if (targetQ && targetQ.sectionId && targetQ.sectionId !== currentSection.id) {
          const nextIndex = sections.findIndex((s) => s.id === targetQ.sectionId);
          if (nextIndex !== -1 && !visitedSections.has(targetQ.sectionId)) {
            currentSecIndex = nextIndex;
            continue;
          }
        }
      }
    }

    // Advance to next section: if sequential fall-through, skip non-mandatory elective sections
    // Non-mandatory sections represent conditional branches and are only entered if explicitly targeted
    let nextSecIndex = currentSecIndex + 1;
    while (nextSecIndex < sections.length && !sections[nextSecIndex].isMandatory) {
      nextSecIndex++;
    }
    currentSecIndex = nextSecIndex;
  }

  // Include any active unsectioned questions
  const unsectioned = questionsBySection.get('unsectioned') || [];
  for (const q of unsectioned) {
    if (!visitedQuestions.has(q.id)) {
      visitedQuestions.add(q.id);
      activeQuestionIds.push(q.id);
    }
  }

  // Calculate effective total marks for the specific route taken
  const effectiveTotalMarks = activeQuestionIds.reduce((sum, qId) => {
    const q = questionMap.get(qId);
    return sum + (q?.points || 0);
  }, 0);

  return {
    activeSectionIds,
    activeQuestionIds,
    traversedNodeIds,
    currentDestinationId: activeSectionIds[activeSectionIds.length - 1] || null,
    effectiveTotalMarks,
  };
}
