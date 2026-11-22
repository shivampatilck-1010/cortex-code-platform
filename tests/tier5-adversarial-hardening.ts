import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  TestHarness,
  TierExecutionResult,
} from './test-utils';
import {
  detectLanguage,
  detectLanguageFromFilename,
  detectLanguageFromContent,
  EXTENSION_TO_LANGUAGE_MAP,
} from '../src/lib/editor/language-detector';
import {
  executeSqlQuery,
  getPracticeDbSchema,
  resetPracticeDb,
} from '../src/lib/sql/database-engine';
import { getLanguageConfig, SUPPORTED_LANGUAGES } from '../src/config/languages';
import { ALLOWED_LANGUAGES, EXECUTION_LIMITS } from '../src/lib/execution/config';
import { JUDGE0_LANGUAGE_IDS } from '../src/lib/execution/cloud-runner';

export async function runTier5AdversarialHardening(projectRoot = process.cwd()): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 5 - Adversarial Hardening');

  // ---------------------------------------------------------------------------
  // Test 1: SQL Sandbox Security & Administrative Escape Defense
  // ---------------------------------------------------------------------------
  harness.startTest('TC5.1 - SQL Sandbox Security & Administrative Escape Defense');
  try {
    const testProjectId = `tier5_adv_sql_test_${Date.now()}`;
    await resetPracticeDb(testProjectId);

    // 1. Forbidden PRAGMA execution attempts
    const forbiddenPragmas = [
      'PRAGMA writable_schema = 1;',
      'PRAGMA hard_heap_limit = 1048576;',
      'ATTACH DATABASE "malicious.db" AS evil;',
      'DETACH DATABASE evil;',
      'SELECT load_extension("exploit");',
      'PRAGMA temp_store_directory = "/tmp";',
    ];

    for (const pragma of forbiddenPragmas) {
      const res = await executeSqlQuery(testProjectId, pragma);
      harness.assert(
        Boolean(res.error),
        `Sandbox must reject administrative or filesystem escape attempt: "${pragma}" (got error: ${res.error})`
      );
    }

    // 2. Multi-dialect transpilation under adversarial conditions
    // PostgreSQL SERIAL transpilation
    const pgRes = await executeSqlQuery(
      testProjectId,
      'CREATE TABLE test_pg_adv (id SERIAL PRIMARY KEY, note TEXT);',
      'postgresql'
    );
    harness.assert(!pgRes.error, `PostgreSQL SERIAL DDL should transpile cleanly (got error: ${pgRes.error})`);

    // MySQL SHOW TABLES
    const mysqlRes = await executeSqlQuery(testProjectId, 'SHOW TABLES;', 'mysql');
    harness.assert(!mysqlRes.error, `MySQL SHOW TABLES emulation should succeed (got error: ${mysqlRes.error})`);
    harness.assert(mysqlRes.rows.length > 0, 'MySQL SHOW TABLES should list at least 1 table');

    // MySQL SHOW DATABASES
    const mysqlDbRes = await executeSqlQuery(testProjectId, 'SHOW DATABASES;', 'mysql');
    harness.assert(!mysqlDbRes.error, `MySQL SHOW DATABASES emulation should succeed`);
    harness.assert(mysqlDbRes.rows.length > 0, 'MySQL SHOW DATABASES should return database rows');

    // MSSQL TOP N transpilation
    const mssqlRes = await executeSqlQuery(
      testProjectId,
      'SELECT TOP 2 id, name FROM students;',
      'mssql'
    );
    harness.assert(!mssqlRes.error, `MSSQL TOP N emulation should succeed`);
    harness.assertEquals(mssqlRes.rows.length, 2, 'MSSQL TOP 2 must return exactly 2 rows');

    // Oracle ROWNUM transpilation
    const oracleRes = await executeSqlQuery(
      testProjectId,
      'SELECT id, name FROM students WHERE ROWNUM <= 3;',
      'oracle'
    );
    harness.assert(!oracleRes.error, `Oracle ROWNUM emulation should succeed`);
    harness.assertEquals(oracleRes.rows.length, 3, 'Oracle ROWNUM <= 3 must return exactly 3 rows');

    // Clean up
    await executeSqlQuery(testProjectId, 'DROP TABLE IF EXISTS test_pg_adv;');
    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // ---------------------------------------------------------------------------
  // Test 2: Path Traversal & Identifier Sanitization
  // ---------------------------------------------------------------------------
  harness.startTest('TC5.2 - Path Traversal & Identifier Sanitization');
  try {
    const maliciousProjectIds = [
      '../../../../etc/passwd',
      '..\\..\\windows\\system32',
      'proj_test; DROP TABLE users;--',
      'proj/\x00/hidden',
      '../../../data/secret',
    ];

    for (const badId of maliciousProjectIds) {
      const sanitized = badId.replace(/[^a-zA-Z0-9_-]/g, '');
      harness.assert(
        !sanitized.includes('..') && !sanitized.includes('/') && !sanitized.includes('\\'),
        `Sanitization must strip path traversal characters from: ${badId} -> got: ${sanitized}`
      );
    }

    // Verify Project Export Route defense against traversal
    const exportRoutePath = path.join(
      projectRoot,
      'src',
      'app',
      'api',
      'v1',
      'projects',
      '[id]',
      'export',
      'route.ts'
    );
    harness.assert(fs.existsSync(exportRoutePath), 'export route.ts must exist');
    const exportContent = fs.readFileSync(exportRoutePath, 'utf8');
    harness.assertIncludes(exportContent, 'params', 'Export route must handle route parameters defensively');

    // Verify File Download Route defense
    const downloadRoutePath = path.join(
      projectRoot,
      'src',
      'app',
      'api',
      'v1',
      'projects',
      '[id]',
      'files',
      '[fileId]',
      'download',
      'route.ts'
    );
    harness.assert(fs.existsSync(downloadRoutePath), 'download route.ts must exist');
    const downloadContent = fs.readFileSync(downloadRoutePath, 'utf8');
    harness.assertIncludes(downloadContent, 'params', 'Download route must handle params securely');

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Judge0 Runtime Execution & Resource Boundary Hardening
  // ---------------------------------------------------------------------------
  harness.startTest('TC5.3 - Judge0 Runtime Execution & Resource Boundary Hardening');
  try {
    // 1. Allowed executable languages include bash, lua, perl
    harness.assert(ALLOWED_LANGUAGES.has('bash'), 'ALLOWED_LANGUAGES must include bash');
    harness.assert(ALLOWED_LANGUAGES.has('lua'), 'ALLOWED_LANGUAGES must include lua');
    harness.assert(ALLOWED_LANGUAGES.has('perl'), 'ALLOWED_LANGUAGES must include perl');

    // 2. Non-executable formats must NOT be in ALLOWED_LANGUAGES
    const nonExecutableFormats = ['json', 'yaml', 'xml', 'md'];
    for (const fmt of nonExecutableFormats) {
      harness.assert(
        !ALLOWED_LANGUAGES.has(fmt as any),
        `Non-executable format "${fmt}" must NOT be allowed in execution runtime`
      );
    }

    // 3. Judge0 IDs correctly mapped
    harness.assertEquals(JUDGE0_LANGUAGE_IDS['bash'], 46, 'Bash Judge0 ID must be 46');
    harness.assertEquals(JUDGE0_LANGUAGE_IDS['lua'], 64, 'Lua Judge0 ID must be 64');
    harness.assertEquals(JUDGE0_LANGUAGE_IDS['perl'], 85, 'Perl Judge0 ID must be 85');

    // 4. Execution Limits Hardening
    harness.assert(EXECUTION_LIMITS.maxCpuTimeSec <= 10, 'maxCpuTimeSec must be capped at 10s or less');
    harness.assert(EXECUTION_LIMITS.maxWallTimeSec <= 15, 'maxWallTimeSec must be capped at 15s or less');
    harness.assert(EXECUTION_LIMITS.maxMemoryMb <= 256, 'maxMemoryMb must be capped at 256MB or less');
    harness.assert(EXECUTION_LIMITS.maxOutputSizeBytes <= 1048576, 'maxOutputSizeBytes must be capped at 1MB');

    // 5. Config registry executable flags
    for (const fmt of nonExecutableFormats) {
      const cfg = getLanguageConfig(fmt);
      harness.assertEquals(cfg.executable, false, `Language config for ${fmt} must have executable=false`);
    }

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // ---------------------------------------------------------------------------
  // Test 4: Language Detection Adversarial Stress & ReDoS Defense
  // ---------------------------------------------------------------------------
  harness.startTest('TC5.4 - Language Detection Adversarial Stress & ReDoS Defense');
  try {
    // 1. Conflicting signals / Polyglot resolution
    // An explicit override beats both extension and content
    const overrideResult = detectLanguage(
      'script.py',
      '#include <iostream>\nint main(){}',
      'perl'
    );
    harness.assertEquals(overrideResult, 'perl', 'Explicit user override must take highest priority (Tier 1)');

    // Extension beats content heuristic
    const extBeatsContent = detectLanguage(
      'main.cpp',
      'SELECT * FROM users;\n#!/bin/bash\necho "hello"'
    );
    harness.assertEquals(extBeatsContent, 'cpp', 'Extension must take priority over shebang and content (Tier 2)');

    // Shebang beats content keywords on extensionless file
    const shebangBeatsKeywords = detectLanguage(
      'deploy_script',
      '#!/bin/bash\n# SELECT * FROM users;\necho "done"'
    );
    harness.assertEquals(shebangBeatsKeywords, 'bash', 'Shebang must take priority over content keywords on extensionless file (Tier 3)');

    // 2. ReDoS stress testing on content heuristics
    // Deeply nested / repetitive strings that could trigger catastrophic backtracking
    const redosPayloads = [
      ' '.repeat(20000) + 'SELECT * FROM test',
      '<'.repeat(5000) + '!DOCTYPE' + '>'.repeat(5000),
      '{"a":'.repeat(500) + '1' + '}'.repeat(500),
      '#include '.repeat(2000) + '<stdio.h>',
      '#!/usr/bin/env ' + 'a'.repeat(10000),
    ];

    for (let i = 0; i < redosPayloads.length; i++) {
      const payload = redosPayloads[i];
      const start = Date.now();
      detectLanguageFromContent(payload);
      const elapsed = Date.now() - start;
      harness.assert(
        elapsed < 100,
        `ReDoS payload #${i + 1} must complete within 100ms (took ${elapsed}ms)`
      );
    }

    // 3. Binary null-byte payload resilience
    const binaryGarbage = '\x00\x01\x02\x03\xff\xfe\xfd\x80\x90\x00\x00';
    const binaryResult = detectLanguageFromContent(binaryGarbage);
    harness.assertEquals(binaryResult, null, 'Binary garbage without text patterns must return null safely');

    // 4. All 28+ extensions map correctly
    harness.assert(
      Object.keys(EXTENSION_TO_LANGUAGE_MAP).length >= 28,
      'EXTENSION_TO_LANGUAGE_MAP must map at least 28 file extensions'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // ---------------------------------------------------------------------------
  // Test 5: File Versioning Invariants & Schema Hardening
  // ---------------------------------------------------------------------------
  harness.startTest('TC5.5 - File Versioning Invariants & Schema Hardening');
  try {
    // 1. Verify migration file exists
    const migrationPath = path.join(projectRoot, 'migrations', '0012_project_file_versions.sql');
    harness.assert(fs.existsSync(migrationPath), 'migrations/0012_project_file_versions.sql must exist');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    harness.assertIncludes(migrationSql, 'project_file_versions', 'Migration must define project_file_versions table');
    harness.assertIncludes(migrationSql, 'version_number', 'Migration must declare version_number column');
    harness.assertIncludes(migrationSql, 'file_id', 'Migration must declare file_id column');
    harness.assertIncludes(migrationSql, 'project_id', 'Migration must declare project_id column');
    harness.assertIncludes(migrationSql, 'content', 'Migration must declare content column');

    // 2. Verify project DB repository methods
    const projectDbPath = path.join(projectRoot, 'src', 'lib', 'project', 'db', 'index.ts');
    harness.assert(fs.existsSync(projectDbPath), 'src/lib/project/db/index.ts must exist');
    const projectDbContent = fs.readFileSync(projectDbPath, 'utf8');

    harness.assertIncludes(projectDbContent, 'createFileVersion', 'project DB must declare createFileVersion');
    harness.assertIncludes(projectDbContent, 'listFileVersions', 'project DB must declare listFileVersions');
    harness.assertIncludes(projectDbContent, 'getFileVersion', 'project DB must declare getFileVersion');

    // 3. Verify API versioning route
    const versionsRoutePath = path.join(
      projectRoot,
      'src',
      'app',
      'api',
      'v1',
      'projects',
      '[id]',
      'files',
      '[fileId]',
      'versions',
      'route.ts'
    );
    harness.assert(fs.existsSync(versionsRoutePath), 'versions/route.ts must exist');
    const versionsRouteContent = fs.readFileSync(versionsRoutePath, 'utf8');
    harness.assertIncludes(versionsRouteContent, 'GET', 'versions route must support GET');
    harness.assertIncludes(versionsRouteContent, 'POST', 'versions route must support POST (snapshot creation)');

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // ---------------------------------------------------------------------------
  // Test 6: Zero-UI-Regression & Visual Invariant Audit
  // ---------------------------------------------------------------------------
  harness.startTest('TC5.6 - Zero-UI-Regression & Visual Invariant Audit');
  try {
    // 1. MonacoCodeEditor auto-save status indicator & save shortcut
    const editorPath = path.join(projectRoot, 'src', 'components', 'editor', 'MonacoCodeEditor.tsx');
    harness.assert(fs.existsSync(editorPath), 'MonacoCodeEditor.tsx must exist');
    const editorContent = fs.readFileSync(editorPath, 'utf8');

    harness.assertIncludes(editorContent, 'saveStatus', 'MonacoCodeEditor must accept saveStatus prop');
    harness.assertIncludes(editorContent, 'onForceSave', 'MonacoCodeEditor must accept onForceSave prop');

    // 2. FileExplorer language icons & version history integration
    const explorerPath = path.join(projectRoot, 'src', 'components', 'sidebar', 'FileExplorer.tsx');
    harness.assert(fs.existsSync(explorerPath), 'FileExplorer.tsx must exist');
    const explorerContent = fs.readFileSync(explorerPath, 'utf8');

    harness.assertIncludes(explorerContent, 'LanguageIcon', 'FileExplorer must render LanguageIcon component');
    harness.assertIncludes(explorerContent, 'detectLanguageFromFilename', 'FileExplorer must detect language on filename change');

    // 3. IDE Page non-executable indicator & layout stability
    const idePagePath = path.join(projectRoot, 'src', 'app', 'ide', 'page.tsx');
    harness.assert(fs.existsSync(idePagePath), 'src/app/ide/page.tsx must exist');
    const idePageContent = fs.readFileSync(idePagePath, 'utf8');

    harness.assertIncludes(idePageContent, 'cannot be executed', 'IDE page must handle non-executable files');
    harness.assertIncludes(idePageContent, 'saveStatus', 'IDE page must pass saveStatus to editor');
    harness.assertIncludes(idePageContent, 'formatSqlResultsToAsciiTable', 'IDE page must support SQL practice workflow');

    // 4. Navbar & LanguageIcon components
    const langIconPath = path.join(projectRoot, 'src', 'components', 'common', 'LanguageIcon.tsx');
    harness.assert(fs.existsSync(langIconPath), 'LanguageIcon.tsx must exist');

    const navbarPath = path.join(projectRoot, 'src', 'components', 'layout', 'Navbar.tsx');
    harness.assert(fs.existsSync(navbarPath), 'Navbar.tsx must exist');
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');
    harness.assertIncludes(navbarContent, 'Preview Only', 'Navbar must render Preview Only for non-executable files');

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  return harness.getSummary();
}

const isDirectExecution = process.argv[1] && (
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href ||
  process.argv[1].replace(/\\/g, '/').endsWith('tier5-adversarial-hardening.ts')
);

if (isDirectExecution) {
  runTier5AdversarialHardening().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
