import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { createRequire } from 'module';

export type SqlDialect = 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'oracle';

export interface SqlQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  dialect?: SqlDialect;
  warning?: string;
}

export type SqlExecutionResult = SqlQueryResult;

export interface SqlTableIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface SqlTableColumn {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  notnull: boolean;
}

export interface SqlTableSchema {
  name: string;
  columns: SqlTableColumn[];
  rowCount: number;
  indexes: SqlTableIndex[];
}

// Global cache of initialized DatabaseSync instances per project
const dbInstances = new Map<string, any>();

function getDatabaseSyncClass(): any {
  try {
    if (typeof require !== 'undefined') {
      return require('node:sqlite').DatabaseSync;
    }
    const customReq = createRequire(import.meta.url);
    return customReq('node:sqlite').DatabaseSync;
  } catch (e) {
    return null;
  }
}

/**
 * Get or initialize isolated SQLite database for a project
 */
export async function getProjectPracticeDb(projectId: string): Promise<any> {
  const sanitizedId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (dbInstances.has(sanitizedId)) {
    return dbInstances.get(sanitizedId);
  }

  const DatabaseSync = getDatabaseSyncClass();
  if (!DatabaseSync) {
    // If running in edge without node:sqlite, return null
    return null;
  }

  let db: any = null;
  const candidatePaths = [
    path.join(process.cwd(), 'data', 'practice', `sql_${sanitizedId}.db`),
    path.join(os.tmpdir(), 'cortex-practice-db', `sql_${sanitizedId}.db`),
    ':memory:',
  ];

  for (const candidate of candidatePaths) {
    try {
      if (candidate !== ':memory:') {
        const dir = path.dirname(candidate);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // Verify directory and existing DB file are actually writable (SQLite opens existing read-only DBs lazily)
        const rwProbe = path.join(
          dir,
          `.rw_probe_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        );
        fs.writeFileSync(rwProbe, '');
        fs.unlinkSync(rwProbe);
        if (fs.existsSync(candidate)) {
          const fd = fs.openSync(candidate, 'r+');
          fs.closeSync(fd);
        }
      }
      db = new DatabaseSync(candidate);
      break;
    } catch {
      // try next candidate path if permission denied or unavailable
    }
  }

  if (!db) {
    try {
      db = new DatabaseSync(':memory:');
    } catch {
      return null;
    }
  }

  db.exec('PRAGMA foreign_keys = ON;');
  dbInstances.set(sanitizedId, db);

  // Initialize sample tables if empty
  await initializeSampleDataset(db);

  return db;
}

/**
 * Seed initial sample dataset
 */
export async function initializeSampleDataset(db: any): Promise<void> {
  // Oracle/ANSI compatibility view DUAL
  db.exec("CREATE VIEW IF NOT EXISTS DUAL AS SELECT 'X' AS DUMMY;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      major TEXT,
      gpa REAL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY,
      course_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      credits INTEGER,
      department TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY,
      student_id INTEGER,
      course_id INTEGER,
      grade TEXT,
      semester TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  // Check if students is empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM students');
  const countRes = countStmt.get() as { count: number };
  if (countRes && countRes.count === 0) {
    db.exec(`
      INSERT INTO students (id, name, email, major, gpa) VALUES
        (1, 'Alex Morgan', 'alex.morgan@cortex.edu', 'Computer Science', 3.85),
        (2, 'Jordan Lee', 'jordan.lee@cortex.edu', 'Data Science', 3.92),
        (3, 'Taylor Swift', 'taylor.s@cortex.edu', 'Software Engineering', 3.74),
        (4, 'Devon Patel', 'devon.p@cortex.edu', 'Computer Science', 3.65),
        (5, 'Casey Zhang', 'casey.z@cortex.edu', 'Information Systems', 3.50);
    `);

    db.exec(`
      INSERT INTO courses (id, course_code, title, credits, department) VALUES
        (101, 'CS101', 'Intro to Computer Science', 4, 'Computer Science'),
        (102, 'CS201', 'Data Structures & Algorithms', 4, 'Computer Science'),
        (103, 'DS105', 'Database Management Systems', 3, 'Data Science'),
        (104, 'SE301', 'Cloud Software Engineering', 3, 'Software Engineering'),
        (105, 'AI401', 'Machine Learning Foundations', 4, 'Artificial Intelligence');
    `);

    db.exec(`
      INSERT INTO enrollments (id, student_id, course_id, grade, semester) VALUES
        (1, 1, 101, 'A', 'Fall 2024'),
        (2, 1, 103, 'A-', 'Fall 2024'),
        (3, 2, 102, 'A', 'Fall 2024'),
        (4, 2, 103, 'A+', 'Fall 2024'),
        (5, 3, 101, 'B+', 'Fall 2024'),
        (6, 4, 104, 'A', 'Spring 2025'),
        (7, 5, 103, 'B', 'Spring 2025');
    `);
  }
}

/**
 * Reset project practice database back to original sample dataset
 */
export async function resetPracticeDb(projectId: string): Promise<SqlTableSchema[]> {
  const sanitizedId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const db = await getProjectPracticeDb(sanitizedId);
  if (!db) {
    throw new Error('Database engine unavailable');
  }

  // Disable foreign keys temporarily while dropping views and tables
  db.exec('PRAGMA foreign_keys = OFF;');

  try {
    // Drop existing views first
    const viewsStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name NOT LIKE 'sqlite_%'");
    const views = viewsStmt.all() as Array<{ name: string }>;
    for (const v of views) {
      db.exec(`DROP VIEW IF EXISTS "${v.name}"`);
    }

    // Drop existing tables
    const tablesStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tables = tablesStmt.all() as Array<{ name: string }>;
    for (const t of tables) {
      db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
    }

    // Re-seed sample data (creates DUAL view, tables, and seed rows)
    await initializeSampleDataset(db);
  } finally {
    // Re-enable foreign keys after re-seeding
    db.exec('PRAGMA foreign_keys = ON;');
  }

  return await getPracticeDbSchema(sanitizedId);
}

/**
 * Inspect schema of current practice database
 */
export async function getPracticeDbSchema(projectId: string): Promise<SqlTableSchema[]> {
  const sanitizedId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const db = await getProjectPracticeDb(sanitizedId);
  if (!db) return [];

  const tablesStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC");
  const tables = tablesStmt.all() as Array<{ name: string }>;

  const schemas: SqlTableSchema[] = [];
  for (const t of tables) {
    const infoStmt = db.prepare(`PRAGMA table_info("${t.name}")`);
    const cols = infoStmt.all() as Array<{ name: string; type: string; notnull: number; pk: number }>;

    let rowCount = 0;
    try {
      const countStmt = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`);
      rowCount = (countStmt.get() as any)?.c || 0;
    } catch {}

    const indexes: SqlTableIndex[] = [];
    try {
      const idxListStmt = db.prepare(`PRAGMA index_list("${t.name}")`);
      const idxList = idxListStmt.all() as Array<{ seq: number; name: string; unique: number; origin?: string }>;
      for (const idx of idxList) {
        try {
          const idxInfoStmt = db.prepare(`PRAGMA index_info("${idx.name}")`);
          const idxInfo = idxInfoStmt.all() as Array<{ seqno: number; cid: number; name: string }>;
          indexes.push({
            name: idx.name,
            columns: idxInfo.map(info => info.name).filter(Boolean),
            unique: Boolean(idx.unique),
          });
        } catch {}
      }
    } catch {}

    schemas.push({
      name: t.name,
      columns: cols.map(c => ({
        name: c.name,
        type: c.type || 'TEXT',
        notNull: Boolean(c.notnull),
        notnull: Boolean(c.notnull),
        pk: Boolean(c.pk),
      })),
      rowCount,
      indexes,
    });
  }

  return schemas;
}

/**
 * Strips SQL comments (-- line comments and block comments)
 * Replaces comments with whitespace to ensure adjacent tokens are not concatenated.
 * String-literal and identifier aware: comments inside quotes are NOT treated as comments.
 */
export function stripSqlComments(sql: string): string {
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inBracket = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (inSingleQuote) {
      result += ch;
      if (ch === "'") {
        if (next === "'") {
          result += next;
          i++;
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      result += ch;
      if (ch === '"') {
        if (next === '"') {
          result += next;
          i++;
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    if (inBacktick) {
      result += ch;
      if (ch === '`') {
        if (next === '`') {
          result += next;
          i++;
        } else {
          inBacktick = false;
        }
      }
      continue;
    }

    if (inBracket) {
      result += ch;
      if (ch === ']') {
        inBracket = false;
      }
      continue;
    }

    // Check for comment starts when outside quotes/identifiers
    if (ch === '-' && next === '-') {
      // Line comment: skip until \r or \n or EOF
      let j = i + 2;
      while (j < sql.length && sql[j] !== '\n' && sql[j] !== '\r') {
        j++;
      }
      result += ' ';
      i = j - 1; // loop increment will advance to j
      continue;
    }

    if (ch === '/' && next === '*') {
      // Block comment: skip until */ or EOF
      let j = i + 2;
      while (j < sql.length && !(sql[j] === '*' && sql[j + 1] === '/')) {
        j++;
      }
      result += ' ';
      i = j < sql.length ? j + 1 : sql.length; // after */
      continue;
    }

    // Check for quote/identifier starts
    if (ch === "'") {
      inSingleQuote = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = true;
      result += ch;
      continue;
    }
    if (ch === '`') {
      inBacktick = true;
      result += ch;
      continue;
    }
    if (ch === '[') {
      inBracket = true;
      result += ch;
      continue;
    }

    result += ch;
  }

  return result.trim();
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inBracket = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === '\n' || (ch === '\r' && next !== '\n')) inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (inSingleQuote) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next;
        i++;
      } else if (ch === "'") {
        inSingleQuote = false;
      }
      continue;
    }
    if (inDoubleQuote) {
      current += ch;
      if (ch === '"' && next === '"') {
        current += next;
        i++;
      } else if (ch === '"') {
        inDoubleQuote = false;
      }
      continue;
    }
    if (inBacktick) {
      current += ch;
      if (ch === '`' && next === '`') {
        current += next;
        i++;
      } else if (ch === '`') {
        inBacktick = false;
      }
      continue;
    }
    if (inBracket) {
      current += ch;
      if (ch === ']') {
        inBracket = false;
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      inLineComment = true;
      current += ch + next;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      current += ch + next;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = true;
      current += ch;
      continue;
    }
    if (ch === '`') {
      inBacktick = true;
      current += ch;
      continue;
    }
    if (ch === '[') {
      inBracket = true;
      current += ch;
      continue;
    }

    if (ch === ';') {
      if (stripSqlComments(current).length > 0) {
        statements.push(current.trim());
      }
      current = '';
      continue;
    }

    current += ch;
  }

  if (stripSqlComments(current).length > 0) {
    statements.push(current.trim());
  }

  return statements;
}

/**
 * Transpiles T-SQL SELECT TOP (n) ... to SELECT ... LIMIT n across query scopes,
 * correctly handling subqueries, multi-level SELECT TOPs, and string literals containing 'LIMIT'.
 */
function transpileMssqlTop(sql: string): string {
  let transSql = sql;
  const topRegex = /\bSELECT(\s+DISTINCT)?\s+TOP\s+(?:\(\s*(\d+)\s*\)|(\d+))\s+/i;

  let iterations = 0;
  const MAX_ITERATIONS = 50;

  while (iterations++ < MAX_ITERATIONS) {
    const match = transSql.match(topRegex);
    if (!match || match.index === undefined) break;

    const matchIndex = match.index;
    const distinctClause = match[1] || '';
    const topCount = match[2] || match[3];
    const startIndex = matchIndex + match[0].length;

    // Scan forward from startIndex to find the end of this SELECT scope (matching closing paren or semicolon or EOF)
    let parenDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let inBracket = false;
    let inLineComment = false;
    let inBlockComment = false;
    let endIndex = transSql.length;

    for (let i = startIndex; i < transSql.length; i++) {
      if (inLineComment) {
        if (transSql[i] === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (transSql[i] === '*' && transSql[i + 1] === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (inSingleQuote) {
        if (transSql[i] === "'" && transSql[i + 1] === "'") {
          i++; // escaped quote
        } else if (transSql[i] === "'") {
          inSingleQuote = false;
        }
        continue;
      }
      if (inDoubleQuote) {
        if (transSql[i] === '"' && transSql[i + 1] === '"') {
          i++;
        } else if (transSql[i] === '"') {
          inDoubleQuote = false;
        }
        continue;
      }
      if (inBacktick) {
        if (transSql[i] === '`' && transSql[i + 1] === '`') {
          i++;
        } else if (transSql[i] === '`') {
          inBacktick = false;
        }
        continue;
      }
      if (inBracket) {
        if (transSql[i] === ']' && transSql[i + 1] === ']') {
          i++;
        } else if (transSql[i] === ']') {
          inBracket = false;
        }
        continue;
      }

      // Check comments
      if (transSql[i] === '-' && transSql[i + 1] === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (transSql[i] === '/' && transSql[i + 1] === '*') {
        inBlockComment = true;
        i++;
        continue;
      }

      // Check quotes
      if (transSql[i] === "'") {
        inSingleQuote = true;
        continue;
      }
      if (transSql[i] === '"') {
        inDoubleQuote = true;
        continue;
      }
      if (transSql[i] === '`') {
        inBacktick = true;
        continue;
      }
      if (transSql[i] === '[') {
        inBracket = true;
        continue;
      }

      // Check parentheses
      if (transSql[i] === '(') {
        parenDepth++;
        continue;
      }
      if (transSql[i] === ')') {
        if (parenDepth > 0) {
          parenDepth--;
        } else {
          // Closed the subquery containing this SELECT TOP
          endIndex = i;
          break;
        }
        continue;
      }

      // Check semicolon at top level
      if (transSql[i] === ';' && parenDepth === 0) {
        endIndex = i;
        break;
      }

      // Check set operations at top level (UNION, INTERSECT, EXCEPT)
      if (parenDepth === 0) {
        const remaining = transSql.slice(i);
        if (/^\b(?:UNION|INTERSECT|EXCEPT)\b/i.test(remaining)) {
          endIndex = i;
          break;
        }
      }
    }

    const body = transSql.slice(startIndex, endIndex);

    // Check if body already has a LIMIT clause at top-level
    // Strip strings, quoted identifiers, and comments, then check for LIMIT outside nested parentheses
    const bodyClean = stripSqlComments(body)
      .replace(/'(?:''|[^'])*'/g, "''")
      .replace(/"(?:""|[^"])*"/g, '""')
      .replace(/\[(?:\]\]|[^\]])*\]/g, '[]')
      .replace(/`[^`]*`/g, '``');
    let strippedParen = bodyClean;
    while (/\([^()]*\)/.test(strippedParen)) {
      strippedParen = strippedParen.replace(/\([^()]*\)/g, '');
    }

    const hasLimit = /\bLIMIT\s+\d+/i.test(strippedParen);

    let newBody: string;
    if (!hasLimit) {
      const trimmedBody = body.trimEnd();
      const trailingWhitespace = body.slice(trimmedBody.length);
      newBody = `${trimmedBody} LIMIT ${topCount}${trailingWhitespace}`;
    } else {
      newBody = body;
    }

    transSql = transSql.slice(0, matchIndex) + 'SELECT' + distinctClause + ' ' + newBody + transSql.slice(endIndex);
  }

  return transSql;
}

/**
 * Single-pass SQL lexer for security checks and structural inspection.
 * Replaces -- and /* *\/ comments with whitespace and '...' string literals with ''.
 * When preserveIdentifiers is false, replaces "...", `...`, and [...] with "", ``, and [].
 * When preserveIdentifiers is true, preserves quoted/bracketed identifier contents so
 * quoted function/virtual-table names (e.g. "pragma_database_list", [load_extension])
 * cannot evade security validation.
 */
function scanSqlForSecurity(sqlText: string, preserveIdentifiers: boolean): string {
  let result = '';
  for (let i = 0; i < sqlText.length; i++) {
    const ch = sqlText[i];
    const next = i + 1 < sqlText.length ? sqlText[i + 1] : '';

    // Line comment
    if (ch === '-' && next === '-') {
      i += 2;
      while (i < sqlText.length && sqlText[i] !== '\n' && sqlText[i] !== '\r') {
        i++;
      }
      i--;
      result += ' ';
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < sqlText.length && !(sqlText[i] === '*' && sqlText[i + 1] === '/')) {
        i++;
      }
      if (i < sqlText.length) i++;
      result += ' ';
      continue;
    }

    // Single-quoted string literal
    if (ch === "'") {
      i++;
      while (i < sqlText.length) {
        if (sqlText[i] === "'" && sqlText[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sqlText[i] === "'") break;
        i++;
      }
      result += "''";
      continue;
    }

    // Double-quoted identifier
    if (ch === '"') {
      const start = i;
      i++;
      while (i < sqlText.length) {
        if (sqlText[i] === '"' && sqlText[i + 1] === '"') {
          i += 2;
          continue;
        }
        if (sqlText[i] === '"') break;
        i++;
      }
      result += preserveIdentifiers ? sqlText.slice(start, i + 1) : '""';
      continue;
    }

    // Backtick-quoted identifier
    if (ch === '`') {
      const start = i;
      i++;
      while (i < sqlText.length) {
        if (sqlText[i] === '`' && sqlText[i + 1] === '`') {
          i += 2;
          continue;
        }
        if (sqlText[i] === '`') break;
        i++;
      }
      result += preserveIdentifiers ? sqlText.slice(start, i + 1) : '``';
      continue;
    }

    // Bracket-quoted identifier (SQLite closes at first ']')
    if (ch === '[') {
      const start = i;
      i++;
      while (i < sqlText.length && sqlText[i] !== ']') {
        i++;
      }
      result += preserveIdentifiers ? sqlText.slice(start, i + 1) : '[]';
      continue;
    }

    result += ch;
  }

  return result.trim();
}

export function sanitizeSqlForSecurityCheck(sqlText: string): string {
  return scanSqlForSecurity(sqlText, false);
}

export function stripSqlCommentsAndStringLiterals(sqlText: string): string {
  return scanSqlForSecurity(sqlText, true);
}

function stripNestedParens(sqlCleanNoIds: string): string {
  let stripped = sqlCleanNoIds;
  while (/\([^()]*\)/.test(stripped)) {
    stripped = stripped.replace(/\([^()]*\)/g, ' ');
  }
  return stripped;
}

const MAX_RECURSIVE_CTE_LIMIT = 10000;

interface ParsedTopLevelLimit {
  matchIndex: number;
  count: number;
  offset: number;
}

function parseTopLevelLimit(
  sqlFragment: string,
  maxRows: number = MAX_RECURSIVE_CTE_LIMIT
): ParsedTopLevelLimit | null {
  const cleanNoIds = sanitizeSqlForSecurityCheck(sqlFragment);

  let match: RegExpMatchArray | null = null;
  let countStr = '';
  let offsetStr = '0';
  let hasOffsetForm = false;

  const limitOffsetMatch = cleanNoIds.match(/\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*;?\s*$/i);
  if (limitOffsetMatch && limitOffsetMatch.index !== undefined) {
    match = limitOffsetMatch;
    countStr = limitOffsetMatch[1];
    offsetStr = limitOffsetMatch[2];
    hasOffsetForm = true;
  } else {
    const commaMatch = cleanNoIds.match(/\bLIMIT\s+(\d+)\s*,\s*(\d+)\s*;?\s*$/i);
    if (commaMatch && commaMatch.index !== undefined) {
      match = commaMatch;
      offsetStr = commaMatch[1];
      countStr = commaMatch[2];
      hasOffsetForm = true;
    } else {
      const simpleMatch = cleanNoIds.match(/\bLIMIT\s+(\d+)\s*;?\s*$/i);
      if (simpleMatch && simpleMatch.index !== undefined) {
        match = simpleMatch;
        countStr = simpleMatch[1];
      }
    }
  }

  if (!match || match.index === undefined) return null;

  // Reject dangling OFFSET (e.g., OFFSET N LIMIT M) or multiple top-level LIMIT/OFFSET clauses
  if (!hasOffsetForm && /\bOFFSET\b/i.test(cleanNoIds)) return null;
  const topLevel = stripNestedParens(cleanNoIds);
  if ((topLevel.match(/\bLIMIT\b/gi) || []).length !== 1) return null;
  if ((topLevel.match(/\bOFFSET\b/gi) || []).length > (hasOffsetForm ? 1 : 0)) return null;

  // Verify paren depth at match.index is strictly 0
  let parenDepth = 0;
  for (let i = 0; i < match.index; i++) {
    if (cleanNoIds[i] === '(') parenDepth++;
    else if (cleanNoIds[i] === ')') {
      parenDepth--;
      if (parenDepth < 0) return null;
    }
  }
  if (parenDepth !== 0) return null;

  const count = Number(countStr);
  const offset = Number(offsetStr);
  if (
    !Number.isSafeInteger(count) ||
    !Number.isSafeInteger(offset) ||
    count < 0 ||
    offset < 0 ||
    count > maxRows ||
    offset > maxRows ||
    offset + count > maxRows
  ) {
    return null;
  }

  return {
    matchIndex: match.index,
    count,
    offset,
  };
}

function hasTopLevelLimit(sqlFragment: string, maxRows: number = MAX_RECURSIVE_CTE_LIMIT): boolean {
  return parseTopLevelLimit(sqlFragment, maxRows) !== null;
}

const ALLOWED_OUTER_CTE_PRE_PAREN_KEYWORDS = new Set([
  'select',
  'all',
  'and',
  'or',
  'not',
  'case',
  'when',
  'then',
  'else',
]);

function hasDisallowedParenOrFunctionCall(cleanWithIds: string): boolean {
  const len = cleanWithIds.length;
  for (let i = 0; i < len; i++) {
    const ch = cleanWithIds[i];
    if (ch === "'") {
      i++;
      while (i < len) {
        if (cleanWithIds[i] === "'" && cleanWithIds[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === "'") break;
        i++;
      }
      continue;
    }
    if (ch === '"') {
      i++;
      while (i < len) {
        if (cleanWithIds[i] === '"' && cleanWithIds[i + 1] === '"') {
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === '"') break;
        i++;
      }
      continue;
    }
    if (ch === '`') {
      i++;
      while (i < len) {
        if (cleanWithIds[i] === '`' && cleanWithIds[i + 1] === '`') {
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === '`') break;
        i++;
      }
      continue;
    }
    if (ch === '[') {
      i++;
      while (i < len && cleanWithIds[i] !== ']') {
        i++;
      }
      continue;
    }

    if (ch === '(') {
      let j = i - 1;
      while (j >= 0 && /\s/.test(cleanWithIds[j])) j--;
      if (j < 0) return true;
      const prev = cleanWithIds[j];
      if (prev === '"' || prev === ']' || prev === '`' || prev === "'" || prev === '.') {
        return true;
      }
      if (/[a-zA-Z0-9_$]/.test(prev)) {
        let start = j;
        while (start > 0 && /[a-zA-Z0-9_$]/.test(cleanWithIds[start - 1])) start--;
        const word = cleanWithIds.slice(start, j + 1).toLowerCase();
        if (!/^[a-z_]/.test(word) || !ALLOWED_OUTER_CTE_PRE_PAREN_KEYWORDS.has(word)) {
          return true;
        }
      }
    }
  }
  return false;
}

function findUnquotedFromEndIndex(cleanWithIds: string): number {
  const len = cleanWithIds.length;
  for (let i = 0; i < len; i++) {
    const ch = cleanWithIds[i];
    if (ch === "'") {
      i++;
      while (i < len) {
        if (cleanWithIds[i] === "'" && cleanWithIds[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === "'") break;
        i++;
      }
      continue;
    }
    if (ch === '"') {
      i++;
      while (i < len) {
        if (cleanWithIds[i] === '"' && cleanWithIds[i + 1] === '"') {
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === '"') break;
        i++;
      }
      continue;
    }
    if (ch === '`') {
      i++;
      while (i < len) {
        if (cleanWithIds[i] === '`' && cleanWithIds[i + 1] === '`') {
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === '`') break;
        i++;
      }
      continue;
    }
    if (ch === '[') {
      i++;
      while (i < len && cleanWithIds[i] !== ']') {
        i++;
      }
      continue;
    }
    if (
      (i === 0 || !/[a-zA-Z0-9_]/.test(cleanWithIds[i - 1])) &&
      /^FROM\b/i.test(cleanWithIds.slice(i))
    ) {
      return i + 4;
    }
  }
  return -1;
}

function canOuterLimitBoundCteStrict(
  mainQuery: string,
  ctes: Array<{ name: string; body: string; isMaterialized: boolean }>
): boolean {
  if (ctes.length !== 1 || ctes[0].isMaterialized) return false;
  const limitInfo = parseTopLevelLimit(mainQuery);
  if (!limitInfo) return false;

  const cleanNoIds = sanitizeSqlForSecurityCheck(mainQuery);
  const cleanWithIds = stripSqlCommentsAndStringLiterals(mainQuery);

  const coreNoIds = cleanNoIds.slice(0, limitInfo.matchIndex).trim();
  const coreWithIds = cleanWithIds
    .replace(/\bLIMIT\s+\d+(?:\s*,\s*\d+|\s+OFFSET\s+\d+)?\s*;?\s*$/i, '')
    .trim();

  // Outer LIMIT only short-circuits recursion when the outer query is a single flat SELECT
  // directly reading the single non-materialized CTE without filtering, sorting, grouping,
  // deduplication, subqueries, joins, windowing, set ops, or function calls.
  if (!/^\s*SELECT\b/i.test(coreNoIds)) return false;
  if (/^\s*SELECT\s+DISTINCT\b/i.test(coreNoIds)) return false;
  if ((coreNoIds.match(/\bSELECT\b/gi) || []).length !== 1) return false;
  if (
    /\b(?:WITH|VALUES|UNION|INTERSECT|EXCEPT|OVER|DISTINCT|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|WINDOW|JOIN|FILTER)\b/i.test(
      coreNoIds
    )
  ) {
    return false;
  }

  if (/\(\s*(?:SELECT|WITH|VALUES)\b/i.test(cleanWithIds)) return false;
  if (hasDisallowedParenOrFunctionCall(cleanWithIds)) return false;

  if ((coreNoIds.match(/\bFROM\b/gi) || []).length !== 1) return false;
  const fromPartsNoIds = coreNoIds.split(/\bFROM\b/i);
  if (fromPartsNoIds.length !== 2) return false;
  const projectionNoIds = fromPartsNoIds[0].replace(/^\s*SELECT(?:\s+ALL)?\b/i, '').trim();
  if (!projectionNoIds) return false;

  const fromPartNoIds = fromPartsNoIds[1];
  if (
    !/^\s*(?:[a-zA-Z_][a-zA-Z0-9_]*|""|``|\[\])(?:\s+(?:AS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*|""|``|\[\]))?\s*$/i.test(
      fromPartNoIds
    )
  ) {
    return false;
  }

  const fromEndIdx = findUnquotedFromEndIndex(coreWithIds);
  if (fromEndIdx === -1) return false;
  const fromSliceWithIds = coreWithIds.slice(fromEndIdx);
  const fromTableTokens = extractSqlIdentifierTokens(fromSliceWithIds);
  if (fromTableTokens.length === 0 || fromTableTokens[0] !== ctes[0].name) {
    return false;
  }

  return true;
}

function extractSqlIdentifierTokens(cleanWithIds: string): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < cleanWithIds.length; i++) {
    const ch = cleanWithIds[i];
    if (ch === "'") {
      i++;
      while (i < cleanWithIds.length) {
        if (cleanWithIds[i] === "'" && cleanWithIds[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === "'") break;
        i++;
      }
      continue;
    }
    if (ch === '"') {
      i++;
      let ident = '';
      while (i < cleanWithIds.length) {
        if (cleanWithIds[i] === '"' && cleanWithIds[i + 1] === '"') {
          ident += '"';
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === '"') break;
        ident += cleanWithIds[i];
        i++;
      }
      if (ident) tokens.push(ident.toLowerCase());
      continue;
    }
    if (ch === '`') {
      i++;
      let ident = '';
      while (i < cleanWithIds.length) {
        if (cleanWithIds[i] === '`' && cleanWithIds[i + 1] === '`') {
          ident += '`';
          i += 2;
          continue;
        }
        if (cleanWithIds[i] === '`') break;
        ident += cleanWithIds[i];
        i++;
      }
      if (ident) tokens.push(ident.toLowerCase());
      continue;
    }
    if (ch === '[') {
      i++;
      let ident = '';
      while (i < cleanWithIds.length && cleanWithIds[i] !== ']') {
        ident += cleanWithIds[i];
        i++;
      }
      if (ident) tokens.push(ident.toLowerCase());
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = ch;
      while (i + 1 < cleanWithIds.length && /[a-zA-Z0-9_]/.test(cleanWithIds[i + 1])) {
        i++;
        ident += cleanWithIds[i];
      }
      tokens.push(ident.toLowerCase());
    }
  }
  return tokens;
}

/**
 * Validates recursive CTE safety consistently across both database-engine and local-sandbox.
 * A CTE can recurse in SQLite only when it uses a top-level UNION / UNION ALL inside its CTE body
 * (either with WITH RECURSIVE or via self-reference). Non-looping WITH RECURSIVE ... UPDATE/SELECT
 * queries without UNION are allowed; looping recursive CTEs require an explicit top-level LIMIT.
 */
export function validateRecursiveCteSafety(sql: string): void {
  const statements = splitSqlStatements(sql);
  const stmtsToCheck = statements.length > 0 ? statements : [sql];

  const skipQuotedToken = (text: string, idx: number): number => {
    const ch = text[idx];
    if (ch === "'") {
      idx++;
      while (idx < text.length) {
        if (text[idx] === "'" && text[idx + 1] === "'") {
          idx += 2;
          continue;
        }
        if (text[idx] === "'") return idx + 1;
        idx++;
      }
      return idx;
    }
    if (ch === '"') {
      idx++;
      while (idx < text.length) {
        if (text[idx] === '"' && text[idx + 1] === '"') {
          idx += 2;
          continue;
        }
        if (text[idx] === '"') return idx + 1;
        idx++;
      }
      return idx;
    }
    if (ch === '`') {
      idx++;
      while (idx < text.length) {
        if (text[idx] === '`' && text[idx + 1] === '`') {
          idx += 2;
          continue;
        }
        if (text[idx] === '`') return idx + 1;
        idx++;
      }
      return idx;
    }
    if (ch === '[') {
      idx++;
      while (idx < text.length && text[idx] !== ']') {
        idx++;
      }
      return idx < text.length ? idx + 1 : idx;
    }
    return idx;
  };

  const findClosingParen = (text: string, openIdx: number): number => {
    if (text[openIdx] !== '(') return -1;
    let depth = 0;
    for (let j = openIdx; j < text.length; j++) {
      const c = text[j];
      if (c === "'" || c === '"' || c === '`' || c === '[') {
        j = skipQuotedToken(text, j) - 1;
        continue;
      }
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) return j;
      }
    }
    return -1;
  };

  for (const stmt of stmtsToCheck) {
    const clean = stripSqlCommentsAndStringLiterals(stmt);
    const len = clean.length;

    for (let i = 0; i < len; i++) {
      const ch = clean[i];
      if (ch === "'" || ch === '"' || ch === '`' || ch === '[') {
        i = skipQuotedToken(clean, i) - 1;
        continue;
      }

      if (
        (i === 0 || !/[a-zA-Z0-9_]/.test(clean[i - 1])) &&
        /^WITH\b/i.test(clean.slice(i))
      ) {
        let pos = i + 4;
        const skipWs = () => {
          while (pos < len && /\s/.test(clean[pos])) pos++;
        };
        skipWs();

        let isRecursiveKeyword = false;
        if (/^RECURSIVE\b/i.test(clean.slice(pos))) {
          isRecursiveKeyword = true;
          pos += 9;
          skipWs();
        }

        const ctes: Array<{ name: string; body: string; isMaterialized: boolean }> = [];
        let validWithList = true;
        while (pos < len) {
          skipWs();
          let cteName = '';
          const c = clean[pos];
          if (c === '"' || c === '`' || c === '[') {
            const nextPos = skipQuotedToken(clean, pos);
            const rawSlice = clean.slice(pos, nextPos);
            const tokens = extractSqlIdentifierTokens(rawSlice);
            cteName = tokens[0] || '';
            pos = nextPos;
          } else {
            const nameMatch = clean.slice(pos).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
            if (!nameMatch) {
              validWithList = false;
              break;
            }
            cteName = nameMatch[0].toLowerCase();
            pos += nameMatch[0].length;
          }
          if (!cteName) {
            validWithList = false;
            break;
          }

          skipWs();
          if (clean[pos] === '(') {
            const colEnd = findClosingParen(clean, pos);
            if (colEnd === -1) {
              validWithList = false;
              break;
            }
            pos = colEnd + 1;
            skipWs();
          }

          const asMatch = clean.slice(pos).match(/^AS\b(?:\s+(?:NOT\s+)?MATERIALIZED\b)?/i);
          if (!asMatch) {
            validWithList = false;
            break;
          }
          const isMaterialized = /\bAS\s+MATERIALIZED\b/i.test(asMatch[0]);
          pos += asMatch[0].length;
          skipWs();

          if (clean[pos] !== '(') {
            validWithList = false;
            break;
          }
          const bodyEnd = findClosingParen(clean, pos);
          if (bodyEnd === -1) {
            validWithList = false;
            break;
          }
          const cteBody = clean.slice(pos + 1, bodyEnd);
          ctes.push({ name: cteName, body: cteBody, isMaterialized });
          pos = bodyEnd + 1;

          skipWs();
          if (clean[pos] === ',') {
            pos++;
            continue;
          }
          break;
        }

        if (!validWithList || ctes.length === 0) {
          continue;
        }

        // Find end of the WITH statement/subquery scope
        let depth = 0;
        let scopeEnd = len;
        for (let k = pos; k < len; k++) {
          const c = clean[k];
          if (c === "'" || c === '"' || c === '`' || c === '[') {
            k = skipQuotedToken(clean, k) - 1;
            continue;
          }
          if (c === '(') depth++;
          else if (c === ')') {
            if (depth === 0) {
              scopeEnd = k;
              break;
            }
            depth--;
          } else if (c === ';' && depth === 0) {
            scopeEnd = k;
            break;
          }
        }
        const mainQuery = clean.slice(pos, scopeEnd);
        const mainBoundsCte = canOuterLimitBoundCteStrict(mainQuery, ctes);

        for (const cte of ctes) {
          const bodyTopLevel = stripNestedParens(sanitizeSqlForSecurityCheck(cte.body));
          const hasUnion = /\bUNION\b/i.test(bodyTopLevel);
          if (!hasUnion) continue;

          const bodyTokens = extractSqlIdentifierTokens(cte.body);
          const isSelfReferencing = bodyTokens.includes(cte.name);
          if (isRecursiveKeyword || isSelfReferencing) {
            const afterUnion = bodyTopLevel.split(/\bUNION\b/i).slice(1).join(' ');
            const cteSelfLimited = hasTopLevelLimit(cte.body) && !/\bORDER\s+BY\b/i.test(afterUnion);
            if (!cteSelfLimited && !mainBoundsCte) {
              throw new Error(
                'Recursive CTE queries must include an explicit LIMIT clause to prevent server process resource starvation.'
              );
            }
          }
        }
      }
    }
  }
}

export function validateSqlSandboxSecurity(
  sql: string,
  options?: { skipRecursiveCteCheck?: boolean }
): void {
  const cleanWithoutStrings = sanitizeSqlForSecurityCheck(sql);
  const cleanCommentsAndStrings = stripSqlCommentsAndStringLiterals(sql);
  const statements = splitSqlStatements(sql);

  // 1. Prohibit ATTACH or DETACH (with or without optional DATABASE keyword)
  if (/\b(?:ATTACH(?:\s+DATABASE)?|DETACH(?:\s+DATABASE)?)\b/i.test(cleanWithoutStrings)) {
    throw new Error('Access denied: ATTACH and DETACH commands are prohibited in sandboxed practice mode.');
  }

  // 2. Prohibit VACUUM ... INTO host file operations
  if (/\bVACUUM(?:\s+[a-zA-Z0-9_]+\s+|\s*(?:""|``|\[\])\s*|\s+)INTO\b/i.test(cleanWithoutStrings)) {
    throw new Error('Access denied: VACUUM INTO host file operations are prohibited in sandboxed practice mode.');
  }

  // 3. Prohibit pragma_* table-valued functions (including quoted/bracketed/backticked identifiers)
  if (/\bpragma_[a-zA-Z0-9_]+\b/i.test(cleanCommentsAndStrings)) {
    throw new Error('Access denied: pragma_* table-valued functions are prohibited in sandboxed practice mode.');
  }

  // 4. Prohibit modifying or administrative PRAGMA commands per statement; allow only read-only schema introspection
  const isProhibitedPragmaInStatement = (stmtText: string): boolean => {
    const cleanStmt = sanitizeSqlForSecurityCheck(stmtText);
    if (!/\bPRAGMA\b/i.test(cleanStmt)) return false;
    const isAdminPragma =
      /\bPRAGMA\s+(?:[a-zA-Z0-9_]+\.)?(?:writable_schema|default_cache_size|foreign_keys|journal_mode|synchronous|locking_mode|auto_vacuum|temp_store|wal_checkpoint|compile_options|database_list|hard_heap_limit|soft_heap_limit|max_page_count|page_size|secure_delete)\b/i.test(cleanStmt);
    const isAllowedPragma =
      /^\s*PRAGMA\s+(?:[a-zA-Z0-9_]+\.)?(?:table_info|index_list|index_info|foreign_key_list)\s*\([^()]*\)\s*$/i.test(cleanStmt);
    return isAdminPragma || !isAllowedPragma;
  };

  if (
    statements.length > 0
      ? statements.some(isProhibitedPragmaInStatement)
      : isProhibitedPragmaInStatement(cleanWithoutStrings)
  ) {
    throw new Error('Access denied: administrative or file-level PRAGMA commands are prohibited in sandboxed practice mode.');
  }

  // 5. Prohibit load_extension (including quoted/bracketed/backticked identifiers)
  if (/\bload_extension\b/i.test(cleanCommentsAndStrings)) {
    throw new Error('Access denied: loading external extensions is prohibited in sandboxed practice mode.');
  }

  // 6. Prohibit unconstrained recursive CTEs (shared with local-sandbox)
  if (!options?.skipRecursiveCteCheck) {
    validateRecursiveCteSafety(sql);
  }
}

export function isSqlDataQuery(statement: string): boolean {
  const clean = sanitizeSqlForSecurityCheck(statement);
  if (/^(?:\(|\s)*(?:SELECT\b|EXPLAIN\b|VALUES\b|PRAGMA\s+(?:[a-zA-Z0-9_]+\.)?(?:table_info|index_list|index_info|foreign_key_list)\b)/i.test(clean)) {
    return true;
  }
  const withMatch = clean.match(/^\s*WITH\b(?:\s+RECURSIVE\b)?/i);
  if (!withMatch) return false;

  let i = withMatch[0].length;
  const len = clean.length;
  const skipWs = () => {
    while (i < len && /\s/.test(clean[i])) i++;
  };
  const skipParens = (): boolean => {
    if (clean[i] !== '(') return false;
    let depth = 0;
    while (i < len) {
      if (clean[i] === '(') depth++;
      else if (clean[i] === ')') {
        depth--;
        if (depth === 0) {
          i++;
          return true;
        }
      }
      i++;
    }
    return false;
  };

  while (i < len) {
    skipWs();
    // CTE name
    const nameMatch = clean.slice(i).match(/^(?:[a-zA-Z_][a-zA-Z0-9_]*|""|``|\[\])/);
    if (!nameMatch) return false;
    i += nameMatch[0].length;
    skipWs();
    // Optional column list (...)
    if (clean[i] === '(') {
      if (!skipParens()) return false;
      skipWs();
    }
    // AS [NOT] MATERIALIZED
    const asMatch = clean.slice(i).match(/^AS\b(?:\s+(?:NOT\s+)?MATERIALIZED\b)?/i);
    if (!asMatch) return false;
    i += asMatch[0].length;
    skipWs();
    // CTE body (...)
    if (clean[i] !== '(' || !skipParens()) return false;
    skipWs();
    if (clean[i] === ',') {
      i++;
      continue;
    }
    break;
  }

  skipWs();
  return /^(?:SELECT|VALUES)\b/i.test(clean.slice(i));
}

/**
 * Check query for dangerous operations or unsupported dialect keywords
 */
function validateAndTranspileDialect(sql: string, dialect: SqlDialect): { transSql: string; warning?: string } {
  const trimmed = sql.trim();
  const cleanForCheck = stripSqlComments(trimmed);
  const cleanWithoutStrings = sanitizeSqlForSecurityCheck(trimmed);

  validateSqlSandboxSecurity(trimmed, { skipRecursiveCteCheck: true });

  let warning: string | undefined;
  let transSql = sql;

  // Transpile harmless database creation/selection (e.g. CREATE DATABASE x; USE x;) so standard scripts execute cleanly in sandbox
  transSql = transSql.replace(
    /^\s*(?:CREATE\s+DATABASE(?:\s+IF\s+NOT\s+EXISTS)?|USE)\s+[`"']?[a-zA-Z0-9_]+[`"']?\s*;?/gim,
    '-- [Practice Sandbox DB active]'
  );

  // Dialect specific checks & helpful keyword transpilation
  if (dialect === 'oracle') {
    if (/\b(CONNECT\s+BY|PRIOR|PL\/SQL|BULK\s+COLLECT|EXECUTE\s+IMMEDIATE)\b/i.test(cleanWithoutStrings)) {
      throw new Error('Oracle PL/SQL construct detected. Dialect feature requires connected external Oracle instance.');
    }
    // Map VARCHAR2(x) -> VARCHAR(x), NUMBER -> NUMERIC
    transSql = transSql.replace(/\bVARCHAR2\b/gi, 'VARCHAR').replace(/\bNUMBER\b/gi, 'NUMERIC');
    // Transpile NVL(a, b) -> IFNULL(a, b)
    transSql = transSql.replace(/\bNVL\s*\(/gi, 'IFNULL(');
    // Transpile SYSDATE -> CURRENT_TIMESTAMP
    transSql = transSql.replace(/\bSYSDATE\b/gi, 'CURRENT_TIMESTAMP');

    // Transpile Oracle ROWNUM <= n, ROWNUM < n, ROWNUM = n -> LIMIT n
    const andRownumMatch = transSql.match(/\bAND\s+ROWNUM\s*(<=|<|=)\s*(\d+)\b/i);
    const whereRownumMatch = transSql.match(/\bWHERE\s+ROWNUM\s*(<=|<|=)\s*(\d+)(?:\s+AND\b)?/i);
    const rownumMatch = andRownumMatch || whereRownumMatch;

    if (rownumMatch) {
      const op = rownumMatch[1];
      const rawCount = parseInt(rownumMatch[2], 10);
      const limit = op === '<' ? Math.max(0, rawCount - 1) : rawCount;
      if (whereRownumMatch && whereRownumMatch[0].toUpperCase().endsWith('AND')) {
        transSql = transSql.replace(whereRownumMatch[0], 'WHERE ').trim();
      } else {
        transSql = transSql.replace(rownumMatch[0], ' ').trim();
      }
      // Remove trailing or orphaned WHERE
      transSql = transSql.replace(/\bWHERE\s*(?:AND|;|$)/i, '').trim();
      const hasSemicolon = transSql.endsWith(';');
      if (hasSemicolon) transSql = transSql.slice(0, -1).trim();
      if (!/\bLIMIT\s+\d+/i.test(transSql)) {
        transSql = `${transSql} LIMIT ${limit}${hasSemicolon ? ';' : ''}`;
      } else if (hasSemicolon) {
        transSql = `${transSql};`;
      }
    }

    warning = 'Oracle dialect emulation active: standard ANSI SQL executed on isolated practice DB.';
  } else if (dialect === 'mysql') {
    // Transpile SHOW TABLES (allowing leading/trailing comments or whitespace, and optional FULL)
    if (/^\s*SHOW\s+(?:FULL\s+)?TABLES\s*;?\s*$/i.test(cleanForCheck)) {
      transSql = "SELECT name AS 'Tables_in_database' FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    } else if (/^\s*SHOW\s+(?:SCHEMAS|DATABASES)\s*;?\s*$/i.test(cleanForCheck)) {
      transSql = "SELECT 'cortex_practice_db' AS 'Database'";
    } else {
      // Allow backticks or quotes around table names in DESCRIBE/DESC
      const descMatch = cleanForCheck.match(/^\s*(?:DESCRIBE|DESC)\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s*;?\s*$/i);
      if (descMatch) {
        transSql = `PRAGMA table_info("${descMatch[1]}")`;
      }
    }
    // MySQL AUTO_INCREMENT transpilation:
    // 1. Integer types with AUTO_INCREMENT and PRIMARY KEY in any order, with optional (size), UNSIGNED, and NOT NULL
    // -> INTEGER PRIMARY KEY AUTOINCREMENT
    transSql = transSql.replace(
      /\b(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT)(?:\s*\(\s*\d+\s*\))?(?:\s+UNSIGNED)?(?:\s+NOT\s+NULL)?\s+AUTO_INCREMENT(?:\s+NOT\s+NULL)?\s+PRIMARY\s+KEY(?:\s+NOT\s+NULL)?\b/gi,
      'INTEGER PRIMARY KEY AUTOINCREMENT'
    );
    transSql = transSql.replace(
      /\b(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT)(?:\s*\(\s*\d+\s*\))?(?:\s+UNSIGNED)?(?:\s+NOT\s+NULL)?\s+PRIMARY\s+KEY(?:\s+NOT\s+NULL)?\s+AUTO_INCREMENT(?:\s+NOT\s+NULL)?\b/gi,
      'INTEGER PRIMARY KEY AUTOINCREMENT'
    );
    // 2. AUTO_INCREMENT and PRIMARY KEY without explicit preceding type, with optional NOT NULL
    transSql = transSql.replace(/\bAUTO_INCREMENT(?:\s+NOT\s+NULL)?\s+PRIMARY\s+KEY\b/gi, 'PRIMARY KEY AUTOINCREMENT');
    transSql = transSql.replace(/\bPRIMARY\s+KEY(?:\s+NOT\s+NULL)?\s+AUTO_INCREMENT\b/gi, 'PRIMARY KEY AUTOINCREMENT');
    // 3. Any remaining AUTO_INCREMENT -> AUTOINCREMENT
    transSql = transSql.replace(/\bAUTO_INCREMENT\b/gi, 'AUTOINCREMENT');
    // Transpile NOW() -> CURRENT_TIMESTAMP
    transSql = transSql.replace(/\bNOW\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP');
    warning = 'MySQL dialect emulation active: standard ANSI SQL executed on isolated practice DB.';
  } else if (dialect === 'postgresql') {
    // Map BIGSERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT
    transSql = transSql.replace(/\bBIGSERIAL(?:\s+NOT\s+NULL)?\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    transSql = transSql.replace(/\bBIGSERIAL\b/gi, 'INTEGER');
    // Map SERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT
    transSql = transSql.replace(/\bSERIAL(?:\s+NOT\s+NULL)?\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    transSql = transSql.replace(/\bSERIAL\b/gi, 'INTEGER');
    // Transpile ILIKE -> LIKE
    transSql = transSql.replace(/\bILIKE\b/gi, 'LIKE');
    // Transpile NOW() -> CURRENT_TIMESTAMP
    transSql = transSql.replace(/\bNOW\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP');
    warning = 'PostgreSQL dialect emulation active: standard ANSI SQL executed on isolated practice DB.';
  } else if (dialect === 'mssql') {
    if (/\b(SET\s+NOCOUNT|@@IDENTITY|CROSS\s+APPLY)\b/i.test(cleanWithoutStrings)) {
      throw new Error('T-SQL specific batch directive detected. Practice standard ANSI DDL/DML statements.');
    }
    // Transpile ISNULL(a, b) -> IFNULL(a, b)
    transSql = transSql.replace(/\bISNULL\s*\(/gi, 'IFNULL(');
    // Transpile GETDATE() -> CURRENT_TIMESTAMP
    transSql = transSql.replace(/\bGETDATE\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP');
    // Transpile SELECT TOP (n) ... -> SELECT ... LIMIT n (handling subqueries & string literals)
    transSql = transpileMssqlTop(transSql);
    warning = 'SQL Server (T-SQL) dialect emulation active: standard ANSI SQL executed on isolated practice DB.';
  }

  // 4. Prohibit unconstrained recursive CTE queries to prevent synchronous main-thread starvation
  validateRecursiveCteSafety(transSql);

  return { transSql, warning };
}

function terminateSqlChildProcess(proc: any): void {
  if (!proc || !proc.pid) return;
  try {
    proc.kill('SIGKILL');
  } catch {}
  if (process.platform === 'win32') {
    if (proc.exitCode === null && !proc.killed) {
      try {
        const tk = spawn('taskkill.exe', ['/pid', String(proc.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        tk.on('error', () => {});
        tk.unref();
      } catch {}
    }
  } else {
    try {
      process.kill(-proc.pid, 'SIGKILL');
    } catch {
      try {
        process.kill(proc.pid, 'SIGKILL');
      } catch {}
    }
  }
}

function runSqlEngineInChildProcess(
  payload: {
    dbPath: string;
    trimmed: string;
    statements: string[];
    lastStmt: string;
    isLastDataQuery: boolean;
  },
  timeoutMs: number
): Promise<{
  ok: boolean;
  columns?: string[];
  rows?: any[][];
  rowCount?: number;
  error?: string;
  timedOut?: boolean;
}> {
  return new Promise((resolve) => {
    const inlineRunner = [
      "const { DatabaseSync } = require('node:sqlite');",
      "let raw = '';",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (c) => { raw += c; });",
      "process.stdin.on('end', () => {",
      '  let db = null;',
      '  try {',
      '    const input = JSON.parse(raw);',
      '    db = new DatabaseSync(input.dbPath);',
      "    db.exec('PRAGMA foreign_keys = ON;');",
      "    db.exec('PRAGMA busy_timeout = 1000;');",
      '    if (input.isLastDataQuery) {',
      '      if (input.statements.length > 1) {',
      "        const setupSql = input.statements.slice(0, -1).join('\\n;\\n') + '\\n;';",
      '        db.exec(setupSql);',
      '      }',
      '      const targetQuery = input.statements.length > 1 ? input.lastStmt : input.trimmed;',
      '      const stmt = db.prepare(targetQuery);',
      '      const rows = stmt.all();',
      '      let columns = [];',
      '      let rowData = [];',
      '      if (rows && rows.length > 0) {',
      '        columns = Object.keys(rows[0]);',
      '        rowData = rows.map((r) => columns.map((c) => r[c]));',
      '      } else {',
      '        try {',
      "          if (typeof stmt.columns === 'function') {",
      '            const colDefs = stmt.columns();',
      '            if (Array.isArray(colDefs)) columns = colDefs.map((c) => c.name || c);',
      '          }',
      '        } catch {}',
      '      }',
      "      process.stdout.write(JSON.stringify({ ok: true, columns, rows: rowData, rowCount: rowData.length }, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));",
      '    } else {',
      '      db.exec(input.trimmed);',
      '      let changes = 0;',
      '      try {',
      "        const changesStmt = db.prepare('SELECT changes() as c');",
      '        changes = changesStmt.get()?.c || 0;',
      '      } catch {}',
      "      process.stdout.write(JSON.stringify({ ok: true, columns: ['status', 'affected_rows'], rows: [['Query executed successfully', changes]], rowCount: changes }));",
      '    }',
      '  } catch (err) {',
      "    process.stdout.write(JSON.stringify({ ok: false, error: (err && err.message) || 'SQL execution failed' }));",
      '  } finally {',
      '    if (db) { try { db.close(); } catch {} }',
      '  }',
      '});',
    ].join('\n');

    const childEnv = { ...process.env };
    delete childEnv.NODE_OPTIONS;

    const proc = spawn(process.execPath, ['--no-warnings', '-e', inlineRunner], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
      env: childEnv,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let killFallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (res: {
      ok: boolean;
      columns?: string[];
      rows?: any[][];
      rowCount?: number;
      error?: string;
      timedOut?: boolean;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killFallbackTimer) clearTimeout(killFallbackTimer);
      resolve(res);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      terminateSqlChildProcess(proc);
      killFallbackTimer = setTimeout(() => {
        proc.stdin?.destroy();
        proc.stdout?.destroy();
        proc.stderr?.destroy();
        if (typeof proc.unref === 'function') proc.unref();
        finish({ ok: false, timedOut: true, error: 'SQL query execution exceeded 5-second timeout limit' });
      }, 300);
      if (typeof killFallbackTimer.unref === 'function') killFallbackTimer.unref();
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    proc.stdout?.setEncoding('utf8');
    proc.stderr?.setEncoding('utf8');
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });

    proc.on('error', (err) => {
      finish({ ok: false, error: err?.message || 'Failed to spawn SQL execution worker' });
    });

    proc.on('close', () => {
      if (timedOut) {
        finish({ ok: false, timedOut: true, error: 'SQL query execution exceeded 5-second timeout limit' });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        finish(parsed);
      } catch {
        finish({ ok: false, error: stderr.trim() || 'SQL execution failed' });
      }
    });

    if (proc.stdin) {
      proc.stdin.on('error', () => {});
      proc.stdin.end(JSON.stringify(payload));
    }
  });
}

/**
 * Execute SQL query inside the isolated project practice DB
 */
export async function executeSqlQuery(
  projectId: string,
  query: string,
  dialect: SqlDialect = 'sqlite'
): Promise<SqlQueryResult> {
  const startTime = Date.now();
  if (!query || !query.trim()) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      dialect,
      error: 'Empty query submitted',
    };
  }

  const db = await getProjectPracticeDb(projectId);
  if (!db) {
    try {
      const { executeInCloudRunner } = await import('@/lib/execution/cloud-runner');
      const { transSql, warning } = validateAndTranspileDialect(query, dialect);
      const cloudRes = await executeInCloudRunner({
        language: 'sql',
        files: [{ id: 'sql_main', name: 'main.sql', path: '/main.sql', content: transSql }],
        entrypoint: 'main.sql',
        runTimeoutMs: 5000,
        memoryLimitMb: 128,
      });

      const executionTimeMs = Date.now() - startTime;
      if (cloudRes.status === 'runtime_error' || cloudRes.status === 'compilation_error' || cloudRes.status === 'system_error') {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs,
          dialect,
          error: cloudRes.stderr || cloudRes.stdout || 'SQL execution failed',
          warning,
        };
      }

      const stdout = (cloudRes.stdout || '').trim();
      if (!stdout) {
        return {
          columns: ['status', 'affected_rows'],
          rows: [['Query executed successfully', 0]],
          rowCount: 0,
          executionTimeMs,
          dialect,
          warning,
        };
      }

      const lines = stdout.split('\n').filter(Boolean);
      const rows = lines.map((line) => line.split('|'));
      const colCount = rows[0]?.length || 1;
      const columns = Array.from({ length: colCount }, (_, i) => `col_${i + 1}`);

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs,
        dialect,
        warning,
      };
    } catch {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        dialect,
        error: 'SQLite execution engine is not available in the current runtime environment.',
      };
    }
  }

  const TIMEOUT_MS = 5000;
  let transSql: string;
  let warning: string | undefined;
  try {
    const validated = validateAndTranspileDialect(query, dialect);
    transSql = validated.transSql;
    warning = validated.warning;
  } catch (err: any) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: Date.now() - startTime,
      dialect,
      error: err?.message || 'SQL execution failed',
    };
  }

  const trimmed = transSql.trim();
  const statements = splitSqlStatements(trimmed);
  const lastStmt = statements.length > 0 ? statements[statements.length - 1] : trimmed;
  const isLastDataQuery = isSqlDataQuery(lastStmt);
  const dbPath: string | null = typeof db.location === 'function' ? db.location() : null;

  if (dbPath !== null) {
    const childResult = await runSqlEngineInChildProcess(
      {
        dbPath,
        trimmed,
        statements,
        lastStmt,
        isLastDataQuery,
      },
      TIMEOUT_MS
    );
    const executionTimeMs = Date.now() - startTime;
    if (childResult.timedOut || executionTimeMs > TIMEOUT_MS) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs,
        dialect,
        error: 'SQL query execution exceeded 5-second timeout limit',
      };
    }
    if (!childResult.ok) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs,
        dialect,
        error: childResult.error || 'SQL execution failed',
      };
    }
    return {
      columns: childResult.columns || [],
      rows: childResult.rows || [],
      rowCount: childResult.rowCount ?? 0,
      executionTimeMs,
      dialect,
      warning,
    };
  }

  // Fallback for persistent :memory: DB when disk paths are unavailable
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('SQL query execution exceeded 5-second timeout limit'));
    }, TIMEOUT_MS);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });

  const queryExecutionPromise = (async (): Promise<SqlQueryResult> => {
    if (isLastDataQuery) {
      if (statements.length > 1) {
        const setupSql = statements.slice(0, -1).join('\n;\n') + '\n;';
        db.exec(setupSql);
      }
      const targetQuery = statements.length > 1 ? lastStmt : trimmed;
      const stmt = db.prepare(targetQuery);
      const rows = stmt.all() as any[];
      const executionTimeMs = Date.now() - startTime;

      let columns: string[] = [];
      let rowData: any[][] = [];

      if (rows && rows.length > 0) {
        columns = Object.keys(rows[0]);
        rowData = rows.map(r => columns.map(c => r[c]));
      } else {
        try {
          if (typeof (stmt as any).columns === 'function') {
            const colDefs = (stmt as any).columns();
            if (Array.isArray(colDefs)) {
              columns = colDefs.map((c: any) => c.name || c);
            }
          }
        } catch {}
      }

      return {
        columns,
        rows: rowData,
        rowCount: rowData.length,
        executionTimeMs,
        dialect,
        warning,
      };
    } else {
      // DDL or DML statement (CREATE, INSERT, UPDATE, DELETE, DROP, ALTER)
      db.exec(trimmed);
      const executionTimeMs = Date.now() - startTime;

      // Check changes if applicable
      let changes = 0;
      try {
        const changesStmt = db.prepare('SELECT changes() as c');
        changes = (changesStmt.get() as any)?.c || 0;
      } catch {}

      return {
        columns: ['status', 'affected_rows'],
        rows: [['Query executed successfully', changes]],
        rowCount: changes,
        executionTimeMs,
        dialect,
        warning,
      };
    }
  })();

  try {
    const result = await Promise.race([queryExecutionPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    if (result.executionTimeMs > TIMEOUT_MS) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: result.executionTimeMs,
        dialect,
        error: 'SQL query execution exceeded 5-second timeout limit',
      };
    }
    return result;
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    const executionTimeMs = Date.now() - startTime;
    const isTimeout = err.message?.includes('timeout') || executionTimeMs >= TIMEOUT_MS;
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs,
      dialect,
      error: isTimeout
        ? 'SQL query execution exceeded 5-second timeout limit'
        : (err.message || 'SQL execution failed'),
    };
  }
}
