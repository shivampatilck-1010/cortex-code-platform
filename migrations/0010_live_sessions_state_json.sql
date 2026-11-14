-- Migration 0010: Live Sessions State Persistence
-- Adds state_json and updated_at columns and index for live classroom state hydration and hibernation durability

ALTER TABLE live_sessions ADD COLUMN state_json TEXT;
ALTER TABLE live_sessions ADD COLUMN updated_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_live_sessions_room_status ON live_sessions(classroom_id, status);
