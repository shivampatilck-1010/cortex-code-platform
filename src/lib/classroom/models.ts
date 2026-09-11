// Cortex Classroom — Core Domain Models and Type Definitions

export type UserGlobalRole = 'student' | 'teacher' | 'admin';
export type ClassroomMemberRole = 'student' | 'teacher' | 'ta';
export type ClassroomStatus = 'active' | 'archived';
export type AssignmentType = 
  | 'coding'
  | 'multiple_choice'
  | 'short_answer'
  | 'challenge'
  | 'project'
  | 'quiz'
  | 'mixed';

export type AssignmentStatus = 'draft' | 'scheduled' | 'published' | 'closed' | 'archived';
export type SubmissionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'graded';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
export type AIPolicy = 'full' | 'hints_only' | 'explain_only' | 'disabled';
export type TestCaseVisibility = 'public' | 'hidden';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserGlobalRole;
  avatar?: string;
  status: 'active' | 'suspended';
  createdAt: number;
  updatedAt: number;
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  description: string;
  courseCode: string;
  academicYear: string;
  section: string;
  teacherId: string;
  teacherName: string;
  image?: string;
  joinCode: string;
  joinEnabled: boolean;
  status: ClassroomStatus;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  settings: ClassroomSettingsConfig;
}

export interface ClassroomSettingsConfig {
  allowStudentPosting: boolean;
  allowStudentMessaging: boolean;
  allowCodeSharing: boolean;
  leaderboardEnabled: boolean;
  defaultAIPolicy: AIPolicy;
  memberVisibility?: boolean | 'all' | 'teachers_only' | string;
}

export interface ClassroomMember {
  id: string;
  classroomId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: ClassroomMemberRole;
  status: 'active' | 'dropped';
  joinedAt: number;
  lastActiveAt: number;
  isOnline?: boolean;
}

export interface ClassroomInvite {
  id: string;
  classroomId: string;
  code: string;
  createdBy: string;
  expiresAt: number;
  maxUses: number;
  uses: number;
  status: 'active' | 'expired' | 'revoked';
}

export interface Announcement {
  id: string;
  classroomId: string;
  authorId: string;
  authorName: string;
  authorRole: ClassroomMemberRole;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface ClassroomMessage {
  id: string;
  classroomId: string;
  senderId: string;
  senderName: string;
  senderRole: ClassroomMemberRole;
  recipientType: 'class' | 'teacher' | 'direct';
  recipientId?: string;
  content: string;
  privateNotes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface TestCase {
  id: string;
  assignmentId: string;
  input: string;
  expectedOutput: string;
  visibility: TestCaseVisibility;
  weight: number;
  timeoutMs: number;
  memoryLimitMb: number;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
}

export interface Assignment {
  id: string;
  classroomId: string;
  title: string;
  description: string;
  instructions: string;
  type: AssignmentType;
  language: string;
  starterCode: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  maxMarks: number;
  dueAt: number;
  publishedAt: number;
  scheduledAt?: number;
  attemptsAllowed: number;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  autoGrade: boolean;
  manualGrade: boolean;
  aiPolicy: AIPolicy;
  plagiarismPolicy: 'review_only' | 'strict' | 'disabled';
  status: AssignmentStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  testCases: TestCase[];
  rubric?: RubricCriterion[];
}

export interface SubmissionTestCaseResult {
  testCaseId: string;
  status: 'passed' | 'failed' | 'timeout' | 'error';
  visibility: TestCaseVisibility;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  error?: string;
  executionTimeMs: number;
  memoryUsageMb: number;
  score: number;
  maxScore: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  classroomId: string;
  studentId: string;
  studentName: string;
  code: string;
  language: string;
  version: number;
  status: SubmissionStatus;
  submittedAt: number;
  executionStartedAt?: number;
  executionCompletedAt?: number;
  score: number;
  maxScore: number;
  isLate: boolean;
  testResults: SubmissionTestCaseResult[];
  grade?: Grade;
  feedback?: Feedback;
  similarityScore?: number;
  similarStudentName?: string;
}

export interface Grade {
  id: string;
  submissionId: string;
  studentId: string;
  assignmentId: string;
  automaticScore: number;
  manualAdjustment: number;
  finalScore: number;
  gradedBy: string;
  gradedByName: string;
  gradedAt: number;
  releasedAt?: number;
  rubricScores?: Record<string, number>;
}

export interface Feedback {
  id: string;
  submissionId: string;
  authorId: string;
  authorName: string;
  content: string;
  privateNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LiveClassSession {
  id: string;
  classroomId: string;
  teacherId: string;
  teacherName: string;
  title: string;
  topic: string;
  language: string;
  starterCode: string;
  sharedCode: string;
  isBroadcastingCode: boolean;
  startedAt: number;
  endedAt?: number;
  durationMinutes: number;
  status: 'active' | 'ended';
  activeStudentCount: number;
}

export interface ClassroomResource {
  pinned?: boolean;
  visibility?: 'public' | 'teachers_only';
  id: string;
  classroomId: string;
  uploadedBy: string;
  uploadedByName: string;
  name: string;
  type: 'pdf' | 'link' | 'code' | 'notes' | 'dataset';
  url: string;
  description: string;
  unit: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  classroomId: string;
  type: 
    | 'assignment_new'
    | 'assignment_deadline'
    | 'grade_released'
    | 'feedback_added'
    | 'announcement'
    | 'session_started'
    | 'enrollment';
  title: string;
  message: string;
  data?: Record<string, any>;
  readAt?: number;
  createdAt: number;
}

export interface ClassroomEvent {
  id: string;
  classroomId: string;
  sequence: number;
  type: string;
  actorId: string;
  actorName: string;
  timestamp: number;
  payload: any;
}

export interface StudentProgress {
  classroomId: string;
  studentId: string;
  studentName: string;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  averageScore: number;
  solvedProblems: number;
  codingActivityHours: number;
  assignmentsAttempted?: number;
  questionsAsked?: number;
  liveSessionsJoined?: number;
  topicMastery: Record<string, number>;
}

export interface LeaderboardEntry {
  classroomId: string;
  studentId: string;
  studentName: string;
  points: number;
  rank: number;
  solved: number;
  accuracy: number;
  lastActive: number;
}

export interface ClassroomAnalytics {
  classroomId: string;
  totalStudents: number;
  activeToday: number;
  classAverageScore: number;
  submissionRate: number;
  assignmentsCount: number;
  pendingGrading?: number;
  commonFailureStates?: Record<string, number>;
  atRiskCount: number;
  atRiskStudents: Array<{
    studentId: string;
    studentName: string;
    reason: string;
    averageScore: number;
  }>;
}
