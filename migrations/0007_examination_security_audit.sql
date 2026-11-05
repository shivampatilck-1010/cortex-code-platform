-- Cortex Online Examination System — Phase 3.1 Security Hardening & Audit Remediation
-- Schema updates for Safe Exam Browser secrets hashing and query optimization

-- 1. Add hashed quit password column to exams table
ALTER TABLE exams ADD COLUMN seb_quit_password_hash TEXT;

-- 2. Indices for security level filtering and response timestamp ordering
CREATE INDEX IF NOT EXISTS idx_exams_security ON exams(security_level, status);
CREATE INDEX IF NOT EXISTS idx_exam_responses_session_updated ON exam_question_responses(session_id, updated_at);
