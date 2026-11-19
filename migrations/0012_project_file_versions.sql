-- Cortex IDE — Project File Revision History & Versioning
-- Migration 0012: Adds project_file_versions table and index for cloud file revision tracking and rollback

CREATE TABLE IF NOT EXISTS project_file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (file_id) REFERENCES project_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_versions ON project_file_versions(file_id, version_number DESC);
