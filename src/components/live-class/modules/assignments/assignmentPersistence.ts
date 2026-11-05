import { Assignment, AssignmentSubmission } from '@/types/assignments';
import { DEFAULT_ASSIGNMENTS, DEFAULT_SUBMISSIONS } from './assignmentDefaults';

export const ASSIGNMENTS_STORAGE_KEY = 'cortex_assignments_data';
export const SUBMISSIONS_STORAGE_KEY = 'cortex_submissions_data';

export const loadAssignments = (): Assignment[] => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_ASSIGNMENTS;
  }

  try {
    const raw = window.localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    if (!raw) return DEFAULT_ASSIGNMENTS;

    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((a: any) => a && typeof a.id === 'string' && typeof a.title === 'string')
    ) {
      return parsed.map((a: any) => ({
        ...a,
        points: typeof a.points === 'number' ? a.points : 100,
        status: ['draft', 'published', 'closed'].includes(a.status) ? a.status : 'published',
        testCases: Array.isArray(a.testCases) ? a.testCases : [],
        rubricCriteria: Array.isArray(a.rubricCriteria) ? a.rubricCriteria : [],
        starterCode: typeof a.starterCode === 'string' ? a.starterCode : '',
      }));
    }
  } catch (err) {
    console.warn('Failed to load assignments from localStorage, recovering to default:', err);
  }

  return DEFAULT_ASSIGNMENTS;
};

export const saveAssignments = (assignments: Assignment[]): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const payload = JSON.stringify(assignments);
    window.localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, payload);
    return true;
  } catch (err) {
    console.error('Failed to save assignments to localStorage:', err);
    return false;
  }
};

export const loadSubmissions = (): AssignmentSubmission[] => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SUBMISSIONS;
  }

  try {
    const raw = window.localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_SUBMISSIONS;

    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((s: any) => s && typeof s.id === 'string' && typeof s.assignmentId === 'string')
    ) {
      return parsed.map((s: any) => ({
        id: String(s.id),
        assignmentId: String(s.assignmentId),
        studentId: String(s.studentId || 'usr_student_demo'),
        studentName: String(s.studentName || 'Student'),
        studentEmail: String(s.studentEmail || 'student@cortex.edu'),
        attemptNumber: typeof s.attemptNumber === 'number' && s.attemptNumber > 0 ? s.attemptNumber : 1,
        code: typeof s.code === 'string' ? s.code : '',
        language: typeof s.language === 'string' ? s.language : 'C++17',
        testResults: Array.isArray(s.testResults) ? s.testResults : [],
        status: s.status === 'graded' ? 'graded' : 'submitted',
        score: typeof s.score === 'number' ? Math.max(0, s.score) : 0,
        maxScore: typeof s.maxScore === 'number' ? Math.max(1, s.maxScore) : 100,
        submittedAt: typeof s.submittedAt === 'number' ? s.submittedAt : Date.now(),
        gradedAt: typeof s.gradedAt === 'number' ? s.gradedAt : undefined,
        teacherFeedback: typeof s.teacherFeedback === 'string' ? s.teacherFeedback : undefined,
        rubricScores: typeof s.rubricScores === 'object' && s.rubricScores !== null ? s.rubricScores : undefined,
      }));
    }
  } catch (err) {
    console.warn('Failed to load submissions from localStorage, recovering to default:', err);
  }

  return DEFAULT_SUBMISSIONS;
};

export const saveSubmissions = (submissions: AssignmentSubmission[]): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const payload = JSON.stringify(submissions);
    window.localStorage.setItem(SUBMISSIONS_STORAGE_KEY, payload);
    return true;
  } catch (err) {
    console.error('Failed to save submissions to localStorage:', err);
    return false;
  }
};
