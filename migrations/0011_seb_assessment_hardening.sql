-- Cortex Online Examination & Assessment System — Hardening & SEB Parity
-- Migration 0011: Adds SEB security, duration, and safe branding controls to assignments & exams,
-- and introduces persistent single-use launch token replay protection.

-- 1. Extend assignments table with Safe Exam Browser (SEB) security and branding controls
ALTER TABLE assignments ADD COLUMN security_level TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE assignments ADD COLUMN seb_config_key TEXT;
ALTER TABLE assignments ADD COLUMN seb_browser_exam_key TEXT;
ALTER TABLE assignments ADD COLUMN seb_quit_password TEXT;
ALTER TABLE assignments ADD COLUMN seb_quit_password_hash TEXT;
ALTER TABLE assignments ADD COLUMN seb_allow_reload INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN seb_show_reload_warning INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assignments ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN branding_theme_json TEXT NOT NULL DEFAULT '{}';

-- 2. Extend exams table with safe branding theme controls
ALTER TABLE exams ADD COLUMN branding_theme_json TEXT NOT NULL DEFAULT '{}';

-- 3. Create persistent single-use SEB launch token registry for replay attack prevention
CREATE TABLE IF NOT EXISTS seb_consumed_tokens (
  nonce TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  consumed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 4. Create performance indices for token cleanup and assessment queries
CREATE INDEX IF NOT EXISTS idx_seb_consumed_tokens_expires ON seb_consumed_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_seb_consumed_tokens_lookup ON seb_consumed_tokens(assessment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_security ON assignments(classroom_id, security_level);
