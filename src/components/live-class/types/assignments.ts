export type AssignmentDifficulty = 'Easy' | 'Medium' | 'Hard';

export type AssignmentStatus = 'draft' | 'published' | 'closed';

export interface TestCase {
  id: number;
  name?: string;
  input: string;
  expectedOutput: string;
  runtimeMs?: number;
  isHidden?: boolean;
}

export interface RubricCriterion {
  id: string;
  title: string;
  maxPoints: number;
  description: string;
}

export interface Assignment {
  id: string;
  title: string;
  dueTime: string;
  deadlineTimestamp?: number;
  points: number;
  difficulty: AssignmentDifficulty;
  category: string;
  description: string;
  instructions: string;
  starterLanguage: string;
  starterCode: string;
  status: AssignmentStatus;
  testCases: TestCase[];
  rubricCriteria: RubricCriterion[];
  createdAt: number;
  updatedAt: number;
}

export type TestErrorType = 'syntax_error' | 'runtime_error' | 'timeout' | 'worker_error';

export interface TestResult {
  id: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  runtimeMs: number;
  error?: string;
  errorType?: TestErrorType;
}

export type SubmissionStatus = 'submitted' | 'graded';

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  attemptNumber: number;
  code: string;
  language: string;
  testResults: TestResult[];
  status: SubmissionStatus;
  score: number;
  maxScore: number;
  submittedAt: number;
  gradedAt?: number;
  teacherFeedback?: string;
  rubricScores?: Record<string, number>;
}
