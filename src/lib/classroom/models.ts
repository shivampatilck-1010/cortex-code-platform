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
export type AIPolicy = 'full' | 'hints_only' | 'explain_only' | 'disabled';
export type TestCaseVisibility = 'public' | 'hidden';

export interface User {
  id: string;
  name: string;
  email: string;
  cortex_id?: string;
  cortexId?: string;
  professional_email?: string;
  professionalEmail?: string;
  role: UserGlobalRole;
  password_hash?: string;
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
  coursecode?: string; // Legacy fallback
  projectId?: string;
  snapshotJson?: string; // Stringified array of files at submission time
  academicYear: string;
  section: string;
  teacherId: string;
  teacherName: string;
  image?: string;
  joincode?: string; // Legacy fallback
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
  user_professional_email?: string;
  userProfessionalEmail?: string;
  role: ClassroomMemberRole;
  status: 'active' | 'dropped' | 'suspended';
  joinedAt: number;
  suspendedAt?: number;
  suspensionExpiresAt?: number;
  removedAt?: number;
  lastActiveAt: number;
  isOnline?: boolean;
}

export interface ClassroomInvite {
  id: string;
  classroomId: string;
  code?: string; // Legacy fallback
  projectId?: string;
  snapshotJson?: string; // Stringified array of files at submission time
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
  recipientType: 'class' | 'teacher' | 'direct' | 'announcement';
  recipientId?: string;
  content: string;
  privateNotes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface TestCase {
  id: string;
  assignmentId?: string;
  name?: string;
  input: string;
  expectedOutput: string;
  visibility: TestCaseVisibility;
  isHidden?: boolean;
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
  starterCode?: string;
  startercode?: string; // Legacy fallback
  projectId?: string;
  snapshotJson?: string; // Stringified array of files at submission time
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
  code?: string; // Legacy fallback
  projectId?: string;
  snapshotJson?: string; // Stringified array of files at submission time
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
  startercode?: string; // Legacy fallback
  projectId?: string;
  snapshotJson?: string; // Stringified array of files at submission time
  sharedcode?: string; // Legacy fallback
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
  averageScore: number;
  
  completionRate: number;
  
  assignmentsCount: number;
  recentTrend?: number[];
  pendingGrading?: number;
  commonFailureStates?: Record<string, number>;
  atRiskCount: number;
  atRiskStudents: Array<{
    studentId: string;
    studentName: string;
    reason: string;
  }>;
}



// --- Cortex Project Teams & Formation Studio Domain Models ---

export type TeamFormationMode = 'teacher_controlled' | 'teacher_created_student_selected' | 'student_created';
export type TeamJoiningPolicy = 'direct' | 'approval_required';
export type TeamThemePolicy = 'teacher_controlled' | 'team_leader' | 'approval_required';
export type TeamMemberRole = 'leader' | 'member';
export type TeamMemberStatus = 'active' | 'pending_approval' | 'invited';
export type ProjectTeamStatus = 'forming' | 'active' | 'submitted' | 'archived';
export type ThemePresetId = 'cortex_signature' | 'aurora' | 'neural' | 'circuit' | 'midnight' | 'ocean' | 'emerald' | 'paper';

export interface ClassroomTeamSettings {
  classroomId: string;
  formationMode: TeamFormationMode;
  joiningPolicy: TeamJoiningPolicy;
  minTeamSize: number;
  maxTeamSize: number;
  allowMultipleTeams: boolean;
  membershipLocked: boolean;
  themePolicy: TeamThemePolicy;
  creationDeadline?: number | null;
  joiningDeadline?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectTeam {
  id: string;
  classroomId: string;
  name: string;
  projectTitle: string;
  description: string;
  createdBy: string;
  status: ProjectTeamStatus;
  themePreset: ThemePresetId;
  proposedThemePreset?: ThemePresetId | null;
  isLocked: boolean;
  createdAt: number;
  updatedAt: number;
  members?: ProjectTeamMember[];
  memberCount?: number;
}

export interface ProjectTeamMember {
  id: string;
  teamId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  cortexId?: string;
  teamRole: TeamMemberRole;
  membershipStatus: TeamMemberStatus;
  assignedBy: string;
  joinedAt: number;
  updatedAt: number;
}

export interface ProjectActivityRecord {
  id: string;
  classroomId: string;
  teamId: string;
  actorUserId: string;
  actorName: string;
  eventType: string;
  details: Record<string, any>;
  createdAt: number;
}

// ==========================================
// Cortex Online Examination System Domain Models
// ==========================================

export type ExamStatus = 'draft' | 'scheduled' | 'published' | 'active' | 'ended' | 'results_published';

export type ExamSecurityLevel = 'standard' | 'restricted' | 'seb';

export type ExamQuestionType =
  | 'mcq_single'
  | 'mcq_multiple'
  | 'true_false'
  | 'numerical'
  | 'short_answer'
  | 'programming';

export type ExamSessionStatus = 'in_progress' | 'submitted' | 'timed_out' | 'cancelled';

export type ExamGradingStatus = 'pending' | 'auto_graded' | 'manually_graded';

export type ExamIntegrityEventType =
  | 'fullscreen_exit'
  | 'window_blur'
  | 'tab_hidden'
  | 'paste_attempt'
  | 'reconnect'
  | 'proctor_action'
  | 'prohibited_process_detected'
  | 'blocked_key_attempt'
  | 'display_capture_attempt'
  | 'remote_session_detected'
  | 'camera_revoked'
  | 'microphone_revoked'
  | 'multiple_faces_detected'
  | 'face_absent'
  | 'audio_anomaly'
  | 'clipboard_tamper'
  | 'emergency_exit'
  | 'camera_obstructed'
  | 'audio_flatline_disconnected'
  | 'scene_shift_detected'
  | 'multi_monitor_connected'
  | 'vm_environment_detected'
  | 'proctor_note_added'
  | 'flag_cleared';

export type IntegrityEventSeverity = 'informational' | 'low' | 'medium' | 'high';

export function getIntegrityEventSeverity(eventType: ExamIntegrityEventType): IntegrityEventSeverity {
  switch (eventType) {
    case 'reconnect':
    case 'proctor_action':
    case 'proctor_note_added':
    case 'flag_cleared':
      return 'informational';
    case 'paste_attempt':
    case 'audio_anomaly':
    case 'face_absent':
      return 'low';
    case 'fullscreen_exit':
    case 'window_blur':
    case 'tab_hidden':
    case 'audio_flatline_disconnected':
    case 'scene_shift_detected':
    case 'camera_revoked':
    case 'microphone_revoked':
      return 'medium';
    case 'multiple_faces_detected':
    case 'camera_obstructed':
    case 'prohibited_process_detected':
    case 'blocked_key_attempt':
    case 'display_capture_attempt':
    case 'remote_session_detected':
    case 'multi_monitor_connected':
    case 'vm_environment_detected':
    case 'clipboard_tamper':
    case 'emergency_exit':
      return 'high';
    default:
      return 'informational';
  }
}

export const VALID_EXAM_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  draft: ['scheduled', 'published', 'active'],
  scheduled: ['draft', 'published', 'active', 'ended'],
  published: ['draft', 'active', 'ended'],
  active: ['ended'],
  ended: ['active', 'results_published'],
  results_published: ['ended']
};

export interface ExamOption {
  id: string;
  text: string;
  isCorrect?: boolean; // STRICTLY OMITTED FOR STUDENTS
  mediaUrl?: string;
}

export interface ExamQuestionTestCase {
  id: string;
  input: string;
  expectedOutput: string; // STRICTLY REDACTED FOR STUDENTS IF HIDDEN
  isHidden?: boolean;
  points?: number;
}

export interface Exam {
  id: string;
  classroomId: string;
  title: string;
  description: string;
  durationMinutes: number;
  startTime: number;
  endTime: number;
  totalMarks: number;
  passingMarks: number;
  attemptsAllowed: number;
  securityLevel: ExamSecurityLevel;
  sebConfigKey?: string | null;
  sebBrowserExamKey?: string | null;
  sebQuitPassword?: string | null;
  sebQuitPasswordHash?: string | null;
  hasQuitPassword?: boolean;
  sebAllowReload?: boolean;
  sebShowReloadWarning?: boolean;
  status: ExamStatus;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultsImmediately: boolean;
  assignedStudentIds?: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  sections?: ExamSection[];
  questions?: ExamQuestion[];
  branchingRules?: ExamBranchingRule[];
  questionCount?: number;
}

export interface ExamSection {
  id: string;
  examId: string;
  title: string;
  description: string;
  instructions?: string;
  isMandatory?: boolean;
  timeLimitMinutes?: number;
  sortOrder: number;
  sectionMarks: number;
}

export type BranchingOperator = 'equals' | 'not_equals' | 'selected_option';
export type BranchingDestinationType = 'section' | 'question' | 'end';

export interface ExamBranchingRule {
  id: string;
  examId: string;
  sourceQuestionId: string;
  conditionOperator: BranchingOperator;
  conditionValue: string; // option ID or string answer
  destinationType: BranchingDestinationType;
  destinationId?: string | null;
  defaultDestinationType: BranchingDestinationType;
  defaultDestinationId?: string | null;
  priority: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  sectionId?: string | null;
  questionType: ExamQuestionType;
  promptText: string;
  promptMediaUrl?: string | null;
  options: ExamOption[];
  correctAnswer?: any; // NEVER sent to students
  testCases?: ExamQuestionTestCase[]; // Hidden test cases sanitized for students
  initialCode?: string | null;
  language?: string | null;
  points: number;
  negativeMarks: number;
  numericalTolerance: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExamSession {
  id: string;
  examId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  attemptNumber: number;
  status: ExamSessionStatus;
  startedAt: number;
  expiresAt: number;
  submittedAt?: number | null;
  submissionReceipt?: string | null;
  answerDigest?: string | null;
  autoScore: number;
  manualScore?: number | null;
  finalScore?: number | null;
  isPublished: boolean;
  teacherFeedback: string;
  questionOrder?: string[];
  optionOrder?: Record<string, string[]>;
  currentSectionId?: string | null;
  traversedRoute?: string[];
  lastHeartbeatAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CandidateSessionInfo {
  userId: string;
  name: string;
  email: string;
  sessionId?: string | null;
  attemptNumber?: number;
  status: 'not_started' | 'in_progress' | 'submitted' | 'timed_out' | 'cancelled';
  startedAt?: number | null;
  submittedAt?: number | null;
  remainingSeconds: number;
  lastHeartbeatAt?: number | null;
  connectionState: 'active' | 'stale' | 'disconnected' | 'not_started';
  integrityEventCount: number;
  flaggedQuestionCount: number;
  autoScore: number;
  manualScore?: number | null;
  finalScore?: number | null;
}

export interface ExamLiveDashboardData {
  exam: {
    id: string;
    title: string;
    status: ExamStatus;
    securityLevel: ExamSecurityLevel;
    startTime: number;
    endTime: number;
    durationMinutes: number;
    totalMarks: number;
    passingMarks: number;
  };
  metrics: {
    totalCandidates: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    expired: number;
    requiresAttention: number;
    lastUpdated: number;
  };
  candidates: CandidateSessionInfo[];
}

export interface ExamQuestionResponse {
  id: string;
  sessionId: string;
  questionId: string;
  response: any;
  earnedPoints: number;
  gradingStatus: ExamGradingStatus;
  graderNotes?: string;
  flaggedForReview: boolean;
  updatedAt: number;
  staleRejected?: boolean;
}

export interface ExamIntegrityEvent {
  id: string;
  sessionId: string;
  eventType: ExamIntegrityEventType;
  timestamp: number;
  details: Record<string, any>;
}

// --- QUESTION BANK MODELS (PHASE 2) ---
export type QuestionBankDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankItem {
  id: string;
  teacherId: string;
  classroomId?: string | null;
  subject: string;
  topic: string;
  difficulty: QuestionBankDifficulty;
  questionType: ExamQuestionType;
  promptText: string;
  promptMediaUrl?: string | null;
  options: ExamOption[];
  correctAnswer?: any;
  testCases?: ExamQuestionTestCase[];
  initialCode?: string | null;
  language?: string | null;
  defaultPoints: number;
  negativeMarks: number;
  numericalTolerance: number;
  tags: string[];
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionBankFilter {
  subject?: string;
  topic?: string;
  difficulty?: QuestionBankDifficulty;
  questionType?: ExamQuestionType;
  tag?: string;
  search?: string;
  includeArchived?: boolean;
}

// --- Online Examination Analytics & Reporting Domain Models ---

export interface ExamQuestionPerformance {
  questionId: string;
  promptText: string;
  maxPoints: number;
  attemptCount: number;
  correctCount: number;
  averageEarnedPoints: number;
  accuracyRate: number;
}

export interface ExamScoreDistribution {
  bucket_0_39: number;
  bucket_40_59: number;
  bucket_60_79: number;
  bucket_80_100: number;
}

export interface ExamAnalytics {
  examId: string;
  classroomId: string;
  examTitle: string;
  totalCandidates: number;
  startedCount: number;
  submittedCount: number;
  absentCount: number;
  completionRate: number;
  passedCount: number;
  failedCount: number;
  passRate: number;
  failRate: number;
  averageScore: number;
  medianScore: number;
  highestScore: number;
  lowestScore: number;
  scoreDistribution: ExamScoreDistribution;
  gradingCompletion: {
    autoGradedCount: number;
    pendingManualCount: number;
    isGradingComplete: boolean;
  };
  questionPerformance: ExamQuestionPerformance[];
  generatedAt: number;
}

export interface PlatformAdminAnalytics {
  users: {
    total: number;
    teachers: number;
    students: number;
    admins: number;
    active: number;
  };
  classrooms: {
    total: number;
    active: number;
    archived: number;
  };
  exams: {
    total: number;
    draft: number;
    scheduled: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  sessions: {
    totalAttempts: number;
    completedAttempts: number;
    activeAttempts: number;
  };
  generatedAt: number;
}


