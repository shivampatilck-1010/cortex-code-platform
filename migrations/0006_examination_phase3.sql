-- Cortex Online Examination System — Phase 3 Migration
-- Advanced Assessment Engine: Randomization, Sections & Conditional Branching, Safe Exam Browser & Live Teacher Dashboard

-- 1. Create table for conditional branching rules
CREATE TABLE IF NOT EXISTS exam_branching_rules (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  source_question_id TEXT NOT NULL,
  condition_operator TEXT NOT NULL, -- 'equals' | 'not_equals' | 'selected_option'
  condition_value TEXT NOT NULL,    -- option ID or matching answer value
  destination_type TEXT NOT NULL,   -- 'section' | 'question' | 'end'
  destination_id TEXT,              -- target section ID or question ID
  default_destination_type TEXT NOT NULL DEFAULT 'section', -- 'section' | 'question' | 'end'
  default_destination_id TEXT,      -- fallback section ID or question ID
  priority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (source_question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exam_branching_exam ON exam_branching_rules(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_branching_source ON exam_branching_rules(source_question_id);

