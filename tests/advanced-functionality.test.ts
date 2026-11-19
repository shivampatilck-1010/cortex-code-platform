import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  detectLanguage,
  detectLanguageFromFilename,
  detectLanguageFromContent,
  getMonacoLanguage,
  EXTENSION_TO_LANGUAGE_MAP,
} from '../src/lib/editor/language-detector';
import {
  executeSqlQuery,
  getPracticeDbSchema,
  resetPracticeDb,
} from '../src/lib/sql/database-engine';
import { getLanguageConfig, SUPPORTED_LANGUAGES } from '../src/config/languages';
import { ALLOWED_LANGUAGES, EXECUTION_LIMITS } from '../src/lib/execution/config';
import { JUDGE0_LANGUAGE_IDS, executeInCloudRunner } from '../src/lib/execution/cloud-runner';

// ---------------------------------------------------------------------------
// 1. Language Detection & Catalog Tests
// ---------------------------------------------------------------------------

console.log('[Test Suite] Running Advanced Functionality Verification Tests...');

// Verify all 28+ extensions in EXTENSION_TO_LANGUAGE_MAP
const expectedExtensions = [
  '.py', '.c', '.cpp', '.cc', '.h', '.hpp', '.java', '.js', '.jsx',
  '.ts', '.tsx', '.html', '.css', '.php', '.go', '.rs', '.rb', '.kt',
  '.swift', '.cs', '.sql', '.r', '.dart', '.sh', '.bash', '.lua',
  '.pl', '.json', '.yaml', '.xml', '.md'
];

for (const ext of expectedExtensions) {
  const lang = EXTENSION_TO_LANGUAGE_MAP[ext];
  assert.ok(lang, `Extension ${ext} must be mapped in EXTENSION_TO_LANGUAGE_MAP`);
  const detected = detectLanguageFromFilename(`test${ext}`);
  assert.strictEqual(detected, lang, `detectLanguageFromFilename('test${ext}') should return ${lang}`);
}
console.log('[PASS] All 28+ file extensions correctly mapped and detected');

// Verify shebang detection
assert.strictEqual(detectLanguageFromContent('#!/usr/bin/env python3\nprint(1)'), 'python');
assert.strictEqual(detectLanguageFromContent('#!/bin/bash\necho 1'), 'bash');
assert.strictEqual(detectLanguageFromContent('#!/usr/bin/perl\nprint 1;'), 'perl');
assert.strictEqual(detectLanguageFromContent('#!/usr/bin/env lua\nprint(1)'), 'lua');
assert.strictEqual(detectLanguageFromContent('#!/usr/bin/env node\nconsole.log(1)'), 'javascript');
console.log('[PASS] Shebang detection passes for Python, Bash, Perl, Lua, Node');

// Verify content heuristics
assert.strictEqual(detectLanguageFromContent('<!DOCTYPE html><html></html>'), 'html');
assert.strictEqual(detectLanguageFromContent('<?xml version="1.0"?>'), 'xml');
assert.strictEqual(detectLanguageFromContent('<?php echo "hi";'), 'php');
assert.strictEqual(detectLanguageFromContent('{"key": "value"}'), 'json');
assert.strictEqual(detectLanguageFromContent('SELECT * FROM students;'), 'sql');
assert.strictEqual(detectLanguageFromContent('#include <iostream>\nint main(){}'), 'cpp');
console.log('[PASS] Content-based heuristics pass for HTML, XML, PHP, JSON, SQL, C++');

// Verify 5-tier detection priority
// Tier 1: Explicit override beats extension
assert.strictEqual(detectLanguage('script.py', 'print(1)', 'ruby'), 'ruby');
// Tier 2: Extension beats content
assert.strictEqual(detectLanguage('script.js', 'SELECT * FROM test;'), 'javascript');
// Tier 3 & 4: Extensionless file with shebang
assert.strictEqual(detectLanguage('run_job', '#!/bin/bash\necho "test"'), 'bash');
// Tier 5: Fallback to current language
assert.strictEqual(detectLanguage('unknown_file', 'just raw text', undefined, 'rust'), 'rust');
console.log('[PASS] 5-Tier language detection priority verified');

// Monaco language mappings & extension override priority verification
assert.strictEqual(getMonacoLanguage('.toml'), 'ini', "getMonacoLanguage('.toml') must return 'ini'");
assert.strictEqual(getMonacoLanguage('.ini'), 'ini', "getMonacoLanguage('.ini') must return 'ini'");
assert.strictEqual(getMonacoLanguage('.scss'), 'scss', "getMonacoLanguage('.scss') must return 'scss'");
assert.strictEqual(getMonacoLanguage('config.toml'), 'ini', "getMonacoLanguage('config.toml') must return 'ini'");
assert.strictEqual(getMonacoLanguage('setup.ini'), 'ini', "getMonacoLanguage('setup.ini') must return 'ini'");
assert.strictEqual(getMonacoLanguage('style.scss'), 'scss', "getMonacoLanguage('style.scss') must return 'scss'");
console.log('[PASS] Monaco language mappings for .toml, .ini, .scss verified across bare and filename inputs');

// ---------------------------------------------------------------------------
// 2. Expanded Programming Language & Judge0 Support
// ---------------------------------------------------------------------------

// Check Bash, Lua, Perl configs
const bashConfig = getLanguageConfig('bash');
assert.strictEqual(bashConfig.id, 'bash');
assert.strictEqual(bashConfig.fileExtension, '.sh');
assert.strictEqual(bashConfig.executable, true);

const luaConfig = getLanguageConfig('lua');
assert.strictEqual(luaConfig.id, 'lua');
assert.strictEqual(luaConfig.fileExtension, '.lua');
assert.strictEqual(luaConfig.executable, true);

const perlConfig = getLanguageConfig('perl');
assert.strictEqual(perlConfig.id, 'perl');
assert.strictEqual(perlConfig.fileExtension, '.pl');
assert.strictEqual(perlConfig.executable, true);

// Check non-executable formats
const jsonConfig = getLanguageConfig('json');
assert.strictEqual(jsonConfig.id, 'json');
assert.strictEqual(jsonConfig.executable, false);

const yamlConfig = getLanguageConfig('yaml');
assert.strictEqual(yamlConfig.id, 'yaml');
assert.strictEqual(yamlConfig.executable, false);

const xmlConfig = getLanguageConfig('xml');
assert.strictEqual(xmlConfig.id, 'xml');
assert.strictEqual(xmlConfig.executable, false);

const mdConfig = getLanguageConfig('markdown');
assert.strictEqual(mdConfig.id, 'markdown');
assert.strictEqual(mdConfig.executable, false);

// Check Judge0 language IDs
assert.strictEqual(JUDGE0_LANGUAGE_IDS['bash'], 46);
assert.strictEqual(JUDGE0_LANGUAGE_IDS['lua'], 64);
assert.strictEqual(JUDGE0_LANGUAGE_IDS['perl'], 85);

// Check ALLOWED_LANGUAGES set
assert.ok(ALLOWED_LANGUAGES.has('bash'));
assert.ok(ALLOWED_LANGUAGES.has('lua'));
assert.ok(ALLOWED_LANGUAGES.has('perl'));
console.log('[PASS] Bash, Lua, Perl, and Non-Executable configs verified in engine and Judge0 registry');

// Check Security Limits
assert.strictEqual(EXECUTION_LIMITS.maxCpuTimeSec, 10);
assert.strictEqual(EXECUTION_LIMITS.maxWallTimeSec, 15);
assert.strictEqual(EXECUTION_LIMITS.maxMemoryMb, 256);
assert.strictEqual(EXECUTION_LIMITS.maxOutputSizeBytes, 1024 * 1024);
console.log('[PASS] Execution security limits verified (10s CPU, 15s Wall, 256MB RAM, 1MB output cap)');

// Cloud runner memory limit clamping verification
async function testCloudRunnerMemoryClamping() {
  const originalFetch = globalThis.fetch;
  let capturedBody: any = null;
  globalThis.fetch = (async (url: any, init: any) => {
    if (init && init.body) {
      capturedBody = JSON.parse(init.body);
    }
    return {
      ok: true,
      json: async () => ({
        status: { id: 3 },
        stdout: 'ok',
        stderr: '',
        time: '0.01',
        memory: 1024,
      }),
    } as any;
  }) as any;

  try {
    // 1. Caller requesting 16384 MB (16GB) must be clamped to maxMemoryMb (256MB -> 262144 KB)
    await executeInCloudRunner({
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: 'main.py', content: 'print("test")', isFolder: false }],
      memoryLimitMb: 16384,
    });
    assert.strictEqual(
      capturedBody?.memory_limit,
      EXECUTION_LIMITS.maxMemoryMb * 1024,
      'Requested memory exceeding 256MB must be clamped to 256MB (262144 KB)'
    );

    // 2. Default memory limit when unspecified must also be maxMemoryMb (256MB)
    await executeInCloudRunner({
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: 'main.py', content: 'print("test")', isFolder: false }],
    });
    assert.strictEqual(
      capturedBody?.memory_limit,
      EXECUTION_LIMITS.maxMemoryMb * 1024,
      'Default memory limit should be 256MB (262144 KB)'
    );

    // 3. Caller requesting 128 MB (under limit) is allowed
    await executeInCloudRunner({
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: 'main.py', content: 'print("test")', isFolder: false }],
      memoryLimitMb: 128,
    });
    assert.strictEqual(
      capturedBody?.memory_limit,
      128 * 1024,
      'Memory limit below 256MB should be respected'
    );
    console.log('[PASS] Cloud runner memory limit clamping to 256MB verified');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ---------------------------------------------------------------------------
// 3. Isolated SQL Practice Database Environment
// ---------------------------------------------------------------------------

async function testSqlEnvironment() {
  const testProjectId = 'test_proj_' + Date.now();

  // Reset/seed sample database
  await resetPracticeDb(testProjectId);

  // Inspect schema
  const schema = await getPracticeDbSchema(testProjectId);
  assert.ok(schema.length >= 3, 'Sample schema should contain at least 3 tables (students, courses, enrollments)');
  const tableNames = schema.map(s => s.name);
  assert.ok(tableNames.includes('students'), 'students table should exist');
  assert.ok(tableNames.includes('courses'), 'courses table should exist');
  assert.ok(tableNames.includes('enrollments'), 'enrollments table should exist');
  console.log('[PASS] Isolated practice database initialized with starter sample schema');

  // SELECT query
  const queryRes = await executeSqlQuery(testProjectId, 'SELECT name, email, gpa FROM students ORDER BY gpa DESC LIMIT 3;', 'sqlite');
  assert.strictEqual(queryRes.error, undefined);
  assert.strictEqual(queryRes.columns.length, 3);
  assert.strictEqual(queryRes.rowCount, 3);
  assert.strictEqual(queryRes.rows.length, 3);
  console.log('[PASS] SQL SELECT execution returns structured columns and rows');

  // DDL & DML execution
  const insertRes = await executeSqlQuery(testProjectId, "INSERT INTO students (id, name, email, major, gpa) VALUES (99, 'Test Student', 'test@cortex.edu', 'AI', 4.0);", 'sqlite');
  assert.strictEqual(insertRes.error, undefined);
  assert.strictEqual(insertRes.rowCount, 1);

  // Dialect emulation: PostgreSQL SERIAL transpile
  const pgRes = await executeSqlQuery(testProjectId, 'CREATE TABLE pg_demo (id SERIAL PRIMARY KEY, note TEXT);', 'postgresql');
  assert.strictEqual(pgRes.error, undefined);
  assert.ok(pgRes.warning?.includes('PostgreSQL'));
  console.log('[PASS] PostgreSQL dialect emulation and DDL transpilation verified');

  // Dialect emulation: MySQL SHOW TABLES transpile
  const mysqlRes = await executeSqlQuery(testProjectId, 'SHOW TABLES;', 'mysql');
  assert.strictEqual(mysqlRes.error, undefined);
  assert.ok(mysqlRes.columns.length > 0);
  console.log('[PASS] MySQL dialect emulation (SHOW TABLES) verified');

  // Security: Prevent prohibited administrative PRAGMA commands
  const hackRes = await executeSqlQuery(testProjectId, 'ATTACH DATABASE "bad.db" AS bad;', 'sqlite');
  assert.ok(hackRes.error?.includes('prohibited'), 'ATTACH DATABASE should be rejected');
  console.log('[PASS] Sandboxed SQL environment rejects dangerous file-system operations');

  // Recursive CTE Queries Hardening
  // 1. Unconstrained recursive CTE query must be rejected with descriptive error without stalling
  const unconstrainedRecursiveRes = await executeSqlQuery(
    testProjectId,
    'WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT count(*) FROM cnt;',
    'sqlite'
  );
  assert.ok(unconstrainedRecursiveRes.error, 'Unconstrained recursive CTE must return error');
  assert.ok(
    unconstrainedRecursiveRes.error.includes(
      'Recursive CTE queries must include an explicit LIMIT clause to prevent server process resource starvation.'
    ),
    'Error message must state LIMIT requirement'
  );
  assert.strictEqual(unconstrainedRecursiveRes.rows.length, 0);
  console.log('[PASS] Unconstrained recursive CTE rejected with descriptive error and zero stall');

  // 2. Constrained recursive CTE with explicit LIMIT must succeed
  const constrainedRecursiveRes = await executeSqlQuery(
    testProjectId,
    'WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt LIMIT 5;',
    'sqlite'
  );
  assert.strictEqual(constrainedRecursiveRes.error, undefined, 'Constrained recursive CTE with LIMIT must execute cleanly');
  assert.strictEqual(constrainedRecursiveRes.rowCount, 5, 'Constrained recursive CTE must return exactly 5 rows');
  assert.strictEqual(constrainedRecursiveRes.rows.length, 5);
  console.log('[PASS] Constrained recursive CTE with explicit LIMIT executes successfully');

  console.log('\n======================================================');
  console.log('ALL ADVANCED FUNCTIONALITY TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

async function runAllTests() {
  await testCloudRunnerMemoryClamping();
  await testSqlEnvironment();
}

runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
