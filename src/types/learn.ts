export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

export type CourseTrack =
  | "Python & DSA"
  | "Systems & C++"
  | "SQL & Data"
  | "AI & ML";

export type CourseCategory =
  | "Data Structures"
  | "Programming"
  | "Machine Learning"
  | "Data Science"
  | "Web Development"
  | "Databases & SQL"
  | "Cyber Security"
  | "Systems & C++";

export interface CoursePosterConfig {
  gradient: string;
  accentHex: string;
  badge: string;
  kicker: string;
  headline: string;
  codeSnippet: string;
  motif: "dsa" | "cpp" | "sql" | "python" | "ml" | "data" | "web" | "security";
}

export type LessonType = "notes" | "quiz" | "lab" | "exam";

export interface QuizQuestion {
  id: string;
  prompt: string;
  codeSnippet?: {
    language: string;
    code: string;
  };
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface NotesCallout {
  kind: "tip" | "pitfall" | "complexity";
  title: string;
  body: string;
}

export interface NotesCodeBlock {
  filename: string;
  language: string;
  code: string;
  runnableInIde?: boolean;
}

export interface NotesTable {
  headers: string[];
  rows: string[][];
}

export interface NotesSection {
  id: string;
  heading: string;
  paragraphs: string[];
  callout?: NotesCallout;
  codeBlock?: NotesCodeBlock;
  table?: NotesTable;
}

export interface NotesLesson {
  id: string;
  type: "notes";
  title: string;
  readMins: number;
  tldr: string[];
  sections: NotesSection[];
  keyTakeaways: string[];
}

export interface QuizLesson {
  id: string;
  type: "quiz";
  title: string;
  passScore: number;
  questions: QuizQuestion[];
}

export interface LabTestCase {
  id: string;
  input: string;
  expectedStdout: string;
  isHidden?: boolean;
}

export interface LabLesson {
  id: string;
  type: "lab";
  title: string;
  estimatedMins: number;
  language: string;
  ideProblemId?: string;
  objective: string;
  steps: string[];
  starterCode: string;
  testCases?: LabTestCase[];
}

export interface ExamLesson {
  id: string;
  type: "exam";
  title: string;
  durationMins: number;
  passScore: number;
  questions: QuizQuestion[];
}

export type LessonItem = NotesLesson | QuizLesson | LabLesson | ExamLesson;

export interface CourseModule {
  id: string;
  title: string;
  summary: string;
  items: LessonItem[];
}

export interface CourseAttribution {
  sourceName: string;
  sourceUrl?: string;
  license: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  track: CourseTrack;
  category: CourseCategory;
  level: CourseLevel;
  description: string;
  estimatedHours: number;
  instructor: string;
  instructorInit: string;
  featured?: boolean;
  following?: boolean;
  popularity?: number;
  publishedOrder?: number;
  poster?: CoursePosterConfig;
  attribution?: CourseAttribution;
  modules: CourseModule[];
}

export interface QuizScoreRecord {
  scorePct: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
  attempts: number;
  updatedAt: number;
}

export interface ExamAttemptRecord {
  scorePct: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
  timeTakenSecs: number;
  submittedAt: number;
}

export interface LearnProgressState {
  completedItemIds: string[];
  quizScores: Record<string, QuizScoreRecord>;
  examAttempts: Record<string, ExamAttemptRecord[]>;
  labSteps: Record<string, number[]>;
  lastVisitedLesson: Record<
    string,
    { courseId: string; lessonId: string; updatedAt: number }
  >;
  lastActiveCourseId: string | null;
}
