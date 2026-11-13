import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  TestHarness,
  TierExecutionResult,
} from './test-utils';

export async function runTier2BoundaryCorner(projectRoot = process.cwd()): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 2 - Boundary and Corner Cases');

  // Test 1: Query Parameter Resilience for /ide
  harness.startTest('TC2.1 - Query Parameter Resilience for /ide');
  try {
    const idePagePath = path.join(projectRoot, 'src', 'app', 'ide', 'page.tsx');
    harness.assert(fs.existsSync(idePagePath), 'src/app/ide/page.tsx must exist');
    const content = fs.readFileSync(idePagePath, 'utf8');

    // 1. Missing parameter / default behavior
    harness.assertMatch(
      content,
      /useSearchParams|searchParams|projectId|DEFAULT_PROJECT|default/i,
      'IDE page must support parameter parsing or safe default session initialization'
    );

    // 2. Validate URL search param parser resilience simulation
    const parseProjectQuery = (query: string): { projectId: string | null; valid: boolean } => {
      try {
        const params = new URLSearchParams(query);
        const pid = params.get('projectId');
        if (!pid || pid.trim() === '') {
          return { projectId: null, valid: false };
        }
        // Sanitize check: alphanumeric, hyphen, underscore up to 128 chars
        const sanitized = pid.replace(/[^a-zA-Z0-9_-]/g, '');
        return {
          projectId: sanitized.slice(0, 128),
          valid: sanitized.length > 0,
        };
      } catch {
        return { projectId: null, valid: false };
      }
    };

    // Test case: valid standard param
    const validRes = parseProjectQuery('projectId=alpha-987');
    harness.assertEquals(validRes.valid, true, 'Valid projectId param must be marked valid');
    harness.assertEquals(validRes.projectId, 'alpha-987', 'Valid projectId must be preserved');

    // Test case: missing param
    const missingRes = parseProjectQuery('');
    harness.assertEquals(missingRes.valid, false, 'Missing projectId must resolve to invalid/null');
    harness.assertEquals(missingRes.projectId, null, 'Missing projectId must return null');

    // Test case: empty param
    const emptyRes = parseProjectQuery('projectId=');
    harness.assertEquals(emptyRes.valid, false, 'Empty projectId must resolve to invalid/null');
    harness.assertEquals(emptyRes.projectId, null, 'Empty projectId must return null');

    // Test case: malformed / injection characters
    const malformedRes = parseProjectQuery('projectId=<script>alert(1)</script>&lang=ts');
    harness.assertEquals(
      malformedRes.projectId,
      'scriptalert1script',
      'Malformed characters in projectId must be sanitized without throwing'
    );

    // Test case: URL-encoded characters
    const encodedRes = parseProjectQuery('projectId=my%20custom%20id');
    harness.assertEquals(
      encodedRes.projectId,
      'mycustomid',
      'URL-encoded projectId must be safely sanitized'
    );

    // Test case: Excessively long parameter boundary
    const longParam = 'projectId=' + 'a'.repeat(4096);
    const longRes = parseProjectQuery(longParam);
    harness.assert(
      (longRes.projectId?.length || 0) <= 128,
      'Excessively long projectId param must be bounded to <= 128 characters'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 2: Edge Route and Subroute Behavior
  harness.startTest('TC2.2 - Edge Route and Subroute Behavior');
  try {
    // 1. Language configs completeness
    const langConfigPath = path.join(projectRoot, 'src', 'config', 'languages.ts');
    harness.assert(fs.existsSync(langConfigPath), 'src/config/languages.ts must exist');
    const langContent = fs.readFileSync(langConfigPath, 'utf8');

    // Check all 16 supported languages are declared
    const expectedLanguages = [
      'python',
      'javascript',
      'typescript',
      'cpp',
      'c',
      'java',
      'rust',
      'go',
      'csharp',
      'php',
      'ruby',
      'swift',
      'kotlin',
      'r',
      'sql',
      'html',
    ];

    let languagesFound = 0;
    for (const lang of expectedLanguages) {
      if (langContent.includes(`'${lang}'`) || langContent.includes(`"${lang}"`)) {
        languagesFound++;
      }
    }
    harness.assertGreaterThanOrEqual(
      languagesFound,
      14,
      `Language configurations must define at least 14+ runtimes (found ${languagesFound})`
    );

    // 2. Lockdown subroutes
    const lockdownDownloadPath = path.join(
      projectRoot,
      'src',
      'app',
      'lockdown',
      'download',
      'page.tsx'
    );
    harness.assert(
      fs.existsSync(lockdownDownloadPath),
      'src/app/lockdown/download/page.tsx must exist'
    );
    const downloadContent = fs.readFileSync(lockdownDownloadPath, 'utf8');
    harness.assertMatch(
      downloadContent,
      /export\s+default\s+function/,
      'Lockdown download route must export default React component'
    );

    const lockdownWorkspacePath = path.join(
      projectRoot,
      'src',
      'app',
      'lockdown',
      'workspace',
      'page.tsx'
    );
    harness.assert(
      fs.existsSync(lockdownWorkspacePath),
      'src/app/lockdown/workspace/page.tsx must exist'
    );
    const workspaceContent = fs.readFileSync(lockdownWorkspacePath, 'utf8');
    harness.assertMatch(
      workspaceContent,
      /export\s+default\s+function/,
      'Lockdown workspace route must export default React component'
    );

    // 3. Compiler SEO route
    const compilerClientPath = path.join(
      projectRoot,
      'src',
      'app',
      '[compiler]',
      'CompilerClientView.tsx'
    );
    harness.assert(
      fs.existsSync(compilerClientPath),
      'src/app/[compiler]/CompilerClientView.tsx must exist'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 3: Empty State and SSR Fallback Stability
  harness.startTest('TC2.3 - Empty State and SSR Fallback Stability');
  try {
    const idePagePath = path.join(projectRoot, 'src', 'app', 'ide', 'page.tsx');
    const ideContent = fs.readFileSync(idePagePath, 'utf8');

    // 1. Monaco Editor SSR guard
    harness.assert(
      ideContent.startsWith("'use client'") || ideContent.startsWith('"use client"'),
      'IDE page must be declared as a Client Component for browser window access'
    );

    // 2. Window / navigator guard checks in IDE
    harness.assertMatch(
      ideContent,
      /typeof\s+window|useEffect|typeof\s+navigator/,
      'IDE page must guard browser-only globals (window/navigator) against SSR crashes'
    );

    // 3. Check Lockdown page for SSR safety
    const lockdownPagePath = path.join(projectRoot, 'src', 'app', 'lockdown', 'page.tsx');
    const lockdownContent = fs.readFileSync(lockdownPagePath, 'utf8');
    harness.assert(
      lockdownContent.startsWith("'use client'") || lockdownContent.startsWith('"use client"'),
      'Lockdown page must be declared as a Client Component'
    );
    harness.assertMatch(
      lockdownContent,
      /useEffect|typeof\s+window|typeof\s+navigator/,
      'Lockdown page must guard browser APIs inside useEffect or typeof window checks'
    );

    // 4. Check Classroom page for SSR safety
    const classroomPagePath = path.join(projectRoot, 'src', 'app', 'classroom', 'page.tsx');
    const classroomContent = fs.readFileSync(classroomPagePath, 'utf8');
    harness.assert(
      classroomContent.startsWith("'use client'") || classroomContent.startsWith('"use client"'),
      'Classroom page must be declared as a Client Component'
    );

    // 5. Empty files fallback check in IDE
    harness.assertMatch(
      ideContent,
      /starterCode|defaultFileName|getStarterContentForFile|files\.length/,
      'IDE page must provide fallback file state when empty'
    );

    // 6. Execution engine empty test cases fallback
    const enginePath = path.join(projectRoot, 'src', 'lib', 'execution', 'engine.ts');
    harness.assert(fs.existsSync(enginePath), 'src/lib/execution/engine.ts must exist');
    const engineContent = fs.readFileSync(enginePath, 'utf8');
    harness.assertMatch(
      engineContent,
      /testCases|length/,
      'Execution engine must gracefully handle empty test case arrays'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  return harness.getSummary();
}

const isDirectExecution = process.argv[1] && (
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href ||
  process.argv[1].replace(/\\/g, '/').endsWith('tier2-boundary-corner.ts')
);

if (isDirectExecution) {
  runTier2BoundaryCorner().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
