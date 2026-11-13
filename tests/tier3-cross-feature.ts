import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  TestHarness,
  TierExecutionResult,
  parseImportSpecifiers,
} from './test-utils';

export async function runTier3CrossFeature(projectRoot = process.cwd()): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 3 - Cross-Feature Combinations');

  // Test 1: Cross-Navigation Link Integrity Across Suites
  harness.startTest('TC3.1 - Cross-Navigation Link Integrity Across Suites');
  try {
    // 1. Global Navbar Navigation
    const navbarPath = path.join(projectRoot, 'src', 'components', 'layout', 'Navbar.tsx');
    harness.assert(fs.existsSync(navbarPath), 'src/components/layout/Navbar.tsx must exist');
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');

    harness.assertMatch(
      navbarContent,
      /href=["']\/["']/,
      'Navbar must contain navigation link to platform root (/)'
    );
    harness.assertMatch(
      navbarContent,
      /href=["']\/ide["']/,
      'Navbar must contain navigation link to standalone IDE (/ide)'
    );
    harness.assertMatch(
      navbarContent,
      /href=["']\/classroom["']/,
      'Navbar must contain navigation link to standalone Classroom (/classroom)'
    );
    harness.assertMatch(
      navbarContent,
      /href=["']\/lockdown["']/,
      'Navbar must contain navigation link to standalone Lockdown Browser (/lockdown)'
    );

    // 2. Compiler Client View Navigation
    const compilerClientPath = path.join(
      projectRoot,
      'src',
      'app',
      '[compiler]',
      'CompilerClientView.tsx'
    );
    harness.assert(fs.existsSync(compilerClientPath), 'CompilerClientView.tsx must exist');
    const compilerContent = fs.readFileSync(compilerClientPath, 'utf8');

    harness.assertMatch(
      compilerContent,
      /href=["']\/ide["']/,
      'Compiler view must contain direct action link to Open Full Cloud IDE (/ide)'
    );
    harness.assertMatch(
      compilerContent,
      /href=["']\/["']/,
      'Compiler view must contain return link to brand root (/)'
    );

    // 3. Classroom Suite Return Navigation
    const classroomPath = path.join(projectRoot, 'src', 'app', 'classroom', 'page.tsx');
    harness.assert(fs.existsSync(classroomPath), 'src/app/classroom/page.tsx must exist');
    const classroomContent = fs.readFileSync(classroomPath, 'utf8');

    harness.assertMatch(
      classroomContent,
      /href=["']\/ide["']|href=["']\/["']/,
      'Classroom suite must provide breadcrumb/navigation back to IDE (/ide) or platform root (/)'
    );

    // 4. Lockdown Suite Cross-Navigation
    const lockdownPath = path.join(projectRoot, 'src', 'app', 'lockdown', 'page.tsx');
    harness.assert(fs.existsSync(lockdownPath), 'src/app/lockdown/page.tsx must exist');
    const lockdownContent = fs.readFileSync(lockdownPath, 'utf8');

    harness.assertMatch(
      lockdownContent,
      /href=["']\/lockdown\/download["']/,
      'Lockdown suite must link to /lockdown/download'
    );
    harness.assertMatch(
      lockdownContent,
      /href=["']\/lockdown\/workspace["']/,
      'Lockdown suite must link to /lockdown/workspace'
    );
    harness.assertMatch(
      lockdownContent,
      /href=["']\/ide["']/,
      'Lockdown suite must link to Cloud IDE (/ide)'
    );
    harness.assertMatch(
      lockdownContent,
      /href=["']\/classroom["']/,
      'Lockdown suite must link to Classroom suite (/classroom)'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 2: Decoupled Architecture & Forbidden Cross-Dependency Enforcement
  harness.startTest('TC3.2 - Decoupled Architecture & Forbidden Cross-Dependencies');
  try {
    // 1. /ide isolation check
    const idePath = path.join(projectRoot, 'src', 'app', 'ide', 'page.tsx');
    harness.assert(fs.existsSync(idePath), 'src/app/ide/page.tsx must exist');
    const ideContent = fs.readFileSync(idePath, 'utf8');
    const ideImports = parseImportSpecifiers(ideContent);

    const ideForbiddenImports = ideImports.filter(
      (imp) =>
        imp.includes('/components/classroom') ||
        imp.includes('/components/live-class') ||
        imp.includes('useClassroomLiveSession')
    );
    harness.assertEquals(
      ideForbiddenImports.length,
      0,
      `IDE route must not import classroom/live-class dependencies (found: ${ideForbiddenImports.join(', ')})`
    );

    // 2. /lockdown isolation check
    const lockdownPath = path.join(projectRoot, 'src', 'app', 'lockdown', 'page.tsx');
    const lockdownContent = fs.readFileSync(lockdownPath, 'utf8');
    const lockdownImports = parseImportSpecifiers(lockdownContent);

    const lockdownForbiddenImports = lockdownImports.filter(
      (imp) =>
        imp.includes('@monaco-editor/react') ||
        imp.includes('monaco-editor') ||
        imp.includes('/components/editor/')
    );
    harness.assertEquals(
      lockdownForbiddenImports.length,
      0,
      `Lockdown route must not import heavy Monaco editor dependencies (found: ${lockdownForbiddenImports.join(', ')})`
    );

    // 3. /classroom isolation check
    const classroomPath = path.join(projectRoot, 'src', 'app', 'classroom', 'page.tsx');
    const classroomContent = fs.readFileSync(classroomPath, 'utf8');
    const classroomImports = parseImportSpecifiers(classroomContent);

    const classroomForbiddenImports = classroomImports.filter(
      (imp) => imp.includes('KeyboardHook') || imp.includes('DisplayAffinity')
    );
    harness.assertEquals(
      classroomForbiddenImports.length,
      0,
      `Classroom route must not import native lockdown hooks (found: ${classroomForbiddenImports.join(', ')})`
    );

    // 4. Pairwise product isolation verification
    harness.assert(
      !ideContent.includes('WH_KEYBOARD_LL'),
      'IDE must not include low-level lockdown keyboard hook simulation'
    );
    harness.assert(
      !classroomContent.includes('WDA_EXCLUDEFROMCAPTURE'),
      'Classroom must not include win32 display affinity simulation'
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
  process.argv[1].replace(/\\/g, '/').endsWith('tier3-cross-feature.ts')
);

if (isDirectExecution) {
  runTier3CrossFeature().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
