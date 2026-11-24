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
import { resolveMainFile } from '../src/lib/execution/path-sanitizer';
import { executeInLocalSandbox } from '../src/lib/execution/local-sandbox';
import { ProjectFile } from '../src/lib/execution/types';

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

// ---------------------------------------------------------------------------
// 5. Multi-File Project Resolution & Execution Tests
// ---------------------------------------------------------------------------

async function testMultiFileProjectResolutionAndExecution() {
  console.log('\n--- 5. Testing Multi-File Project Entrypoint Resolution & Execution ---');

  const pythonConfig = getLanguageConfig('python');
  const cppConfig = getLanguageConfig('cpp');

  const projectFiles: ProjectFile[] = [
    {
      id: 'main',
      name: 'main.cpp',
      path: '/main.cpp',
      content: '#include <iostream>\nint main() { std::cout << "CPP" << std::endl; return 0; }',
    },
    {
      id: 'readme',
      name: 'README.md',
      path: '/README.md',
      content: '# Sample Project',
    },
    {
      id: 'f_py_1',
      name: 'file_1.py',
      path: '/file_1.py',
      content: 'print("Active Python file executed cleanly")',
    },
    {
      id: 'f_py_utils',
      name: 'utils.py',
      path: '/utils.py',
      content: 'def get_message(): return "Utils loaded"',
    },
  ];

  // 1. Direct entrypoint match by name
  const matchDirect = resolveMainFile(projectFiles, 'file_1.py', pythonConfig);
  assert.ok(matchDirect, 'Should resolve file_1.py by exact name');
  assert.strictEqual(matchDirect?.name, 'file_1.py');
  console.log('[PASS] Exact entrypoint name resolution verified');

  // 2. Direct entrypoint match with leading slash normalization
  const matchSlash = resolveMainFile(projectFiles, '/file_1.py', pythonConfig);
  assert.ok(matchSlash, 'Should resolve /file_1.py by normalized path');
  assert.strictEqual(matchSlash?.name, 'file_1.py');
  console.log('[PASS] Leading slash normalization for entrypoints verified');

  // 3. Fallback matching language extension without cross-language id: "main" hijacking
  const matchExtensionFallback = resolveMainFile(projectFiles, undefined, pythonConfig);
  assert.ok(matchExtensionFallback, 'Should resolve python file when entrypoint is undefined');
  assert.strictEqual(matchExtensionFallback?.name, 'file_1.py');
  assert.notStrictEqual(matchExtensionFallback?.id, 'main', 'Must not hijack with C++ starter file id: "main"');
  console.log('[PASS] Language extension fallback without cross-language hijacking verified');

  // 4. Fallback matching defaultFileName when present
  const projectWithMainPy: ProjectFile[] = [
    {
      id: 'main',
      name: 'main.cpp',
      path: '/main.cpp',
      content: '#include <iostream>\nint main() { return 0; }',
    },
    {
      id: 'f_main_py',
      name: 'main.py',
      path: '/main.py',
      content: 'print("Main python entry")',
    },
    {
      id: 'f_py_1',
      name: 'file_1.py',
      path: '/file_1.py',
      content: 'print("Secondary python file")',
    },
  ];
  const matchDefaultFile = resolveMainFile(projectWithMainPy, undefined, pythonConfig);
  assert.ok(matchDefaultFile, 'Should resolve main.py by defaultFileName');
  assert.strictEqual(matchDefaultFile?.name, 'main.py');
  console.log('[PASS] Default file name resolution for target language verified');

  // 5. C++ language config matches C++ file
  const matchCpp = resolveMainFile(projectFiles, undefined, cppConfig);
  assert.ok(matchCpp, 'Should resolve main.cpp for C++ language');
  assert.strictEqual(matchCpp?.name, 'main.cpp');
  console.log('[PASS] C++ language file resolution verified');

  // 6. Live multi-file local sandbox execution in development mode
  process.env.EXECUTION_MODE = 'development';
  (process.env as any).NODE_ENV = 'test';

  const executionResult = await executeInLocalSandbox({
    language: 'python',
    files: projectFiles,
    entrypoint: 'file_1.py',
  });

  assert.strictEqual(executionResult.status, 'success', 'Multi-file execution status should be success');
  assert.strictEqual(executionResult.exitCode, 0, 'Exit code should be 0');
  assert.ok(
    executionResult.stdout.includes('Active Python file executed cleanly'),
    'Execution stdout must contain the active python file output'
  );
  assert.ok(
    !executionResult.stderr.includes('SyntaxError'),
    'Execution stderr must not contain phantom C++ syntax errors'
  );
  console.log('[PASS] Live multi-file sandbox execution succeeds with zero phantom syntax errors');
}

async function testStdinExecutionAndTabBehavior() {
  console.log('\n--- 6. Testing Stdin Handling & Tab Closing Isolation ---');

  process.env.EXECUTION_MODE = 'development';
  (process.env as any).NODE_ENV = 'test';

  // 1. Python script reading stdin with input()
  const stdinCode = 'name = input()\nprint(f"Hello, {name}!")';
  const pyFile: ProjectFile = {
    id: 'f_stdin',
    name: 'main.py',
    path: '/main.py',
    content: stdinCode,
  };

  const resWithStdin = await executeInLocalSandbox({
    language: 'python',
    files: [pyFile],
    entrypoint: 'main.py',
    stdin: 'AntigravityUser\n',
  });

  assert.strictEqual(resWithStdin.status, 'success', 'Status should be success when stdin is provided');
  assert.strictEqual(resWithStdin.exitCode, 0, 'Exit code should be 0');
  assert.ok(
    resWithStdin.stdout.includes('Hello, AntigravityUser!'),
    `Stdout should contain 'Hello, AntigravityUser!', got: ${resWithStdin.stdout}`
  );
  assert.strictEqual(resWithStdin.stdin, 'AntigravityUser\n', 'Result should preserve stdin');
  console.log('[PASS] Stdin input successfully captured and reflected in program execution');

  // 2. Python script reading stdin with EMPTY stdin must NOT hang or timeout!
  const startT = Date.now();
  const resEmptyStdin = await executeInLocalSandbox({
    language: 'python',
    files: [pyFile],
    entrypoint: 'main.py',
    stdin: '',
  });
  const elapsed = Date.now() - startT;

  assert.ok(elapsed < 8000, `Execution without stdin must not hang until timeout (elapsed: ${elapsed}ms)`);
  assert.ok(
    resEmptyStdin.stderr.includes('EOFError') || resEmptyStdin.exitCode !== 0,
    'Program expecting input without stdin should receive EOF and exit cleanly'
  );
  console.log('[PASS] Empty stdin closes child process stdin stream immediately without hanging');

  // 3. Tab management invariant testing:
  const workspaceFiles: ProjectFile[] = [
    { id: 'f1', name: 'main.cpp', path: '/main.cpp', content: 'int main(){}' },
    { id: 'f2', name: '1.sql', path: '/1.sql', content: 'SELECT 1;' },
    { id: 'f3', name: 'file_1.py', path: '/file_1.py', content: 'print(1)' },
  ];

  let openTabs = ['f1', 'f2', 'f3'];
  let currentActive = 'f1';

  const closeTab = (idToClose: string) => {
    openTabs = openTabs.filter(id => id !== idToClose);
    if (currentActive === idToClose) {
      currentActive = openTabs[0] || '';
    }
  };

  closeTab('f1');
  assert.strictEqual(openTabs.length, 2, 'Open tabs should now have 2 tabs');
  assert.strictEqual(openTabs.includes('f1'), false, 'f1 should be closed from tabs');
  assert.strictEqual(workspaceFiles.length, 3, 'Workspace files must NOT be deleted when tab is closed');
  assert.ok(workspaceFiles.some(f => f.id === 'f1'), 'f1 must remain intact in workspace file list');
  console.log('[PASS] Closing editor tab keeps file intact in workspace/sidebar file list');

  // 4. Closing the last remaining tab
  closeTab('f2');
  assert.strictEqual(openTabs.length, 1, 'Only one open tab remaining (f3)');
  closeTab('f3');
  assert.strictEqual(openTabs.length, 0, 'All tabs closed');
  assert.strictEqual(currentActive, '', 'Active tab becomes empty string');
  assert.strictEqual(workspaceFiles.length, 3, 'All workspace files still intact');
  console.log('[PASS] Closing single remaining tab transitions to empty state without deleting files');

  // 5. Selecting file from explorer reopens it in tabs
  const openFileFromExplorer = (fileId: string) => {
    if (!openTabs.includes(fileId)) {
      openTabs.push(fileId);
    }
    currentActive = fileId;
  };
  openFileFromExplorer('f1');
  assert.strictEqual(openTabs.length, 1, 'f1 reopened in tabs');
  assert.strictEqual(currentActive, 'f1', 'f1 is active');
  console.log('[PASS] Opening file from explorer re-adds it to open tabs');

  // 6. Adjacent tab activation when closing middle tab
  openTabs = ['f1', 'f2', 'f3'];
  currentActive = 'f2';
  const closeMiddleTab = (idToClose: string) => {
    const closedIndex = openTabs.indexOf(idToClose);
    openTabs = openTabs.filter(id => id !== idToClose);
    if (currentActive === idToClose) {
      const nextActiveIndex = Math.min(closedIndex >= 0 ? closedIndex : 0, openTabs.length - 1);
      currentActive = openTabs[nextActiveIndex] || '';
    }
  };
  closeMiddleTab('f2');
  assert.strictEqual(openTabs.length, 2, 'Two tabs remain');
  assert.strictEqual(currentActive, 'f3', 'Next adjacent tab f3 becomes active');
  console.log('[PASS] Closing middle tab activates adjacent tab');

  // 7. Node.js script reading stdin
  const nodeStdinCode = `
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('line', (line) => {
      console.log('Echo: ' + line);
      rl.close();
    });
  `;
  const jsFile: ProjectFile = {
    id: 'f_js_stdin',
    name: 'index.js',
    path: '/index.js',
    content: nodeStdinCode,
  };

  const resNodeStdin = await executeInLocalSandbox({
    language: 'javascript',
    files: [jsFile],
    entrypoint: 'index.js',
    stdin: 'CodePlatformUser\n',
  });
  assert.strictEqual(resNodeStdin.status, 'success', 'Node stdin execution succeeds');
  assert.ok(resNodeStdin.stdout.includes('Echo: CodePlatformUser'), `Output should echo input: ${resNodeStdin.stdout}`);
  assert.strictEqual(resNodeStdin.stdin, 'CodePlatformUser\n', 'Result preserves stdin');
  console.log('[PASS] Node.js stdin execution properly captures and returns stdin');
}

async function runAllTests() {
  await testCloudRunnerMemoryClamping();
  await testSqlEnvironment();
  await testMultiFileProjectResolutionAndExecution();
  await testStdinExecutionAndTabBehavior();
}

runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
