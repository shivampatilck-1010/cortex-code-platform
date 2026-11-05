-- Migration: Project Teams & Formation Studio Foundation
CREATE TABLE IF NOT EXISTS classroom_team_settings (
  classroom_id TEXT PRIMARY KEY,
  formation_mode TEXT NOT NULL DEFAULT 'teacher_controlled',
  joining_policy TEXT NOT NULL DEFAULT 'direct',
  min_team_size INTEGER NOT NULL DEFAULT 2,
  max_team_size INTEGER NOT NULL DEFAULT 5,
  allow_multiple_teams INTEGER NOT NULL DEFAULT 0,
  membership_locked INTEGER NOT NULL DEFAULT 0,
  theme_policy TEXT NOT NULL DEFAULT 'teacher_controlled',
  creation_deadline INTEGER,
  joining_deadline INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_teams (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL,
  name TEXT NOT NULL,
  project_title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'forming',
  theme_preset TEXT NOT NULL DEFAULT 'cortex_signature',
  proposed_theme_preset TEXT,
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS project_team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  team_role TEXT NOT NULL DEFAULT 'member',
  membership_status TEXT NOT NULL DEFAULT 'active',
  assigned_by TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES project_teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_activity_records (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES project_teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_teams_classroom ON project_teams(classroom_id, status);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON project_team_members(team_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON project_team_members(user_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_project_activity_room ON project_activity_records(classroom_id, team_id, created_at);
