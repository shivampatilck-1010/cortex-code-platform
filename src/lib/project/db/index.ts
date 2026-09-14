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
    const row = await (await this.getDb()).prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
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
    const rows = await (await this.getDb()).prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC').all(ownerId) as any[];
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
    const row = await (await this.getDb()).prepare('SELECT * FROM project_files WHERE id = ?').get(id) as any;
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
    const rows = await (await this.getDb()).prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY path ASC').all(projectId) as any[];
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
}

export const projectDb = new ProjectDatabase();
