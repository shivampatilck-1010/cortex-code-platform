const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/lib/classroom/db/index.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add table schemas before indexes
const tableTarget = `      CREATE INDEX IF NOT EXISTS idx_events_room_seq ON classroom_events(classroom_id, sequence);`;

const newTables = `      CREATE TABLE IF NOT EXISTS classroom_whiteboards (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        pages_json TEXT NOT NULL,
        active_page_index INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(classroom_id, session_id),
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS classroom_presentations (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        deck_json TEXT NOT NULL,
        active_slide_index INTEGER NOT NULL DEFAULT 0,
        is_presenting INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(classroom_id, session_id),
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_whiteboards_room ON classroom_whiteboards(classroom_id, session_id);
      CREATE INDEX IF NOT EXISTS idx_presentations_room ON classroom_presentations(classroom_id, session_id);
      CREATE INDEX IF NOT EXISTS idx_events_room_seq ON classroom_events(classroom_id, sequence);`;

if (!content.includes('CREATE TABLE IF NOT EXISTS classroom_whiteboards')) {
  if (content.includes(tableTarget)) {
    content = content.replace(tableTarget, newTables);
  } else {
    content = content.replace(tableTarget.replace(/\n/g, '\r\n'), newTables.replace(/\n/g, '\r\n'));
  }
}

// 2. Add methods to ClassroomDatabase class
const methodBlock = `
  // Whiteboard State Persistence
  async getWhiteboard(classroomId: string, sessionId: string = 'default') {
    const db = await this.getDb();
    const row: any = await db.prepare(
      \`SELECT * FROM classroom_whiteboards WHERE classroom_id = ? AND session_id = ?\`
    ).get(classroomId.toUpperCase().trim(), sessionId);
    if (!row) return null;
    return {
      id: row.id,
      classroomId: row.classroom_id,
      sessionId: row.session_id,
      pages: JSON.parse(row.pages_json),
      activePageIndex: row.active_page_index,
      version: row.version,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async saveWhiteboard(
    classroomId: string,
    sessionId: string = 'default',
    pages: any[],
    activePageIndex: number = 0,
    updatedBy: string = 'system',
    expectedVersion?: number
  ) {
    const db = await this.getDb();
    const normClassroomId = classroomId.toUpperCase().trim();
    const now = Date.now();
    const pagesJson = JSON.stringify(pages);

    const existing: any = await db.prepare(
      \`SELECT id, version FROM classroom_whiteboards WHERE classroom_id = ? AND session_id = ?\`
    ).get(normClassroomId, sessionId);

    if (existing) {
      if (typeof expectedVersion === 'number' && expectedVersion > 0 && existing.version !== expectedVersion) {
        throw new Error('VERSION_CONFLICT: Whiteboard has been updated by another session. Please reload.');
      }
      const newVersion = (existing.version || 1) + 1;
      await db.prepare(
        \`UPDATE classroom_whiteboards SET pages_json = ?, active_page_index = ?, version = ?, updated_by = ?, updated_at = ? WHERE id = ?\`
      ).run(pagesJson, activePageIndex, newVersion, updatedBy, now, existing.id);

      return {
        id: existing.id,
        classroomId: normClassroomId,
        sessionId,
        pages,
        activePageIndex,
        version: newVersion,
        updatedBy,
        updatedAt: now,
      };
    } else {
      const id = 'wb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await db.prepare(
        \`INSERT INTO classroom_whiteboards (id, classroom_id, session_id, pages_json, active_page_index, version, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`
      ).run(id, normClassroomId, sessionId, pagesJson, activePageIndex, 1, updatedBy, now, now);

      return {
        id,
        classroomId: normClassroomId,
        sessionId,
        pages,
        activePageIndex,
        version: 1,
        updatedBy,
        updatedAt: now,
      };
    }
  }

  // Presentation State Persistence
  async getPresentation(classroomId: string, sessionId: string = 'default') {
    const db = await this.getDb();
    const row: any = await db.prepare(
      \`SELECT * FROM classroom_presentations WHERE classroom_id = ? AND session_id = ?\`
    ).get(classroomId.toUpperCase().trim(), sessionId);
    if (!row) return null;
    return {
      id: row.id,
      classroomId: row.classroom_id,
      sessionId: row.session_id,
      deck: JSON.parse(row.deck_json),
      activeSlideIndex: row.active_slide_index,
      isPresenting: Boolean(row.is_presenting),
      version: row.version,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async savePresentation(
    classroomId: string,
    sessionId: string = 'default',
    deck: any,
    activeSlideIndex: number = 0,
    isPresenting: boolean = false,
    updatedBy: string = 'system',
    expectedVersion?: number
  ) {
    const db = await this.getDb();
    const normClassroomId = classroomId.toUpperCase().trim();
    const now = Date.now();
    const deckJson = JSON.stringify(deck);

    const existing: any = await db.prepare(
      \`SELECT id, version FROM classroom_presentations WHERE classroom_id = ? AND session_id = ?\`
    ).get(normClassroomId, sessionId);

    if (existing) {
      if (typeof expectedVersion === 'number' && expectedVersion > 0 && existing.version !== expectedVersion) {
        throw new Error('VERSION_CONFLICT: Presentation has been modified by another session. Please reload.');
      }
      const newVersion = (existing.version || 1) + 1;
      await db.prepare(
        \`UPDATE classroom_presentations SET deck_json = ?, active_slide_index = ?, is_presenting = ?, version = ?, updated_by = ?, updated_at = ? WHERE id = ?\`
      ).run(deckJson, activeSlideIndex, isPresenting ? 1 : 0, newVersion, updatedBy, now, existing.id);

      return {
        id: existing.id,
        classroomId: normClassroomId,
        sessionId,
        deck,
        activeSlideIndex,
        isPresenting,
        version: newVersion,
        updatedBy,
        updatedAt: now,
      };
    } else {
      const id = 'pres_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await db.prepare(
        \`INSERT INTO classroom_presentations (id, classroom_id, session_id, deck_json, active_slide_index, is_presenting, version, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
      ).run(id, normClassroomId, sessionId, deckJson, activeSlideIndex, isPresenting ? 1 : 0, 1, updatedBy, now, now);

      return {
        id,
        classroomId: normClassroomId,
        sessionId,
        deck,
        activeSlideIndex,
        isPresenting,
        version: 1,
        updatedBy,
        updatedAt: now,
      };
    }
  }
`;

if (!content.includes('async getWhiteboard')) {
  // Insert before the last closing brace of the file
  const lastBraceIdx = content.lastIndexOf('}');
  content = content.slice(0, lastBraceIdx) + methodBlock + '\n}\n';
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added whiteboard & presentation persistence to ClassroomDatabase');
