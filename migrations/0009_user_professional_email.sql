-- Migration 0009: User Professional Email and Membership Tracking
-- Adds missing professional email columns and indices for D1 parity

ALTER TABLE users ADD COLUMN professional_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_professional_email ON users(professional_email);
ALTER TABLE classroom_members ADD COLUMN user_professional_email TEXT;
