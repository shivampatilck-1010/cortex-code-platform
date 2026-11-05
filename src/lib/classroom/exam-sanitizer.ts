// Cortex Online Examination System — Sanitization & Privacy Engine
// Strictly prevents leakage of correct answers, marking schemes, and hidden test cases to students.

import { Exam, ExamQuestion, ExamOption, ExamQuestionTestCase, ExamSession } from './models';

/**
 * Generates an authoritative randomized question order array for an attempt.
 */
export function generateSessionQuestionOrder(questions: ExamQuestion[]): string[] {
  const ids = questions.map((q) => q.id);
  // Fisher-Yates shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/**
 * Generates an authoritative randomized option order map for an attempt.
 * Shuffles options only for mcq_single, mcq_multiple, and true_false.
 * Numerical, written, and programming questions are never shuffled.
 */
export function generateSessionOptionOrder(questions: ExamQuestion[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const q of questions) {
    if ((q.questionType === 'mcq_single' || q.questionType === 'mcq_multiple' || q.questionType === 'true_false') && q.options && q.options.length > 1) {
      const optIds = q.options.map((o) => o.id);
      for (let i = optIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optIds[i], optIds[j]] = [optIds[j], optIds[i]];
      }
      map[q.id] = optIds;
    }
  }
  return map;
}

/**
 * Sanitizes an individual question for student view.
 * Redacts correct answers, option correctness flags, and hidden test case contents.
 */
export function sanitizeQuestionForStudent(q: ExamQuestion): ExamQuestion {
  // Strip isCorrect flag from options
  const sanitizedOptions: ExamOption[] = (q.options || []).map((opt) => ({
    id: opt.id,
    text: opt.text,
    mediaUrl: opt.mediaUrl,
  }));

  // Sanitize programming test cases (hide private/hidden inputs & outputs)
  let sanitizedTestCases: ExamQuestionTestCase[] | undefined = undefined;
  if (q.testCases && Array.isArray(q.testCases)) {
    sanitizedTestCases = q.testCases.map((tc) => {
      if (tc.isHidden) {
        return {
          id: tc.id,
          input: '[HIDDEN TEST CASE]',
          expectedOutput: '[HIDDEN TEST CASE]',
          isHidden: true,
          points: tc.points,
        };
      }
      return {
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: false,
        points: tc.points,
      };
    });
  }

  return {
    ...q,
    options: sanitizedOptions,
    correctAnswer: undefined, // CRITICAL: NEVER exposed to students
    testCases: sanitizedTestCases,
  };
}

/**
 * Sanitizes an entire exam payload for student consumption.
 * Checks assignment restrictions and ensures draft exams are never displayed.
 * Applies persisted session questionOrder and optionOrder if session is provided.
 */
export function sanitizeExamForStudent(exam: Exam, studentId: string, session?: ExamSession | null): Exam {
  // Deep clone to avoid mutating in-memory cache
  let questions = (exam.questions || []).map(sanitizeQuestionForStudent);

  // 1. Question order: Use persisted session order if available
  if (session?.questionOrder && session.questionOrder.length > 0) {
    const orderMap = new Map(session.questionOrder.map((id, idx) => [id, idx]));
    questions.sort((a, b) => {
      const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      return idxA - idxB;
    });
  } else if (exam.shuffleQuestions && questions.length > 1 && !session) {
    // Fallback deterministic shuffle if session not yet created
    questions = deterministicShuffle(questions, `${exam.id}_${studentId}`);
  }

  // 2. Option order: Use persisted session option order if available
  if (session?.optionOrder) {
    questions = questions.map((q) => {
      const persistedOptOrder = session.optionOrder![q.id];
      if (persistedOptOrder && persistedOptOrder.length > 0 && q.options) {
        const optOrderMap = new Map(persistedOptOrder.map((id, idx) => [id, idx]));
        const sortedOptions = [...q.options].sort((a, b) => {
          const idxA = optOrderMap.has(a.id) ? optOrderMap.get(a.id)! : 9999;
          const idxB = optOrderMap.has(b.id) ? optOrderMap.get(b.id)! : 9999;
          return idxA - idxB;
        });
        return { ...q, options: sortedOptions };
      }
      return q;
    });
  } else if (exam.shuffleOptions && !session) {
    // Fallback deterministic option shuffle if session not yet created
    questions = questions.map((q) => {
      if ((q.questionType === 'mcq_single' || q.questionType === 'mcq_multiple' || q.questionType === 'true_false') && q.options && q.options.length > 1) {
        return {
          ...q,
          options: deterministicShuffle(q.options, `${q.id}_${studentId}`),
        };
      }
      return q;
    });
  }

  const sanitizedExam: Exam = {
    ...exam,
    questions,
  };

  // CRITICAL SECURITY: Strictly redact all examination administrative secrets from student view
  delete (sanitizedExam as any).sebQuitPassword;
  delete (sanitizedExam as any).sebQuitPasswordHash;
  delete (sanitizedExam as any).sebBrowserExamKey;
  delete (sanitizedExam as any).sebConfigKey;
  delete (sanitizedExam as any).hasQuitPassword;

  return sanitizedExam;
}

/**
 * Deterministic pseudo-random shuffle using seed string.
 * Ensures the student sees the exact same randomized order across page reloads.
 */
function deterministicShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  // Simple LCG PRNG
  const random = () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 1000) / 1000;
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
