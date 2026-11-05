-- Cortex Online Examination System — Phase 3.4 Schema Completion
-- Forward migration to complete Phase 3 examination schema on Cloudflare D1
-- Safely applies missing Phase 3 columns to exams, exam_sections, and exam_sessions.

-- 1. Add Phase 3 columns to exams table
ALTER TABLE exams ADD COLUMN seb_config_key TEXT;
ALTER TABLE exams ADD COLUMN seb_browser_exam_key TEXT;
ALTER TABLE exams ADD COLUMN seb_quit_password TEXT;
ALTER TABLE exams ADD COLUMN seb_allow_reload INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exams ADD COLUMN seb_show_reload_warning INTEGER NOT NULL DEFAULT 1;

-- 2. Add Phase 3 columns to exam_sections table
ALTER TABLE exam_sections ADD COLUMN instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE exam_sections ADD COLUMN is_mandatory INTEGER NOT NULL DEFAULT 1;
ALTER TABLE exam_sections ADD COLUMN time_limit_minutes INTEGER NOT NULL DEFAULT 0;

-- 3. Add Phase 3 columns to exam_sessions table
ALTER TABLE exam_sessions ADD COLUMN question_order_json TEXT;
ALTER TABLE exam_sessions ADD COLUMN option_order_json TEXT;
ALTER TABLE exam_sessions ADD COLUMN current_section_id TEXT;
ALTER TABLE exam_sessions ADD COLUMN traversed_route_json TEXT;
ALTER TABLE exam_sessions ADD COLUMN last_heartbeat_at INTEGER;

-- 4. Additional performance indices
CREATE INDEX IF NOT EXISTS idx_exam_sessions_heartbeat ON exam_sessions(exam_id, last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_exams_status_time ON exams(status, start_time, end_time);
