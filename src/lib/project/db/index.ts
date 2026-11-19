import { DBInstance, getDbInstance } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  language: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  path: string;
  content: string;
  isFolder: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  language: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface ProjectFileRow {
  id: string;
  project_id: string;
  name: string;
  path: string;
  content: string;
  is_folder: number;
  created_at: number;
  updated_at: number;
}


class SqliteWrapper implements DBInstance {
  constructor(private sqlite: any) {}
  async exec(sql: string): Promise<void> {
    this.sqlite.exec(sql);
  }
  prepare(sql: string) {
    return {
      run: async (...params: any[]) => {
        return this.sqlite.prepare(sql).run(...params);
      },
      get: async (...params: any[]) => {
        return this.sqlite.prepare(sql).get(...params);
      },
      all: async (...params: any[]) => {
        return this.sqlite.prepare(sql).all(...params);
      }
    };
  }
}

class ProjectDatabase {
  public db: DBInstance | null = null;
  private dbPath: string = '';
  private initialized: boolean = false;

  constructor() {}

  private async getDb(): Promise<DBInstance> {
    await this.init();
    return this.db!;
  }

  private async init() {
    if (this.initialized) return;
    try {
        const dataDir = path.join(process.cwd(), 'data');
        this.dbPath = path.join(dataDir, 'cortex_classroom.db');
        this.db = await getDbInstance(this.dbPath);
    } catch(e) {
        console.warn('[ProjectDatabase] Failed to init DB:', e);
        this.db = null;
    }
    this.initialized = true;
    if (this.db) {
        await this.createTables();
    }
  }

  private async createTables() {
    if (!(await this.getDb())) return;

    await (await this.getDb()).exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        language TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        is_folder INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS github_connections (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          github_user_id TEXT NOT NULL,
          github_username TEXT NOT NULL,
          access_token TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_github_links (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL UNIQUE,
          repo_owner TEXT NOT NULL,
          repo_name TEXT NOT NULL,
          default_branch TEXT NOT NULL DEFAULT 'main',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

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

      CREATE TABLE IF NOT EXISTS sql_query_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        query TEXT NOT NULL,
        dialect TEXT NOT NULL DEFAULT 'sqlite',
        row_count INTEGER NOT NULL DEFAULT 0,
        execution_time_ms INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sql_query_history ON sql_query_history(project_id, created_at DESC);
    `);
  }

  // --- Projects ---
  async createProject(p: Project): Promise<Project> {
    if (!(await this.getDb())) return p;
    await (await this.getDb()).prepare(`
      INSERT INTO projects (id, owner_id, name, description, language, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(p.id || '', p.ownerId || '', p.name || '', p.description || '', p.language || '', p.status || '', p.createdAt || 0, p.updatedAt || 0);
    return p;
  }

  async getProject(id: string): Promise<Project | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | null;
    if (!row) return null;
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      description: row.description || '',
      language: row.language,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listProjectsForUser(ownerId: string): Promise<Project[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC').all(ownerId) as ProjectRow[];
    return rows.map(row => ({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      description: row.description || '',
      language: row.language,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    if (!(await this.getDb())) return null;
    const existing = await this.getProject(id);
    if (!existing) return null;
    const p = { ...existing, ...updates, updatedAt: Date.now() };
    await (await this.getDb()).prepare(`
      UPDATE projects SET name = ?, description = ?, language = ?, status = ?, updated_at = ? WHERE id = ?
    `).run(p.name, p.description, p.language, p.status, p.updatedAt, id);
    return p;
  }

  async deleteProject(id: string): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  // --- Files ---
  async createFile(f: ProjectFile): Promise<ProjectFile> {
    if (!(await this.getDb())) return f;
    await (await this.getDb()).prepare(`
      INSERT INTO project_files (id, project_id, name, path, content, is_folder, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(f.id || '', f.projectId || '', f.name || '', f.path || '', f.content || '', f.isFolder ? 1 : 0, f.createdAt || 0, f.updatedAt || 0);
    return f;
  }

  async getFile(id: string): Promise<ProjectFile | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM project_files WHERE id = ?').get(id) as ProjectFileRow | null;
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      path: row.path,
      content: row.content,
      isFolder: Boolean(row.is_folder),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listFilesForProject(projectId: string): Promise<ProjectFile[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY path ASC').all(projectId) as ProjectFileRow[];
    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      path: row.path,
      content: row.content,
      isFolder: Boolean(row.is_folder),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async updateFile(id: string, updates: Partial<ProjectFile>): Promise<ProjectFile | null> {
    if (!(await this.getDb())) return null;
    const existing = await this.getFile(id);
    if (!existing) return null;
    const f = { ...existing, ...updates, updatedAt: Date.now() };
    await (await this.getDb()).prepare(`
      UPDATE project_files SET name = ?, path = ?, content = ?, is_folder = ?, updated_at = ? WHERE id = ?
    `).run(f.name, f.path, f.content, f.isFolder ? 1 : 0, f.updatedAt, id);
    return f;
  }

  async deleteFile(id: string): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('DELETE FROM project_files WHERE id = ?').run(id);
  }

  async listAllFilesForUser(ownerId: string): Promise<{
    project: Project;
    files: ProjectFile[];
  }[]> {
    if (!(await this.getDb())) return [];
    const projects = await this.listProjectsForUser(ownerId);
    const result: { project: Project; files: ProjectFile[] }[] = [];
    for (const project of projects) {
      const files = await this.listFilesForProject(project.id);
      result.push({ project, files });
    }
    return result;
  }

  // --- GitHub Integration ---
  
  async getGitHubConnection(userId: string) {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM github_connections WHERE user_id = ?').get(userId);
  }

  async saveGitHubConnection(userId: string, githubUserId: string, githubUsername: string, accessToken: string) {
    if (!(await this.getDb())) return;
    const now = Date.now();
    await (await this.getDb()).prepare(
      'INSERT INTO github_connections (id, user_id, github_user_id, github_username, access_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET github_user_id=excluded.github_user_id, github_username=excluded.github_username, access_token=excluded.access_token, updated_at=excluded.updated_at'
    ).run("ghc_" + now, userId, githubUserId, githubUsername, accessToken, now, now);
  }

  async deleteGitHubConnection(userId: string) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('DELETE FROM github_connections WHERE user_id = ?').run(userId);
  }

  async getProjectGitHubLink(projectId: string) {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM project_github_links WHERE project_id = ?').get(projectId);
  }

  async saveProjectGitHubLink(projectId: string, repoOwner: string, repoName: string, defaultBranch: string = 'main') {
    if (!(await this.getDb())) return;
    const now = Date.now();
    await (await this.getDb()).prepare(
      'INSERT INTO project_github_links (id, project_id, repo_owner, repo_name, default_branch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET repo_owner=excluded.repo_owner, repo_name=excluded.repo_name, default_branch=excluded.default_branch, updated_at=excluded.updated_at'
    ).run("pgh_" + now, projectId, repoOwner, repoName, defaultBranch, now, now);
  }

  async deleteProjectGitHubLink(projectId: string) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('DELETE FROM project_github_links WHERE project_id = ?').run(projectId);
  }

  // --- File Versions ---
  async createFileVersion(fileId: string, projectId: string, content: string): Promise<any> {
    if (!(await this.getDb())) return null;
    const now = Date.now();
    const maxRow = await (await this.getDb()).prepare(
      'SELECT MAX(version_number) as max_v FROM project_file_versions WHERE file_id = ?'
    ).get(fileId) as { max_v: number | null } | null;
    const nextVersion = (maxRow?.max_v || 0) + 1;
    const versionId = `ver_${fileId}_${nextVersion}_${now}`;

    await (await this.getDb()).prepare(`
      INSERT INTO project_file_versions (id, file_id, project_id, version_number, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(versionId, fileId, projectId, nextVersion, content, now);

    try {
      const allVers = await (await this.getDb()).prepare(
        'SELECT id FROM project_file_versions WHERE file_id = ? ORDER BY version_number DESC'
      ).all(fileId) as Array<{ id: string }>;
      if (allVers.length > 20) {
        const toDelete = allVers.slice(20);
        for (const v of toDelete) {
          await (await this.getDb()).prepare('DELETE FROM project_file_versions WHERE id = ?').run(v.id);
        }
      }
    } catch (e) {
      console.warn('[ProjectDb] Version pruning warning:', e);
    }

    return {
      id: versionId,
      fileId,
      projectId,
      versionNumber: nextVersion,
      content,
      createdAt: now,
    };
  }

  async listFileVersions(fileId: string): Promise<any[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare(
      'SELECT id, file_id, project_id, version_number, created_at, LENGTH(content) as content_length FROM project_file_versions WHERE file_id = ? ORDER BY version_number DESC'
    ).all(fileId) as any[];
    return rows.map(r => ({
      id: r.id,
      fileId: r.file_id,
      projectId: r.project_id,
      versionNumber: r.version_number,
      createdAt: r.created_at,
      contentLength: r.content_length,
    }));
  }

  async getFileVersion(versionId: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare(
      'SELECT * FROM project_file_versions WHERE id = ?'
    ).get(versionId) as any;
    if (!row) return null;
    return {
      id: row.id,
      fileId: row.file_id,
      projectId: row.project_id,
      versionNumber: row.version_number,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  async restoreFileVersion(fileId: string, versionId: string): Promise<ProjectFile | null> {
    if (!(await this.getDb())) return null;
    const ver = await this.getFileVersion(versionId);
    if (!ver || ver.fileId !== fileId) return null;

    const existing = await this.getFile(fileId);
    if (existing && existing.content !== ver.content) {
      await this.createFileVersion(fileId, existing.projectId, existing.content);
    }

    return await this.updateFile(fileId, { content: ver.content });
  }

  // --- SQL History ---
  async logSqlQuery(userId: string, projectId: string, query: string, dialect: string, rowCount: number, executionTimeMs: number): Promise<void> {
    if (!(await this.getDb())) return;
    const now = Date.now();
    const id = `sqlh_${now}_${Math.random().toString(36).substring(2, 7)}`;
    await (await this.getDb()).prepare(`
      INSERT INTO sql_query_history (id, user_id, project_id, query, dialect, row_count, execution_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, projectId, query, dialect, rowCount, executionTimeMs, now);
  }

  async listSqlQueryHistory(projectId: string, limit: number = 50): Promise<any[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare(
      'SELECT * FROM sql_query_history WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(projectId, limit) as any[];
    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      projectId: r.project_id,
      query: r.query,
      dialect: r.dialect,
      rowCount: r.row_count,
      executionTimeMs: r.execution_time_ms,
      createdAt: r.created_at,
    }));
  }



}

export const projectDb = new ProjectDatabase();
