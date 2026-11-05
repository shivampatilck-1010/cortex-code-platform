-- Migration: Cortex Online Examination System Foundation (Phase 1)
-- Creates relational schema for examinations, sections, questions, student sessions, responses, and integrity events.

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  total_marks INTEGER NOT NULL DEFAULT 100,
  passing_marks INTEGER NOT NULL DEFAULT 40,
  attempts_allowed INTEGER NOT NULL DEFAULT 1,
  security_level TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'draft',
  shuffle_questions INTEGER NOT NULL DEFAULT 0,
  shuffle_options INTEGER NOT NULL DEFAULT 0,
  show_results_immediately INTEGER NOT NULL DEFAULT 0,
  assigned_student_ids_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exam_sections (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  section_marks INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  section_id TEXT,
  question_type TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_media_url TEXT,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer_json TEXT NOT NULL DEFAULT '{}',
  test_cases_json TEXT NOT NULL DEFAULT '[]',
  initial_code TEXT,
  language TEXT,
  points REAL NOT NULL DEFAULT 1.0,
  negative_marks REAL NOT NULL DEFAULT 0.0,
  numerical_tolerance REAL NOT NULL DEFAULT 0.0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES exam_sections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  submitted_at INTEGER,
  auto_score REAL NOT NULL DEFAULT 0,
  manual_score REAL,
  final_score REAL,
  is_published INTEGER NOT NULL DEFAULT 0,
  teacher_feedback TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(exam_id, user_id, attempt_number),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_question_responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  response_json TEXT NOT NULL DEFAULT '{}',
  earned_points REAL NOT NULL DEFAULT 0,
  grading_status TEXT NOT NULL DEFAULT 'pending',
  grader_notes TEXT NOT NULL DEFAULT '',
  flagged_for_review INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(session_id, question_id),
  FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_integrity_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exams_classroom ON exams(classroom_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(exam_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_responses_session ON exam_question_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_exam_integrity_session ON exam_integrity_events(session_id, timestamp);
