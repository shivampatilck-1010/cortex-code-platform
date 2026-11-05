-- Cortex Online Examination System — Phase 2: Reusable Question Bank
-- Schema for storing independent, reusable question assets with categorization, difficulty, tags, and immutability

CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  classroom_id TEXT,
  subject TEXT NOT NULL DEFAULT 'General',
  topic TEXT NOT NULL DEFAULT 'General',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  question_type TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_media_url TEXT,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer_json TEXT NOT NULL DEFAULT '{}',
  test_cases_json TEXT NOT NULL DEFAULT '[]',
  initial_code TEXT,
  language TEXT,
  default_points REAL NOT NULL DEFAULT 1.0,
  negative_marks REAL NOT NULL DEFAULT 0.0,
  numerical_tolerance REAL NOT NULL DEFAULT 0.0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_question_bank_teacher ON question_bank(teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_subject_topic ON question_bank(subject, topic);
CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_question_bank_type ON question_bank(question_type);
CREATE INDEX IF NOT EXISTS idx_question_bank_archived ON question_bank(is_archived);
