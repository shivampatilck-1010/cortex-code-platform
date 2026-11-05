// Cortex Online Examination System — Objective Auto-Grading Engine
// Evaluates student responses server-side against marking keys with full support for negative marks,
// partial credit, numerical tolerance, and case sensitivity.

import { ExamQuestion } from './models';

export interface GradeResult {
  earnedPoints: number;
  maxPoints: number;
  isCorrect: boolean;
  status: 'auto_graded' | 'pending';
  feedback?: string;
}

/**
 * Grades a single question response server-side.
 * Client responses cannot forge earnedPoints for programming questions; only trusted server execution results are honored.
 */
export function gradeQuestionResponse(
  question: ExamQuestion,
  studentResponse: any,
  options?: { trustedExecution?: { passedTests: number; totalTests: number } }
): GradeResult {
  const points = typeof question.points === 'number'
    ? question.points
    : (question.points !== undefined && question.points !== null ? Number(question.points) : 1.0);
  const negative = Math.abs(question.negativeMarks || 0.0);
  const penalty = negative > 0 ? -negative : 0;

  // If no response provided, award 0 points (no negative penalty unless specified)
  if (studentResponse === undefined || studentResponse === null || studentResponse === '') {
    return {
      earnedPoints: 0,
      maxPoints: points,
      isCorrect: false,
      status: 'auto_graded',
      feedback: 'Unanswered',
    };
  }

  const correctAnswer = question.correctAnswer || {};

  switch (question.questionType) {
    case 'mcq_single': {
      // Expected correctAnswer: { optionId: string } or { selectedOptionId: string } or string ID
      const expectedId = typeof correctAnswer === 'string'
        ? correctAnswer
        : (correctAnswer.optionId || correctAnswer.selectedOptionId);
      const selectedId = typeof studentResponse === 'string'
        ? studentResponse
        : (studentResponse?.optionId || studentResponse?.selectedOptionId);

      if (selectedId && expectedId && selectedId === expectedId) {
        return { earnedPoints: points, maxPoints: points, isCorrect: true, status: 'auto_graded' };
      } else {
        return { earnedPoints: penalty, maxPoints: points, isCorrect: false, status: 'auto_graded' };
      }
    }

    case 'mcq_multiple': {
      // Expected correctAnswer: { optionIds: string[], partialCredit?: boolean } or { selectedOptionIds: string[] }
      const expectedIds: string[] = Array.isArray(correctAnswer)
        ? correctAnswer
        : (correctAnswer.optionIds || correctAnswer.selectedOptionIds || []);
      const selectedIds: string[] = Array.isArray(studentResponse)
        ? studentResponse
        : (studentResponse?.optionIds || studentResponse?.selectedOptionIds || []);

      if (expectedIds.length === 0) {
        return { earnedPoints: 0, maxPoints: points, isCorrect: false, status: 'auto_graded' };
      }

      const expectedSet = new Set(expectedIds);
      const selectedSet = new Set(selectedIds);

      // Check if any selected option is incorrect
      let wrongSelected = 0;
      let correctSelected = 0;

      for (const id of selectedSet) {
        if (expectedSet.has(id)) {
          correctSelected++;
        } else {
          wrongSelected++;
        }
      }

      const allowPartial = correctAnswer.partialCredit !== false;

      if (wrongSelected === 0 && correctSelected === expectedIds.length) {
        return { earnedPoints: points, maxPoints: points, isCorrect: true, status: 'auto_graded' };
      }

      if (allowPartial) {
        // Partial score: correct selections minus wrong selections
        const fraction = Math.max(0, (correctSelected - wrongSelected) / expectedIds.length);
        const earned = Math.round(fraction * points * 100) / 100;
        return {
          earnedPoints: earned,
          maxPoints: points,
          isCorrect: earned === points,
          status: 'auto_graded',
        };
      }

      return { earnedPoints: penalty, maxPoints: points, isCorrect: false, status: 'auto_graded' };
    }

    case 'true_false': {
      // Expected correctAnswer: boolean or { value: boolean }
      const expectedVal = typeof correctAnswer === 'boolean'
        ? correctAnswer
        : (typeof correctAnswer.value === 'boolean' ? correctAnswer.value : String(correctAnswer).toLowerCase() === 'true');
      const studentVal = typeof studentResponse === 'boolean'
        ? studentResponse
        : (typeof studentResponse.value === 'boolean' ? studentResponse.value : String(studentResponse).toLowerCase() === 'true');

      if (studentVal === expectedVal) {
        return { earnedPoints: points, maxPoints: points, isCorrect: true, status: 'auto_graded' };
      } else {
        return { earnedPoints: penalty, maxPoints: points, isCorrect: false, status: 'auto_graded' };
      }
    }

    case 'numerical': {
      // Expected correctAnswer: { value: number, tolerance?: number }
      const expectedNum = typeof correctAnswer === 'number'
        ? correctAnswer
        : parseFloat(correctAnswer.value !== undefined ? correctAnswer.value : correctAnswer);
      const tolerance = question.numericalTolerance || correctAnswer.tolerance || 0.0;
      const studentNum = typeof studentResponse === 'number'
        ? studentResponse
        : parseFloat(studentResponse.value !== undefined ? studentResponse.value : studentResponse);

      if (isNaN(studentNum) || isNaN(expectedNum)) {
        return { earnedPoints: penalty, maxPoints: points, isCorrect: false, status: 'auto_graded' };
      }

      const diff = Math.abs(studentNum - expectedNum);
      if (diff <= tolerance) {
        return { earnedPoints: points, maxPoints: points, isCorrect: true, status: 'auto_graded' };
      } else {
        return { earnedPoints: penalty, maxPoints: points, isCorrect: false, status: 'auto_graded' };
      }
    }

    case 'short_answer': {
      // If teacher configured manual grading:
      if (correctAnswer.manualGrading === true) {
        return {
          earnedPoints: 0,
          maxPoints: points,
          isCorrect: false,
          status: 'pending',
          feedback: 'Awaiting manual teacher evaluation',
        };
      }

      // Expected correctAnswer: { acceptedAnswers: string[], caseSensitive?: boolean }
      const accepted: string[] = Array.isArray(correctAnswer)
        ? correctAnswer
        : (Array.isArray(correctAnswer.acceptedAnswers) ? correctAnswer.acceptedAnswers : [String(correctAnswer.text || correctAnswer)]);

      const caseSensitive = !!correctAnswer.caseSensitive;
      const studentText = String(studentResponse.text !== undefined ? studentResponse.text : studentResponse).trim();

      const isMatch = accepted.some((item) => {
        const normItem = item.trim();
        return caseSensitive
          ? normItem === studentText
          : normItem.toLowerCase() === studentText.toLowerCase();
      });

      if (isMatch) {
        return { earnedPoints: points, maxPoints: points, isCorrect: true, status: 'auto_graded' };
      } else {
        return { earnedPoints: penalty, maxPoints: points, isCorrect: false, status: 'auto_graded' };
      }
    }

    case 'programming': {
      // Programming question scoring: client-supplied earnedPoints are strictly rejected to prevent score forgery.
      // Trusted execution results can only be passed via server-controlled options.trustedExecution.
      if (options?.trustedExecution && typeof options.trustedExecution.passedTests === 'number') {
        const total = Math.max(1, options.trustedExecution.totalTests || 1);
        const ratio = Math.min(1, Math.max(0, options.trustedExecution.passedTests / total));
        const earned = Math.round(ratio * points * 100) / 100;
        return {
          earnedPoints: earned,
          maxPoints: points,
          isCorrect: earned === points,
          status: 'auto_graded',
          feedback: `Passed ${options.trustedExecution.passedTests}/${total} automated tests`,
        };
      }
      return {
        earnedPoints: 0,
        maxPoints: points,
        isCorrect: false,
        status: 'pending',
        feedback: 'Awaiting server test execution or manual teacher evaluation',
      };
    }

    default:
      return {
        earnedPoints: 0,
        maxPoints: points,
        isCorrect: false,
        status: 'pending',
        feedback: 'Unsupported question type for auto-grading',
      };
  }
}
