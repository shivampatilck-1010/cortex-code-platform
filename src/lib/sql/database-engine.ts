import path from 'path';
import fs from 'fs';
import os from 'os';
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
        if (next === ']') {
          result += next;
          i++;
        } else {
          inBracket = false;
        }
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
 * Check query for dangerous operations or unsupported dialect keywords
 */
function validateAndTranspileDialect(sql: string, dialect: SqlDialect): { transSql: string; warning?: string } {
  const trimmed = sql.trim();
  const cleanForCheck = stripSqlComments(trimmed);
  // Strip single-quoted string literals and quoted/bracketed identifiers when checking for prohibited commands to prevent false positives in strings and column aliases
  const cleanWithoutStrings = cleanForCheck
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, '""')
    .replace(/`[^`]*`/g, '``')
    .replace(/\[(?:\]\]|[^\]])*\]/g, '[]');

  // Prohibit dangerous SQLite meta-operations:
  // 1. Prohibit ATTACH or DETACH (with or without optional DATABASE keyword)
  if (/\b(?:ATTACH(?:\s+DATABASE)?|DETACH(?:\s+DATABASE)?)\b/i.test(cleanWithoutStrings)) {
    throw new Error('Access denied: ATTACH and DETACH commands are prohibited in sandboxed practice mode.');
  }

  // 2. Prohibit modifying or administrative PRAGMA commands; allow only read-only schema introspection
  if (/\bPRAGMA\b/i.test(cleanWithoutStrings)) {
    const isAdminPragma = /\bPRAGMA\s+(?:[a-zA-Z0-9_]+\.)?(?:writable_schema|default_cache_size|foreign_keys|journal_mode|synchronous|locking_mode|auto_vacuum|temp_store|wal_checkpoint|compile_options|database_list|hard_heap_limit|soft_heap_limit|max_page_count|page_size|secure_delete)\b/i.test(cleanWithoutStrings);
    const isAllowedPragma = /^\s*PRAGMA\s+(?:[a-zA-Z0-9_]+\.)?(?:table_info|index_list|index_info|foreign_key_list)\s*\(/i.test(cleanWithoutStrings);
    if (isAdminPragma || !isAllowedPragma) {
      throw new Error('Access denied: administrative or file-level PRAGMA commands are prohibited in sandboxed practice mode.');
    }
  }

  // 3. Prohibit load_extension
  if (/\bload_extension\b/i.test(cleanWithoutStrings)) {
    throw new Error('Access denied: loading external extensions is prohibited in sandboxed practice mode.');
  }

  let warning: string | undefined;
  let transSql = sql;

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
  const isRecursiveCte =
    /\bWITH\s+RECURSIVE\b/i.test(cleanWithoutStrings) ||
    /\bWITH\s+[\s\S]*?\bRECURSIVE\b/i.test(cleanWithoutStrings);
  if (isRecursiveCte) {
    const cleanTrans = stripSqlComments(transSql)
      .replace(/'(?:''|[^'])*'/g, "''")
      .replace(/"(?:""|[^"])*"/g, '""')
      .replace(/`[^`]*`/g, '``')
      .replace(/\[(?:\]\]|[^\]])*\]/g, '[]');
    if (!/\bLIMIT\s+\d+/i.test(cleanTrans)) {
      throw new Error('Recursive CTE queries must include an explicit LIMIT clause to prevent server process resource starvation.');
    }
  }

  return { transSql, warning };
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
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      dialect,
      error: 'SQLite execution engine is not available in the current runtime environment.',
    };
  }

  const TIMEOUT_MS = 5000;
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('SQL query execution exceeded 5-second timeout limit'));
    }, TIMEOUT_MS);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });

  const queryExecutionPromise = (async (): Promise<SqlQueryResult> => {
    const { transSql, warning } = validateAndTranspileDialect(query, dialect);
    const trimmed = transSql.trim();

    // Check if query is a data-returning query (SELECT, CTE WITH ... SELECT, EXPLAIN, VALUES, or PRAGMA schema introspection)
    // Strip comments and leading whitespace first so comments/newlines don't break classification
    const cleanForDetection = stripSqlComments(trimmed);
    const isDataQuery = /^(?:\(|\s)*(?:SELECT\b|EXPLAIN\b|VALUES\b|WITH\s+[\s\S]*?\bSELECT\b|PRAGMA\s+(?:[a-zA-Z0-9_]+\.)?(?:table_info|index_list|index_info|foreign_key_list)\b)/i.test(cleanForDetection);

    if (isDataQuery) {
      const stmt = db.prepare(trimmed);
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
