import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import {
  CHALLENGES,
  DSA_CHALLENGES,
  PROGRAMMING_CHALLENGES,
  SQL_CHALLENGES,
  difficultyToLevel,
} from '../src/lib/challenges/challenges-data';
import { executeInLocalSandbox } from '../src/lib/execution/local-sandbox';
import { runTestCases } from '../src/lib/execution/engine';
import { executeArenaTestCase } from '../src/lib/arena/execute-test';
import { executeSqlQuery } from '../src/lib/sql/database-engine';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { projectDb } from '../src/lib/project/db';
import { PATCH as patchProjectFile } from '../src/app/api/v1/projects/[id]/files/[fileId]/route';
import { detectEmojisInText } from './test-utils';

console.log('[Test Suite] Running Cortex Practice Hub & Catalog Verification Tests...');

async function runPracticeHubTests() {
  const projectRoot = process.cwd();

  // =========================================================================
  // 1. Multi-Track Catalog Integrity & Structure
  // =========================================================================
  console.log('\n--- 1. Verifying Expanded Multi-Track Problem Catalog ---');

  assert.ok(CHALLENGES.length >= 20, `Catalog should contain >= 20 problems, got ${CHALLENGES.length}`);
  assert.ok(DSA_CHALLENGES.length >= 10, `DSA track should have >= 10 problems, got ${DSA_CHALLENGES.length}`);
  assert.ok(PROGRAMMING_CHALLENGES.length >= 5, `Programming track should have >= 5 problems, got ${PROGRAMMING_CHALLENGES.length}`);
  assert.ok(SQL_CHALLENGES.length >= 5, `SQL track should have >= 5 problems, got ${SQL_CHALLENGES.length}`);
  assert.strictEqual(
    CHALLENGES.length,
    DSA_CHALLENGES.length + PROGRAMMING_CHALLENGES.length + SQL_CHALLENGES.length,
    'Combined CHALLENGES must equal sum of DSA, Programming, and SQL tracks'
  );

  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const allTopics = new Set<string>();
  const allCompanies = new Set<string>();

  for (const c of CHALLENGES) {
    assert.ok(!seenIds.has(c.id), `Duplicate challenge id: ${c.id}`);
    assert.ok(!seenSlugs.has(c.slug), `Duplicate challenge slug: ${c.slug}`);
    seenIds.add(c.id);
    seenSlugs.add(c.slug);

    assert.ok(['Easy', 'Medium', 'Hard'].includes(c.difficulty), `Invalid difficulty on ${c.id}`);
    assert.strictEqual(c.level, difficultyToLevel(c.difficulty), `Level mismatch on ${c.id}`);
    assert.ok(['Programming', 'DSA', 'SQL'].includes(c.track), `Invalid track on ${c.id}`);
    assert.ok(['Algorithms', 'Database', 'Programming'].includes(c.topicCategory), `Invalid topicCategory on ${c.id}`);
    assert.ok(c.tags.length > 0, `Challenge ${c.id} must have at least 1 topic tag`);
    assert.ok(c.companyTags.length > 0, `Challenge ${c.id} must have at least 1 company tag`);
    assert.ok(c.description.trim().length > 20, `Challenge ${c.id} must have a meaningful problem statement`);
    assert.ok(Object.keys(c.starterTemplates).length > 0, `Challenge ${c.id} must define starterTemplates`);
    assert.ok(c.testCases.length > 0, `Challenge ${c.id} must define testCases`);

    if (c.track === 'SQL') {
      assert.ok(typeof c.starterTemplates.sql === 'string' && c.starterTemplates.sql.trim().length > 0, `SQL challenge ${c.id} must provide sql starter template`);
    }

    for (const tag of c.tags) allTopics.add(tag);
    for (const comp of c.companyTags) allCompanies.add(comp);
  }

  const requiredTopics = [
    'Array',
    'String',
    'Hash Table',
    'Math',
    'Dynamic Programming',
    'Sorting',
    'Greedy',
    'Binary Search',
  ];
  for (const topic of requiredTopics) {
    assert.ok(allTopics.has(topic), `Catalog must include required topic: ${topic}`);
  }
  assert.ok(allCompanies.size >= 3, 'Catalog must include multiple company tags');
  console.log(`[PASS] Verified ${CHALLENGES.length} unique problems across 3 tracks and ${allTopics.size} topics`);

  // =========================================================================
  // 2. Originality, Zero Third-Party Branding & Zero-Emoji Audit
  // =========================================================================
  console.log('\n--- 2. Verifying Originality & Zero-Emoji Policy ---');

  const filesToAudit = [
    'src/lib/challenges/challenges-data.ts',
    'src/lib/challenges/dsa-challenges.ts',
    'src/lib/challenges/programming-challenges.ts',
    'src/lib/challenges/sql-challenges.ts',
    'src/components/practice/PracticeHub.tsx',
    'src/components/practice/PracticeFilters.tsx',
    'src/components/practice/PracticeProblemTable.tsx',
    'src/components/practice/PracticeWorkspace.tsx',
    'src/components/panels/ProblemDetailsPanel.tsx',
    'src/components/layout/CortexIdeShell.tsx',
    'src/components/sidebar/SearchSidebar.tsx',
    'src/components/panels/OutputPanel.tsx',
    'src/components/panels/TestCasesPanel.tsx',
    'src/components/practice/usePracticeProgress.ts',
    'src/app/ide/page.tsx',
    'src/app/challenges/page.tsx',
    'src/app/challenges/[id]/page.tsx',
    'src/components/modals/SettingsModal.tsx',
    'src/components/layout/GlobalSidebar.tsx',
    'src/app/api/v1/projects/[id]/files/[fileId]/route.ts',
    'src/lib/sql/database-engine.ts',
    'src/lib/execution/local-sandbox.ts',
  ];

  const forbiddenBrands = ['CipherSchools', 'LeetCode', 'THANKS2026'];

  for (const rel of filesToAudit) {
    const abs = path.join(projectRoot, rel);
    assert.ok(fs.existsSync(abs), `Required practice file must exist: ${rel}`);
    const content = fs.readFileSync(abs, 'utf8');

    const emojiViolations = detectEmojisInText(content, rel);
    assert.strictEqual(emojiViolations.length, 0, `Zero emojis allowed in ${rel}`);

    for (const brand of forbiddenBrands) {
      assert.ok(
        !content.toLowerCase().includes(brand.toLowerCase()),
        `Third-party branding "${brand}" must not appear in ${rel}`
      );
    }
  }
  console.log('[PASS] Original Cortex branding and zero-emoji policy verified across all practice files');

  // =========================================================================
  // 3. Statement & Topic Search + Edge Case Filtering Logic
  // =========================================================================
  console.log('\n--- 3. Verifying Search Across Titles, Statements & Topics ---');

  const searchMatches = (query: string) => {
    const q = query.trim().toLowerCase();
    return CHALLENGES.filter((c) => {
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.track.toLowerCase().includes(q) ||
        c.difficulty.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.companyTags.some((comp) => comp.toLowerCase().includes(q))
      );
    });
  };

  assert.strictEqual(searchMatches('').length, CHALLENGES.length, 'Empty search must return full catalog');
  assert.ok(searchMatches('alphanumeric').some((c) => c.id === 'valid-palindrome'), 'Search by problem statement phrase must match Valid Palindrome');
  assert.ok(searchMatches('Dynamic Programming').length >= 4, 'Search by topic name must match DP problems');
  assert.ok(searchMatches('sql').filter((c) => c.track === 'SQL').length >= 7, 'Search by track "sql" must match SQL track problems');
  assert.ok(searchMatches('dsa').filter((c) => c.track === 'DSA').length >= 8, 'Search by track "dsa" must match DSA track problems');
  assert.ok(searchMatches('hard').filter((c) => c.difficulty === 'Hard').length >= 1, 'Search by difficulty "hard" must match Hard problems');
  assert.strictEqual(searchMatches('zxq_nonexistent_token_999').length, 0, 'Nonsense query must return 0 results cleanly');
  console.log('[PASS] Search across titles, statements, tracks, difficulties, topics, and empty/zero-match edge cases verified');

  // =========================================================================
  // 4. Local Sandbox & SQL Engine Execution for Practice Problems
  // =========================================================================
  console.log('\n--- 4. Executing Practice Problems & Edge Cases in Local Sandbox ---');

  const sqlReferenceSolutions: Record<string, string> = {
    'sql-high-gpa-students': `SELECT name, major, gpa FROM student_records WHERE gpa >= 3.7 ORDER BY gpa DESC;`,
    'sql-department-salary-summary': `SELECT department, COUNT(*) AS headcount, SUM(salary) AS total_payroll FROM staff_payroll GROUP BY department ORDER BY total_payroll DESC;`,
    'sql-employee-department-join': `SELECT e.emp_name, d.dept_name, e.role FROM org_employees e INNER JOIN org_departments d ON e.dept_id = d.id WHERE d.dept_name IN ('Platform', 'Security') ORDER BY e.emp_name ASC;`,
    'sql-active-courses-enrollment': `SELECT c.code, COUNT(e.id) AS enrolled_count FROM course_catalog c INNER JOIN course_enrollments e ON c.id = e.course_id GROUP BY c.id, c.code HAVING COUNT(e.id) >= 2 ORDER BY enrolled_count DESC, c.code ASC;`,
    'sql-above-average-earners': `SELECT emp_name, salary FROM company_salaries WHERE salary > (SELECT AVG(salary) FROM company_salaries) ORDER BY salary DESC;`,
    'sql-running-revenue-total': `SELECT month_num, revenue, SUM(revenue) OVER (ORDER BY month_num) AS running_total FROM monthly_sales ORDER BY month_num ASC;`,
    'sql-top-salary-per-department': `WITH ranked_members AS (SELECT t.team_name, m.member_name, m.salary, ROW_NUMBER() OVER (PARTITION BY m.team_id ORDER BY m.salary DESC) AS rn FROM eng_members m INNER JOIN eng_teams t ON m.team_id = t.id) SELECT team_name, member_name, salary FROM ranked_members WHERE rn = 1 ORDER BY team_name ASC;`,
  };

  for (const sqlProblem of SQL_CHALLENGES) {
    // 4a. Starter stub must NOT leak solution or falsely pass tests
    assert.ok(
      sqlProblem.starterTemplates.sql.includes('-- TODO:'),
      `SQL starter template for ${sqlProblem.id} must be a TODO stub without leaking the solution`
    );
    const stubResult = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: `sql-stub-${sqlProblem.id}`, name: `${sqlProblem.slug}.sql`, path: `/${sqlProblem.slug}.sql`, content: sqlProblem.starterTemplates.sql }],
      entrypoint: `${sqlProblem.slug}.sql`,
      stdin: '',
    });
    assert.strictEqual(stubResult.status, 'success', `SQL stub ${sqlProblem.id} setup must execute cleanly: ${stubResult.stderr}`);
    assert.notStrictEqual(
      stubResult.stdout.trim(),
      sqlProblem.testCases[0].expectedStdout.trim(),
      `SQL starter stub ${sqlProblem.id} must not pre-solve the challenge`
    );

    // 4b. Reference solution appended to starter template must pass both local-sandbox and database-engine
    const solutionQuery = sqlReferenceSolutions[sqlProblem.id];
    assert.ok(solutionQuery, `Missing reference solution for ${sqlProblem.id}`);
    const fullSql = `${sqlProblem.starterTemplates.sql}\n${solutionQuery}`;

    const sqlResult = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: `sql-test-${sqlProblem.id}`, name: `${sqlProblem.slug}.sql`, path: `/${sqlProblem.slug}.sql`, content: fullSql }],
      entrypoint: `${sqlProblem.slug}.sql`,
      stdin: '',
    });
    assert.strictEqual(sqlResult.status, 'success', `SQL problem ${sqlProblem.id} must execute cleanly: ${sqlResult.stderr}`);
    assert.strictEqual(
      sqlResult.stdout.trim(),
      sqlProblem.testCases[0].expectedStdout.trim(),
      `SQL problem ${sqlProblem.id} local-sandbox output must match expected test output`
    );

    const engineRes = await executeSqlQuery(`test_practice_${sqlProblem.id}`, fullSql, 'sqlite');
    assert.ok(!engineRes.error, `SQL problem ${sqlProblem.id} database-engine error: ${engineRes.error}`);
    const engineStdout = engineRes.rows
      .map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))).join('|'))
      .join('\n')
      .trim();
    assert.strictEqual(
      engineStdout,
      sqlProblem.testCases[0].expectedStdout.trim(),
      `SQL problem ${sqlProblem.id} database-engine output must match expected test output`
    );
  }

  // 4c. SQL sandbox comment/string-literal edge cases & prohibited PRAGMA defense
  const sqlCommentSafe = await executeInLocalSandbox({
    language: 'sql',
    files: [{ id: 'sql-safe', name: 'safe.sql', path: '/safe.sql', content: `-- Do not attach or detach databases\nSELECT 'detach' AS status;` }],
    entrypoint: 'safe.sql',
    stdin: '',
  });
  assert.strictEqual(sqlCommentSafe.status, 'success', 'SQL comment/string mentioning attach/detach must not false-positive');
  assert.strictEqual(sqlCommentSafe.stdout.trim(), 'detach', 'Safe SQL literal output must match');

  const sqlPragmaBlocked = await executeInLocalSandbox({
    language: 'sql',
    files: [{ id: 'sql-bad', name: 'bad.sql', path: '/bad.sql', content: `PRAGMA database_list;` }],
    entrypoint: 'bad.sql',
    stdin: '',
  });
  assert.strictEqual(sqlPragmaBlocked.status, 'runtime_error', 'Prohibited PRAGMA database_list must be rejected');

  const sqlMultiPragmaBypassBlocked = await executeInLocalSandbox({
    language: 'sql',
    files: [{ id: 'sql-bad-multi', name: 'bad-multi.sql', path: '/bad-multi.sql', content: `PRAGMA table_info('x'); PRAGMA database_list;` }],
    entrypoint: 'bad-multi.sql',
    stdin: '',
  });
  assert.strictEqual(
    sqlMultiPragmaBypassBlocked.status,
    'runtime_error',
    'Multi-statement PRAGMA bypass (PRAGMA table_info + PRAGMA database_list) must be rejected'
  );

  // 4c-2. Iteration 2 SQL Security & Parser Hardening across BOTH local-sandbox and database-engine
  const advSqlProjectId = `test_adv_sec_${Date.now()}`;
  const vacuumTarget = path.join(os.tmpdir(), `cortex_vacuum_probe_${Date.now()}.db`).replace(/\\/g, '/');
  try {
    const sqlRejectPayloads = [
      { label: 'VACUUM INTO', sql: `VACUUM INTO '${vacuumTarget}';` },
      { label: 'VACUUM /*c*/ main /*c*/ INTO', sql: `VACUUM /*c*/ main /*c*/ INTO '${vacuumTarget}';` },
      { label: 'PRAGMA table_info + PRAGMA user_version', sql: `PRAGMA table_info('students'); PRAGMA user_version = 1337;` },
      { label: 'pragma_database_list', sql: `SELECT * FROM pragma_database_list;` },
      { label: 'pragma_compile_options', sql: `SELECT * FROM pragma_compile_options();` },
      { label: 'quoted "pragma_database_list"', sql: `SELECT * FROM "pragma_database_list";` },
      { label: 'quoted "pragma_compile_options"()', sql: `SELECT * FROM "pragma_compile_options"();` },
      { label: 'bracketed [pragma_database_list]', sql: `SELECT * FROM [pragma_database_list];` },
      { label: 'backticked `pragma_compile_options`', sql: 'SELECT * FROM `pragma_compile_options`;' },
      { label: 'schema-qualified main."pragma_database_list"', sql: `SELECT * FROM main."pragma_database_list";` },
      { label: 'quoted "load_extension"', sql: `SELECT "load_extension"('mod');` },
      { label: 'bracketed [load_extension]', sql: `SELECT [load_extension]('mod');` },
      { label: 'backticked `load_extension`', sql: "SELECT `load_extension`('mod');" },
      { label: 'cross-quote smuggling pragma_database_list', sql: `SELECT 1 AS "a'", name, file FROM pragma_database_list WHERE ''='';` },
    ];

    for (const payload of sqlRejectPayloads) {
      const localRes = await executeInLocalSandbox({
        language: 'sql',
        files: [{ id: 'sql-sec', name: 'sec.sql', path: '/sec.sql', content: payload.sql }],
        entrypoint: 'sec.sql',
        stdin: '',
      });
      assert.strictEqual(
        localRes.status,
        'runtime_error',
        `local-sandbox must reject ${payload.label}`
      );
      assert.strictEqual(localRes.stdout, '', `local-sandbox must return empty stdout for ${payload.label}`);
      assert.ok(
        localRes.stderr.toLowerCase().includes('access denied'),
        `local-sandbox error for ${payload.label} must include Access denied, got: ${localRes.stderr}`
      );

      const engineRes = await executeSqlQuery(advSqlProjectId, payload.sql, 'sqlite');
      assert.strictEqual(engineRes.rows.length, 0, `database-engine must return 0 rows for ${payload.label}`);
      assert.ok(
        Boolean(engineRes.error) && engineRes.error!.toLowerCase().includes('access denied'),
        `database-engine must reject ${payload.label} with Access denied, got: ${engineRes.error}`
      );
    }

    assert.strictEqual(fs.existsSync(vacuumTarget), false, 'VACUUM INTO must never create a host file');

    // Benign single-quoted string literals mentioning pragma_* or load_extension must be allowed
    const benignLiteralSql = `SELECT 'pragma_database_list' AS p, 'load_extension' AS l;`;
    const localLiteralOk = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: 'sql-lit-ok', name: 'lit-ok.sql', path: '/lit-ok.sql', content: benignLiteralSql }],
      entrypoint: 'lit-ok.sql',
      stdin: '',
    });
    assert.strictEqual(localLiteralOk.status, 'success', `Benign string literal must succeed in local-sandbox: ${localLiteralOk.stderr}`);
    assert.strictEqual(localLiteralOk.stdout.trim(), 'pragma_database_list|load_extension');
    const engineLiteralOk = await executeSqlQuery(`${advSqlProjectId}_lit`, benignLiteralSql, 'sqlite');
    assert.ok(!engineLiteralOk.error && engineLiteralOk.rows.length === 1, `Benign string literal must succeed in database-engine: ${engineLiteralOk.error}`);

    // WITH RECURSIVE parity across local-sandbox and database-engine:
    // 1) Non-looping WITH RECURSIVE ... UPDATE (no UNION) must succeed in both engines
    const nonLoopingRecursiveDml = `CREATE TABLE t_upd(x INT); INSERT INTO t_upd VALUES (1); WITH RECURSIVE c(n) AS (SELECT 2) UPDATE t_upd SET x = (SELECT n FROM c);`;
    const localNonLoopRes = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: 'sql-rec-dml', name: 'rec-dml.sql', path: '/rec-dml.sql', content: nonLoopingRecursiveDml }],
      entrypoint: 'rec-dml.sql',
      stdin: '',
    });
    assert.strictEqual(localNonLoopRes.status, 'success', `Non-looping WITH RECURSIVE UPDATE must succeed in local-sandbox: ${localNonLoopRes.stderr}`);
    const engineNonLoopRes = await executeSqlQuery(`${advSqlProjectId}_rec_dml`, nonLoopingRecursiveDml, 'sqlite');
    assert.ok(!engineNonLoopRes.error, `Non-looping WITH RECURSIVE UPDATE must succeed in database-engine: ${engineNonLoopRes.error}`);
    const verifyUpdated = await executeSqlQuery(`${advSqlProjectId}_rec_dml`, 'SELECT x FROM t_upd;', 'sqlite');
    assert.strictEqual(verifyUpdated.rows[0]?.[0], 2, 'Non-looping WITH RECURSIVE UPDATE must update row to 2');

    // 2) Bounded recursive CTEs (including OFFSET, comma-offset, arithmetic grouping, CTE self-limit, and dialects) must succeed
    const boundedRecursiveSql = `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt LIMIT 5;`;
    const localBoundedRec = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: 'sql-rec-ok', name: 'rec-ok.sql', path: '/rec-ok.sql', content: boundedRecursiveSql }],
      entrypoint: 'rec-ok.sql',
      stdin: '',
    });
    assert.strictEqual(localBoundedRec.status, 'success', `Bounded recursive CTE must succeed in local-sandbox: ${localBoundedRec.stderr}`);
    assert.deepStrictEqual(localBoundedRec.stdout.trim().split('\n'), ['1', '2', '3', '4', '5']);
    const engineBoundedRec = await executeSqlQuery(`${advSqlProjectId}_rec_ok`, boundedRecursiveSql, 'sqlite');
    assert.ok(!engineBoundedRec.error && engineBoundedRec.rows.length === 5, `Bounded recursive CTE must return 5 rows in database-engine: ${engineBoundedRec.error}`);

    const boundedVariants: Array<{ label: string; sql: string; expectedLines: string[] }> = [
      {
        label: 'LIMIT 5 OFFSET 2',
        sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt LIMIT 5 OFFSET 2;`,
        expectedLines: ['3', '4', '5', '6', '7'],
      },
      {
        label: 'LIMIT 2, 5',
        sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt LIMIT 2, 5;`,
        expectedLines: ['3', '4', '5', '6', '7'],
      },
      {
        label: 'SELECT (x + 1) arithmetic grouping',
        sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT (x + 1) FROM cnt LIMIT 5;`,
        expectedLines: ['2', '3', '4', '5', '6'],
      },
      {
        label: 'CTE body LIMIT 5 with outer COUNT(*)',
        sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt LIMIT 5) SELECT COUNT(*) FROM cnt;`,
        expectedLines: ['5'],
      },
    ];
    for (const variant of boundedVariants) {
      const localVarRes = await executeInLocalSandbox({
        language: 'sql',
        files: [{ id: 'sql-rec-var', name: 'rec-var.sql', path: '/rec-var.sql', content: variant.sql }],
        entrypoint: 'rec-var.sql',
        stdin: '',
      });
      assert.strictEqual(localVarRes.status, 'success', `local-sandbox must accept ${variant.label}: ${localVarRes.stderr}`);
      assert.deepStrictEqual(localVarRes.stdout.trim().split('\n'), variant.expectedLines, `local-sandbox output mismatch for ${variant.label}`);

      const engineVarRes = await executeSqlQuery(`${advSqlProjectId}_rec_var`, variant.sql, 'sqlite');
      assert.ok(!engineVarRes.error, `database-engine must accept ${variant.label}: ${engineVarRes.error}`);
      assert.deepStrictEqual(
        engineVarRes.rows.map((r) => String(r[0])),
        variant.expectedLines,
        `database-engine output mismatch for ${variant.label}`
      );
    }

    const mssqlBoundedRes = await executeSqlQuery(
      `${advSqlProjectId}_rec_mssql`,
      `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT TOP 5 * FROM cnt;`,
      'mssql'
    );
    assert.ok(!mssqlBoundedRes.error && mssqlBoundedRes.rows.length === 5, `mssql bounded recursive CTE must return 5 rows: ${mssqlBoundedRes.error}`);

    const oracleBoundedRes = await executeSqlQuery(
      `${advSqlProjectId}_rec_oracle`,
      `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt WHERE ROWNUM <= 5;`,
      'oracle'
    );
    assert.ok(!oracleBoundedRes.error && oracleBoundedRes.rows.length === 5, `oracle bounded recursive CTE must return 5 rows: ${oracleBoundedRes.error}`);

    // 3) Unbounded recursive CTE queries must be rejected in BOTH engines without stalling
    const unboundedRecursivePayloads = [
      { label: 'WITH RECURSIVE unbounded', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT count(*) FROM cnt;` },
      { label: 'implicit self-referencing CTE without RECURSIVE', sql: `WITH cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt;` },
      { label: 'subquery-only LIMIT bypass', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r WHERE n IN (SELECT 1 LIMIT 1);` },
      { label: 'outer LIMIT after ORDER BY', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt ORDER BY x LIMIT 5;` },
      { label: 'outer LIMIT after COUNT(*)', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT count(*) FROM cnt LIMIT 1;` },
      { label: 'outer LIMIT after GROUP BY', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT x FROM cnt GROUP BY x LIMIT 5;` },
      { label: 'outer LIMIT after DISTINCT', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT DISTINCT x FROM cnt LIMIT 5;` },
      { label: 'outer LIMIT after WHERE filter', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt WHERE x = -1 LIMIT 5;` },
      { label: 'scientific LIMIT 1e9', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt LIMIT 1e9;` },
      { label: 'negative LIMIT -1', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt LIMIT -1;` },
      { label: 'oversized LIMIT 99999999', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt LIMIT 99999999;` },
      { label: 'LIMIT offset, oversized count', sql: `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt) SELECT * FROM cnt LIMIT 5, 99999999;` },
      // Challenger r5 & Explorer r6 regression vectors
      { label: 'LIMIT 5 OFFSET 1000000000', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r LIMIT 5 OFFSET 1000000000;` },
      { label: 'LIMIT 1000000000, 5', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r LIMIT 1000000000, 5;` },
      { label: 'CTE body LIMIT 1000000000, 5', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r LIMIT 1000000000, 5) SELECT * FROM r;` },
      { label: 'CTE body LIMIT 5 OFFSET 1000000000', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r LIMIT 5 OFFSET 1000000000) SELECT * FROM r;` },
      { label: 'LIMIT arithmetic expression 5 + 1000000000', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r LIMIT 5 + 1000000000;` },
      { label: 'LIMIT parenthesized OFFSET (1000000000)', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r LIMIT 5 OFFSET (1000000000);` },
      { label: 'LIMIT 6000 OFFSET 6000 exceeding maxRows', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r LIMIT 6000 OFFSET 6000;` },
      { label: 'derived table ORDER BY', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM (SELECT * FROM r ORDER BY n) LIMIT 1;` },
      { label: 'derived table WHERE impossible', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM (SELECT * FROM r WHERE n < 0) LIMIT 1;` },
      { label: 'derived table DISTINCT', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT 1 FROM r) SELECT * FROM (SELECT DISTINCT n FROM r) LIMIT 2;` },
      { label: 'derived table GROUP BY', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM (SELECT n FROM r GROUP BY n) LIMIT 1;` },
      { label: 'scalar subquery ORDER BY', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT (SELECT n FROM r ORDER BY n DESC LIMIT 1) FROM r LIMIT 1;` },
      { label: 'scalar subquery WHERE impossible', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT (SELECT 1 FROM r WHERE n < 0) FROM r LIMIT 1;` },
      { label: 'multi-CTE chain ORDER BY', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r), s(n) AS (SELECT * FROM r ORDER BY n) SELECT * FROM s LIMIT 5;` },
      { label: 'multi-CTE chain WHERE impossible', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r), s(n) AS (SELECT * FROM r WHERE n < 0) SELECT * FROM s LIMIT 5;` },
      { label: 'unlisted aggregate JSON_GROUP_ARRAY', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT JSON_GROUP_ARRAY(n) FROM r LIMIT 1;` },
      { label: 'unlisted aggregate JSONB_GROUP_ARRAY', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT JSONB_GROUP_ARRAY(n) FROM r LIMIT 1;` },
      { label: 'unlisted aggregate STRING_AGG', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT STRING_AGG(n, ',') FROM r LIMIT 1;` },
      { label: 'quoted aggregate "count"(n)', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT "count"(n) FROM r LIMIT 1;` },
      { label: 'bracketed aggregate [count](n)', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT [count](n) FROM r LIMIT 1;` },
      { label: 'AS MATERIALIZED CTE', sql: `WITH RECURSIVE r(n) AS MATERIALIZED (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r LIMIT 5;` },
      { label: 'comma-join outer', sql: `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM r, (SELECT 1) LIMIT 1;` },
      { label: 'DELETE with unbounded recursive CTE', sql: `CREATE TABLE IF NOT EXISTS t_upd_del(x INT); WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) DELETE FROM t_upd_del WHERE x IN (SELECT n FROM r);` },
    ];
    for (const payload of unboundedRecursivePayloads) {
      const localUnbounded = await executeInLocalSandbox({
        language: 'sql',
        files: [{ id: 'sql-rec-bad', name: 'rec-bad.sql', path: '/rec-bad.sql', content: payload.sql }],
        entrypoint: 'rec-bad.sql',
        stdin: '',
      });
      assert.strictEqual(localUnbounded.status, 'runtime_error', `local-sandbox must reject ${payload.label}`);
      assert.ok(
        localUnbounded.stderr.includes('explicit LIMIT clause'),
        `local-sandbox error for ${payload.label} must mention explicit LIMIT clause, got: ${localUnbounded.stderr}`
      );
      const engineUnbounded = await executeSqlQuery(`${advSqlProjectId}_rec_bad`, payload.sql, 'sqlite');
      assert.strictEqual(engineUnbounded.rows.length, 0, `database-engine must return 0 rows for ${payload.label}`);
      assert.ok(
        Boolean(engineUnbounded.error) && engineUnbounded.error!.includes('explicit LIMIT clause'),
        `database-engine error for ${payload.label} must mention explicit LIMIT clause, got: ${engineUnbounded.error}`
      );
    }

    const mssqlDerivedOrderBy = await executeSqlQuery(
      `${advSqlProjectId}_rec_bad_mssql`,
      `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT TOP 5 * FROM (SELECT * FROM r ORDER BY n);`,
      'mssql'
    );
    assert.ok(
      Boolean(mssqlDerivedOrderBy.error) && mssqlDerivedOrderBy.error!.includes('explicit LIMIT clause'),
      `mssql TOP + derived ORDER BY must reject with explicit LIMIT clause, got: ${mssqlDerivedOrderBy.error}`
    );

    const oracleDerivedOrderBy = await executeSqlQuery(
      `${advSqlProjectId}_rec_bad_oracle`,
      `WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT * FROM (SELECT * FROM r ORDER BY n) WHERE ROWNUM <= 5;`,
      'oracle'
    );
    assert.ok(
      Boolean(oracleDerivedOrderBy.error) && oracleDerivedOrderBy.error!.includes('explicit LIMIT clause'),
      `oracle ROWNUM + derived ORDER BY must reject with explicit LIMIT clause, got: ${oracleDerivedOrderBy.error}`
    );

    // 4) Layer 2 child-process timeout isolation check (non-recursive slow cross-join must be killed cleanly at timeoutMs)
    const slowSql = `CREATE TABLE t_big(x INT); INSERT INTO t_big VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10); SELECT SUM(a.x + b.x + c.x + d.x + e.x + f.x + g.x + h.x) FROM t_big a, t_big b, t_big c, t_big d, t_big e, t_big f, t_big g, t_big h WHERE (a.x + b.x + c.x + d.x + e.x + f.x + g.x + h.x) > 0;`;
    const timeoutCheckStart = Date.now();
    const localTimeoutRes = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: 'sql-timeout', name: 'timeout.sql', path: '/timeout.sql', content: slowSql }],
      entrypoint: 'timeout.sql',
      stdin: '',
      runTimeoutMs: 1000,
    });
    const timeoutElapsed = Date.now() - timeoutCheckStart;
    assert.strictEqual(localTimeoutRes.status, 'timeout', `Slow SQL query must time out via child-process isolation, got status=${localTimeoutRes.status}`);
    assert.strictEqual(localTimeoutRes.exitCode, 124, 'Timed-out SQL query must return exitCode 124');
    assert.ok(timeoutElapsed < 3500, `Timeout isolation must kill hung SQLite child promptly (<3500ms), took ${timeoutElapsed}ms`);

    // Valid multi-statement PRAGMA introspection must succeed in both engines
    const validPragmaSql = `CREATE TABLE t_ok(a INT); PRAGMA table_info('t_ok');`;
    const localPragmaOk = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: 'sql-ok', name: 'ok.sql', path: '/ok.sql', content: validPragmaSql }],
      entrypoint: 'ok.sql',
      stdin: '',
    });
    assert.strictEqual(localPragmaOk.status, 'success', `Valid multi-statement PRAGMA must succeed in local-sandbox: ${localPragmaOk.stderr}`);
    const enginePragmaOk = await executeSqlQuery(`${advSqlProjectId}_ok`, validPragmaSql, 'sqlite');
    assert.ok(!enginePragmaOk.error && enginePragmaOk.rows.length > 0, `Valid multi-statement PRAGMA must succeed in database-engine: ${enginePragmaOk.error}`);

    // Setup statement ending in -- line comment before ; (LF and CR)
    const commentSetupSql = `CREATE TABLE t_bug(a INT) -- trailing comment\n; INSERT INTO t_bug VALUES (99); SELECT a FROM t_bug;`;
    const localCommentRes = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: 'sql-cmt', name: 'cmt.sql', path: '/cmt.sql', content: commentSetupSql }],
      entrypoint: 'cmt.sql',
      stdin: '',
    });
    assert.strictEqual(localCommentRes.status, 'success', `Comment-terminated setup SQL failed in local-sandbox: ${localCommentRes.stderr}`);
    assert.strictEqual(localCommentRes.stdout.trim(), '99', 'Comment-terminated setup SQL must return 99 in local-sandbox');

    const engineCommentRes = await executeSqlQuery(`${advSqlProjectId}_cmt`, commentSetupSql, 'sqlite');
    assert.ok(!engineCommentRes.error, `Comment-terminated setup SQL failed in database-engine: ${engineCommentRes.error}`);
    assert.strictEqual(String(engineCommentRes.rows[0]?.[0]), '99', 'Comment-terminated setup SQL must return 99 in database-engine');

    const crCommentSql = `CREATE TABLE t_cr(a INT) -- cr comment\r; INSERT INTO t_cr VALUES (42); SELECT a FROM t_cr;`;
    const localCrRes = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: 'sql-cr', name: 'cr.sql', path: '/cr.sql', content: crCommentSql }],
      entrypoint: 'cr.sql',
      stdin: '',
    });
    assert.strictEqual(localCrRes.status, 'success', `CR comment-terminated setup SQL failed: ${localCrRes.stderr}`);
    assert.strictEqual(localCrRes.stdout.trim(), '42', 'CR comment-terminated setup SQL must return 42');

    // DML CTE (WITH ... INSERT) must execute as DML rather than returning empty SELECT rows
    const dmlCteSql = `CREATE TABLE t_ins(x INT); WITH cte AS (SELECT 7 AS v) INSERT INTO t_ins SELECT v FROM cte;`;
    const localDmlCte = await executeInLocalSandbox({
      language: 'sql',
      files: [{ id: 'sql-dml-cte', name: 'dml-cte.sql', path: '/dml-cte.sql', content: dmlCteSql }],
      entrypoint: 'dml-cte.sql',
      stdin: '',
    });
    assert.strictEqual(localDmlCte.status, 'success', `DML CTE failed in local-sandbox: ${localDmlCte.stderr}`);
    assert.strictEqual(localDmlCte.stdout.trim(), 'Query executed successfully.', 'DML CTE must report execution in local-sandbox');

    const dmlCteProject = `${advSqlProjectId}_cte`;
    const engineDmlCte = await executeSqlQuery(dmlCteProject, dmlCteSql, 'sqlite');
    assert.ok(!engineDmlCte.error, `DML CTE failed in database-engine: ${engineDmlCte.error}`);
    assert.strictEqual(engineDmlCte.rows[0]?.[0], 'Query executed successfully', 'DML CTE must execute via db.exec in database-engine');
    assert.strictEqual(engineDmlCte.rows[0]?.[1], 1, 'DML CTE must insert 1 row in database-engine');
    const verifyInserted = await executeSqlQuery(dmlCteProject, 'SELECT x FROM t_ins;', 'sqlite');
    assert.strictEqual(verifyInserted.rows[0]?.[0], 7, 'DML CTE inserted row must persist in database-engine');
  } finally {
    try {
      if (fs.existsSync(vacuumTarget)) fs.unlinkSync(vacuumTarget);
    } catch {}
  }

  // 4c-3. Windows CRLF Normalization & Multi-Line Problem Execution (merge-overlapping-intervals & fizzbuzz-sequence)
  const mergeChallenge = CHALLENGES.find((c) => c.id === 'merge-overlapping-intervals');
  const fizzChallenge = CHALLENGES.find((c) => c.id === 'fizzbuzz-sequence');
  assert.ok(mergeChallenge && fizzChallenge, 'merge-overlapping-intervals and fizzbuzz-sequence must exist');

  const multiLineSolutions: Array<{
    challenge: typeof mergeChallenge;
    lang: 'python' | 'cpp';
    ext: string;
    code: string;
  }> = [
    {
      challenge: mergeChallenge!,
      lang: 'python',
      ext: 'py',
      code: mergeChallenge!.starterTemplates.python.replace(
        '    # TODO: Sort intervals by start and merge overlapping bounds\n    return intervals',
        `    intervals.sort(key=lambda x: x[0])\n    merged = []\n    for s, e in intervals:\n        if not merged or s > merged[-1][1]:\n            merged.append([s, e])\n        else:\n            merged[-1][1] = max(merged[-1][1], e)\n    return merged`
      ),
    },
    {
      challenge: mergeChallenge!,
      lang: 'cpp',
      ext: 'cpp',
      code: mergeChallenge!.starterTemplates.cpp.replace(
        '    // TODO: Sort intervals by start and merge overlapping bounds\n    return intervals;',
        `    sort(intervals.begin(), intervals.end());\n    vector<pair<int, int>> merged;\n    for (const auto& iv : intervals) {\n        if (merged.empty() || iv.first > merged.back().second) {\n            merged.push_back(iv);\n        } else {\n            merged.back().second = max(merged.back().second, iv.second);\n        }\n    }\n    return merged;`
      ),
    },
    {
      challenge: fizzChallenge!,
      lang: 'python',
      ext: 'py',
      code: fizzChallenge!.starterTemplates.python.replace(
        '    # TODO: Print each line from 1 to n\n    pass',
        `    for i in range(1, n + 1):\n        if i % 15 == 0:\n            print("FizzBuzz")\n        elif i % 3 == 0:\n            print("Fizz")\n        elif i % 5 == 0:\n            print("Buzz")\n        else:\n            print(i)`
      ),
    },
    {
      challenge: fizzChallenge!,
      lang: 'cpp',
      ext: 'cpp',
      code: fizzChallenge!.starterTemplates.cpp.replace(
        '    // TODO: Print each line from 1 to n',
        `    for (int i = 1; i <= n; i++) {\n        if (i % 15 == 0) cout << "FizzBuzz" << endl;\n        else if (i % 3 == 0) cout << "Fizz" << endl;\n        else if (i % 5 == 0) cout << "Buzz" << endl;\n        else cout << i << endl;\n    }`
      ),
    },
  ];

  const prevExecMode = process.env.EXECUTION_MODE;
  process.env.EXECUTION_MODE = 'development';
  try {
    for (const item of multiLineSolutions) {
      for (const tc of item.challenge.testCases) {
        const res = await executeInLocalSandbox({
          language: item.lang,
          files: [{ id: `${item.challenge.id}-${item.lang}`, name: `${item.challenge.slug}.${item.ext}`, path: `/${item.challenge.slug}.${item.ext}`, content: item.code }],
          entrypoint: `${item.challenge.slug}.${item.ext}`,
          stdin: tc.stdin,
        });
        assert.strictEqual(res.status, 'success', `${item.challenge.id} (${item.lang}) failed: ${res.stderr}`);
        assert.ok(!res.stdout.includes('\r\n'), `${item.challenge.id} (${item.lang}) stdout must not contain CRLF`);
        assert.strictEqual(
          res.stdout.trim(),
          tc.expectedStdout.trim(),
          `${item.challenge.id} (${item.lang}) tc=${tc.id} stdout mismatch`
        );

        const arenaRes = await executeArenaTestCase({
          language: item.lang,
          files: [{ id: `${item.challenge.id}-${item.lang}`, name: `${item.challenge.slug}.${item.ext}`, path: `/${item.challenge.slug}.${item.ext}`, content: item.code }],
          stdin: tc.stdin,
        });
        assert.strictEqual(arenaRes.status, 'success', `Arena helper ${item.challenge.id} (${item.lang}) failed: ${arenaRes.stderr}`);
        assert.strictEqual(arenaRes.stdout.trim(), tc.expectedStdout.trim(), `Arena helper ${item.challenge.id} (${item.lang}) tc=${tc.id} mismatch`);
      }
    }

    // Verify runTestCases normalizes \r\n from cloud/gateway responses
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            status: 'success',
            exitCode: 0,
            stdout: '1\r\n2\r\nFizz\r\n4\r\nBuzz\r\n',
            stderr: '',
            execution_time: 12,
            memory: 8,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )) as typeof fetch;

      const tcEval = await runTestCases(
        {
          language: 'python',
          files: [{ id: 'fb', name: 'fizzbuzz-sequence.py', path: '/fizzbuzz-sequence.py', content: 'print("1")' }],
          entrypoint: 'fizzbuzz-sequence.py',
        },
        [fizzChallenge!.testCases[0]]
      );
      assert.strictEqual(tcEval.passedCount, 1, 'runTestCases must normalize CRLF stdout to match expectedStdout');
      assert.ok(!tcEval.testCases[0].actualStdout?.includes('\r'), 'runTestCases actualStdout must not contain CR');
    } finally {
      globalThis.fetch = origFetch;
    }
  } finally {
    if (prevExecMode === undefined) delete process.env.EXECUTION_MODE;
    else process.env.EXECUTION_MODE = prevExecMode;
  }

  // 4d. Execute Python and JavaScript starter templates across all non-SQL challenges
  for (const ch of [...DSA_CHALLENGES, ...PROGRAMMING_CHALLENGES]) {
    if (ch.starterTemplates.python) {
      const pyRes = await executeInLocalSandbox({
        language: 'python',
        files: [{ id: `py-${ch.id}`, name: `${ch.slug}.py`, path: `/${ch.slug}.py`, content: ch.starterTemplates.python }],
        entrypoint: `${ch.slug}.py`,
        stdin: ch.testCases[0].stdin,
      });
      assert.strictEqual(pyRes.status, 'success', `Python template for ${ch.id} failed: ${pyRes.stderr}`);
    }
    if (ch.starterTemplates.javascript) {
      const jsRes = await executeInLocalSandbox({
        language: 'javascript',
        files: [{ id: `js-${ch.id}`, name: `${ch.slug}.js`, path: `/${ch.slug}.js`, content: ch.starterTemplates.javascript }],
        entrypoint: `${ch.slug}.js`,
        stdin: ch.testCases[0].stdin,
      });
      assert.strictEqual(jsRes.status, 'success', `JS template for ${ch.id} failed: ${jsRes.stderr}`);
    }
  }

  const twoSumProblem = CHALLENGES.find((c) => c.id === 'two-sum');
  assert.ok(twoSumProblem, 'two-sum challenge must exist');
  const pyResult = await executeInLocalSandbox({
    language: 'python',
    files: [{ id: 'py-test', name: 'two-sum.py', path: '/two-sum.py', content: twoSumProblem!.starterTemplates.python }],
    entrypoint: 'two-sum.py',
    stdin: twoSumProblem!.testCases[0].stdin,
  });
  assert.strictEqual(pyResult.status, 'success', `Two Sum Python execution must succeed: ${pyResult.stderr}`);
  assert.strictEqual(
    pyResult.stdout.trim(),
    twoSumProblem!.testCases[0].expectedStdout.trim(),
    'Two Sum Python output must match expected test case stdout'
  );
  console.log('[PASS] Live local sandbox & SQL engine execution verified across all 25 challenges');

  // =========================================================================
  // 5. IDE Integration & Dark/Light Mode Contract Audit
  // =========================================================================
  console.log('\n--- 5. Verifying /ide Practice Hub Switch & Theme Support ---');

  const ideContent = fs.readFileSync(path.join(projectRoot, 'src/app/ide/page.tsx'), 'utf8');
  assert.ok(ideContent.includes('isPracticeHubOpen'), 'ide/page.tsx must toggle full-page PracticeHub via isPracticeHubOpen');
  assert.ok(ideContent.includes('<PracticeHub'), 'ide/page.tsx must render PracticeHub');
  assert.ok(ideContent.includes('<ProblemDetailsPanel'), 'ide/page.tsx must render ProblemDetailsPanel when a problem is launched');
  assert.ok(ideContent.includes('key={activePracticeChallenge.id}'), 'ProblemDetailsPanel must be keyed by activePracticeChallenge.id');
  assert.ok(ideContent.includes('isChallengeFileActive'), 'ide/page.tsx must track challenge file tab alignment');
  assert.ok(ideContent.includes('syncTimestampFromPatch'), 'ide/page.tsx must sync updatedAt timestamps after PATCH');
  assert.ok(ideContent.includes('handleLaunchChallenge'), 'ide/page.tsx must wire problem launch flow back into editor');

  const testCasesContent = fs.readFileSync(path.join(projectRoot, 'src/components/panels/TestCasesPanel.tsx'), 'utf8');
  assert.ok(testCasesContent.includes('tc.error'), 'TestCasesPanel must surface tc.error diagnostics');

  const hubContent = fs.readFileSync(path.join(projectRoot, 'src/components/practice/PracticeHub.tsx'), 'utf8');
  assert.ok(hubContent.includes('isDarkMode'), 'PracticeHub must support Dark and Light mode');
  assert.ok(hubContent.includes('practice-hub-workspace'), 'PracticeHub must expose workspace test id');
  assert.ok(
    hubContent.includes('c.track.toLowerCase()') && hubContent.includes('c.difficulty.toLowerCase()'),
    'PracticeHub search must match track and difficulty'
  );
  assert.ok(
    !hubContent.includes('PracticeTrackCards') && hubContent.includes('#09090B') && hubContent.includes('#F59E0B'),
    'PracticeHub must use high-density zinc/amber Linear layout without stacked PracticeTrackCards'
  );

  const filtersContent = fs.readFileSync(path.join(projectRoot, 'src/components/practice/PracticeFilters.tsx'), 'utf8');
  assert.ok(
    filtersContent.includes('practice-filter-topic') &&
      filtersContent.includes('practice-filter-difficulty') &&
      filtersContent.includes('practice-filter-status') &&
      filtersContent.includes('practice-filter-company'),
    'PracticeFilters must expose single-row Topic, Difficulty, Status, and Company dropdowns'
  );

  const tableContent = fs.readFileSync(path.join(projectRoot, 'src/components/practice/PracticeProblemTable.tsx'), 'utf8');
  assert.ok(
    tableContent.includes('practice-sort-title') &&
      tableContent.includes('practice-sort-acceptance') &&
      tableContent.includes('practice-sort-difficulty'),
    'PracticeProblemTable must support sortable Title, Acceptance, and Difficulty column headers'
  );

  const detailsContent = fs.readFileSync(path.join(projectRoot, 'src/components/panels/ProblemDetailsPanel.tsx'), 'utf8');
  assert.ok(detailsContent.includes('activeTestCasesCount'), 'ProblemDetailsPanel must expose activeTestCasesCount compatibility prop');
  assert.ok(
    detailsContent.includes('INLINE_CODE_PILL') &&
      detailsContent.includes('problem-toggle-topics') &&
      detailsContent.includes('problem-toggle-companies') &&
      !detailsContent.includes('Template Language'),
    'ProblemDetailsPanel must format inline backticks cleanly with collapsible Topics/Companies and no duplicate Template Language card'
  );

  const workspaceContent = fs.readFileSync(path.join(projectRoot, 'src/components/practice/PracticeWorkspace.tsx'), 'utf8');
  assert.ok(
    workspaceContent.includes('#0F0F10') &&
      workspaceContent.includes('#1C1C1E') &&
      workspaceContent.includes('#262629') &&
      workspaceContent.includes('practice-run-btn') &&
      workspaceContent.includes('practice-submit-btn') &&
      workspaceContent.includes('practice-h-splitter') &&
      workspaceContent.includes('practice-v-splitter') &&
      workspaceContent.includes('w-full') &&
      !workspaceContent.includes('w-screen'),
    'PracticeWorkspace must implement 3-panel floating-card zinc layout filling AppShell main container alongside GlobalSidebar'
  );

  assert.ok(
    ideContent.includes('cortex:sidebar-tab-toggle') &&
      ideContent.includes('highlightTab={isPracticeProblemMode') &&
      !ideContent.includes('hideSidebar={isPracticeProblemMode}'),
    'ide/page.tsx must keep GlobalSidebar accessible and exit Practice Problem Mode when switching sidebar tabs'
  );

  const ideShellContent = fs.readFileSync(path.join(projectRoot, 'src/components/layout/CortexIdeShell.tsx'), 'utf8');
  assert.ok(
    ideShellContent.includes('ide-command-palette-trigger') &&
      ideShellContent.includes('ide-ai-complete-toggle') &&
      ideShellContent.includes('ide-run-btn') &&
      ideShellContent.includes('ide-status-bar') &&
      ideShellContent.includes('status-bar-feedback-btn'),
    'CortexIdeShell must render flagship titlebar, Cmd+K palette, AI dot toggle, graphite Run button, and status bar'
  );

  const outputPanelContent = fs.readFileSync(path.join(projectRoot, 'src/components/panels/OutputPanel.tsx'), 'utf8');
  assert.ok(
    outputPanelContent.includes('ide-output-split') && outputPanelContent.includes('ide-stdin-pane'),
    'OutputPanel must render side-by-side Output and Stdin panes'
  );

  assert.ok(ideContent.includes('handleThemeChange'), 'ide/page.tsx must sync SettingsModal theme changes with isDarkMode');

  const settingsContent = fs.readFileSync(path.join(projectRoot, 'src/components/modals/SettingsModal.tsx'), 'utf8');
  assert.ok(settingsContent.includes('cortex-light') && settingsContent.includes('isDarkMode'), 'SettingsModal must support cortex-light and isDarkMode styling');

  const challengesPageContent = fs.readFileSync(path.join(projectRoot, 'src/app/challenges/page.tsx'), 'utf8');
  assert.ok(challengesPageContent.includes('href="/ide"'), '/challenges page Launch Cloud IDE link must route to /ide');

  const globalSidebarContent = fs.readFileSync(path.join(projectRoot, 'src/components/layout/GlobalSidebar.tsx'), 'utf8');
  assert.ok(globalSidebarContent.includes('handleLogoClick'), 'GlobalSidebar must wire handleLogoClick on Cortex logo Link');
  assert.ok(
    globalSidebarContent.includes('onClick={handleLogoClick}'),
    'GlobalSidebar Cortex logo Link must invoke handleLogoClick'
  );

  // Verify PATCH /api/v1/projects/[id]/files/[fileId] rejects name: "." with HTTP 400
  const origAuth = ClassroomAuth.authenticateRequest;
  const origGetProject = projectDb.getProject.bind(projectDb);
  const origGetFile = projectDb.getFile.bind(projectDb);
  try {
    ClassroomAuth.authenticateRequest = async () => ({
      id: 'user-test',
      name: 'Test User',
      email: 'test@cortex.edu',
      passwordHash: '',
      role: 'student',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    projectDb.getProject = async (id: string) => ({
      id,
      ownerId: 'user-test',
      name: 'Test Project',
      description: '',
      language: 'python',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    projectDb.getFile = async (fileId: string) => ({
      id: fileId,
      projectId: 'proj-test',
      name: 'main.py',
      path: '/main.py',
      content: 'print(1)',
      isFolder: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const dotReq = new NextRequest('http://localhost/api/v1/projects/proj-test/files/file-test', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '.' }),
    });
    const dotRes = await patchProjectFile(dotReq, {
      params: Promise.resolve({ id: 'proj-test', fileId: 'file-test' }),
    });
    assert.strictEqual(dotRes.status, 400, 'PATCH file rename with "." must return HTTP 400');
    const dotJson = (await dotRes.json()) as { error?: string };
    assert.strictEqual(dotJson.error, 'Invalid file name', 'PATCH file rename with "." must return Invalid file name');
  } finally {
    ClassroomAuth.authenticateRequest = origAuth;
    projectDb.getProject = origGetProject;
    projectDb.getFile = origGetFile;
  }

  const { getChallengeLanguages, getChallengeStarterTemplate } = await import(
    '../src/lib/challenges/language-templates'
  );
  const { getStarterContentForFile, isUntouchedStarterCode } = await import('../src/hooks/useIdeFiles');
  const { getLanguageConfig } = await import('../src/config/languages');

  const dsaLangs = getChallengeLanguages(twoSumProblem!);
  assert.ok(dsaLangs.length >= 20, `DSA challenges must expose 20+ languages, got ${dsaLangs.length}`);
  assert.ok(
    dsaLangs.includes('java') && dsaLangs.includes('rust') && dsaLangs.includes('go') && dsaLangs.includes('scala'),
    'Practice language selector must include Java, Rust, Go, Scala alongside Python/C++/JS'
  );
  assert.strictEqual(
    getChallengeStarterTemplate(twoSumProblem!, 'rust').includes('fn main()'),
    true,
    'Challenge Rust template must include fn main()'
  );
  assert.strictEqual(
    getLanguageConfig('python').version,
    '3.14.0',
    'Python runtime config must use latest 3.14.0'
  );
  assert.strictEqual(
    getLanguageConfig('html').id,
    'html',
    'getLanguageConfig(html) must resolve html rather than falling back to python'
  );
  assert.strictEqual(
    isUntouchedStarterCode(getStarterContentForFile('main.py', getLanguageConfig('python')), 'main.py'),
    true,
    'isUntouchedStarterCode must detect Python starter code'
  );
  assert.strictEqual(
    getStarterContentForFile('solution.cpp', getLanguageConfig('cpp')).includes('#include <iostream>'),
    true,
    '.cpp starter code must contain C++ boilerplate, never Python'
  );
  assert.strictEqual(
    getStarterContentForFile('notes.txt', getLanguageConfig('plaintext')).includes('Python'),
    false,
    '.txt file starter code must not receive Python boilerplate'
  );

  console.log('[PASS] /ide Practice Hub integration and theme support contracts verified');
  console.log('\n======================================================');
  console.log('ALL CORTEX PRACTICE HUB TESTS PASSED!');
  console.log('======================================================');
}

runPracticeHubTests().catch((err) => {
  console.error('[FAIL] Practice Hub test suite failed:', err);
  process.exit(1);
});
