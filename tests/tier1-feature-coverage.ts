import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  TestHarness,
  TierExecutionResult,
  executeCommand,
  parseImportSpecifiers,
} from './test-utils';

export async function runTier1FeatureCoverage(projectRoot = process.cwd()): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 1 - Feature Coverage');

  // Test 1: Lint and TypeScript Typecheck Execution
  harness.startTest('TC1.1 - Lint and TypeScript Typecheck Execution');
  try {
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    harness.assert(fs.existsSync(pkgJsonPath), 'package.json must exist in project root');

    const pkgContent = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    harness.assert(typeof pkgContent.scripts?.lint === 'string', 'package.json must declare a "lint" script');
    harness.assertIncludes(
      pkgContent.scripts.lint,
      'tsc',
      'lint script must execute TypeScript compiler with --noEmit'
    );

    const lintScript = pkgContent.scripts.lint;
    const lintExec = await executeCommand(lintScript, [], { cwd: projectRoot });
    harness.assertEquals(
      lintExec.exitCode,
      0,
      `npm run lint (${lintScript}) must exit with code 0 (stderr: ${lintExec.stderr.slice(0, 200)})`
    );
    harness.assert(
      !lintExec.stderr.includes('error TS'),
      'npm run lint output must not contain TypeScript errors'
    );
    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 2: Production Next.js Build Compilation
  harness.startTest('TC1.2 - Production Next.js Build Compilation');
  try {
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    const pkgContent = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    harness.assert(typeof pkgContent.scripts?.build === 'string', 'package.json must declare a "build" script');

    const nextDir = path.join(projectRoot, '.next');
    const buildIdPath = path.join(nextDir, 'BUILD_ID');
    const buildManifestPath = path.join(nextDir, 'build-manifest.json');

    // If .next is already compiled from clean build, verify the artifacts
    let buildValid = fs.existsSync(buildIdPath) && fs.existsSync(buildManifestPath);
    if (!buildValid) {
      const buildExec = await executeCommand('npm', ['run', 'build'], { cwd: projectRoot, timeoutMs: 300000 });
      harness.assertEquals(buildExec.exitCode, 0, 'npm run build must compile with exit code 0');
      buildValid = fs.existsSync(buildIdPath);
    }

    harness.assert(fs.existsSync(buildIdPath), 'Next.js .next/BUILD_ID artifact must exist');
    const buildId = fs.readFileSync(buildIdPath, 'utf8').trim();
    harness.assert(buildId.length > 0, '.next/BUILD_ID must be a non-empty build identifier');

    harness.assert(
      fs.existsSync(buildManifestPath),
      'Next.js .next/build-manifest.json artifact must exist'
    );
    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 3: Standalone Cortex IDE Route (/ide)
  harness.startTest('TC1.3 - Standalone Cortex IDE Route (/ide)');
  try {
    const idePagePath = path.join(projectRoot, 'src', 'app', 'ide', 'page.tsx');
    harness.assert(fs.existsSync(idePagePath), 'src/app/ide/page.tsx must exist');

    const content = fs.readFileSync(idePagePath, 'utf8');
    harness.assertIncludes(content, "'use client'", 'IDE page must contain "use client" directive');
    harness.assertMatch(
      content,
      /export\s+default\s+function/,
      'IDE page must export default React component function'
    );

    // Verify key IDE subsystems
    harness.assertIncludes(
      content,
      'MonacoCodeEditor',
      'IDE page must import and render MonacoCodeEditor component'
    );
    harness.assertIncludes(
      content,
      'TerminalPanel',
      'IDE page must integrate interactive TerminalPanel'
    );
    harness.assertIncludes(
      content,
      'OutputPanel',
      'IDE page must integrate execution OutputPanel'
    );
    harness.assertIncludes(
      content,
      'SUPPORTED_LANGUAGES',
      'IDE page must support multi-language cloud runtime configurations'
    );

    // Architectural isolation assertion: No academic classroom imports in /ide
    const imports = parseImportSpecifiers(content);
    const hasClassroomImports = imports.some(
      (imp) => imp.includes('/classroom') || imp.includes('/live-class')
    );
    harness.assert(
      !hasClassroomImports,
      'Decoupled IDE route must not import classroom or live lecture modules'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 4: Standalone Cortex Classroom Route (/classroom)
  harness.startTest('TC1.4 - Standalone Cortex Classroom Route (/classroom)');
  try {
    const classroomPagePath = path.join(projectRoot, 'src', 'app', 'classroom', 'page.tsx');
    harness.assert(fs.existsSync(classroomPagePath), 'src/app/classroom/page.tsx must exist');

    const content = fs.readFileSync(classroomPagePath, 'utf8');
    harness.assertIncludes(content, "'use client'", 'Classroom page must contain "use client" directive');
    harness.assertMatch(
      content,
      /export\s+default\s+function/,
      'Classroom page must export default React component function'
    );

    // Check classroom features
    harness.assertMatch(
      content,
      /CortexLogo/,
      'Classroom page must render Cortex brand logo'
    );
    harness.assertMatch(
      content,
      /Course|course|Room|room|Classroom|classroom/,
      'Classroom page must contain academic course and room management logic'
    );

    // Return to IDE link breadcrumb
    harness.assertMatch(
      content,
      /href=["']\/ide["']|href=["']\/["']/,
      'Classroom page must provide return navigation link to IDE or platform root'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 5: Standalone Cortex Lockdown Route (/lockdown)
  harness.startTest('TC1.5 - Standalone Cortex Lockdown Route (/lockdown)');
  try {
    const lockdownPagePath = path.join(projectRoot, 'src', 'app', 'lockdown', 'page.tsx');
    harness.assert(fs.existsSync(lockdownPagePath), 'src/app/lockdown/page.tsx must exist');

    const content = fs.readFileSync(lockdownPagePath, 'utf8');
    harness.assertIncludes(content, "'use client'", 'Lockdown page must contain "use client" directive');
    harness.assertMatch(
      content,
      /export\s+default\s+function/,
      'Lockdown page must export default React component function'
    );

    // Verify placeholder text
    harness.assertMatch(
      content,
      /BUILDING BY TEAM \/\/ COMING SOON|Building by Team \/\/ Coming Soon/i,
      'Lockdown page must display status placeholder banner: "Building by Team // Coming Soon"'
    );

    // Verify security simulation components
    harness.assertIncludes(
      content,
      'WDA_EXCLUDEFROMCAPTURE',
      'Lockdown simulation must demonstrate WDA_EXCLUDEFROMCAPTURE display affinity'
    );
    harness.assertIncludes(
      content,
      'WH_KEYBOARD_LL',
      'Lockdown simulation must demonstrate WH_KEYBOARD_LL low-level keyboard hook suppression'
    );
    harness.assertMatch(
      content,
      /Watchdog|watchdog|WATCHDOG/,
      'Lockdown simulation must demonstrate background process watchdog daemon'
    );
    harness.assertMatch(
      content,
      /10s|10-second|Auto-save|auto-save/i,
      'Lockdown simulation must demonstrate 10s transactional auto-save engine'
    );

    // Subroute links
    harness.assertIncludes(
      content,
      '/lockdown/download',
      'Lockdown page must link to /lockdown/download'
    );
    harness.assertIncludes(
      content,
      '/lockdown/workspace',
      'Lockdown page must link to /lockdown/workspace'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 6: Scrollytelling Showcase Root Route (/) & Modular Landing Components
  harness.startTest('TC1.6 - Scrollytelling Showcase Root Route (/)');
  try {
    const rootPagePath = path.join(projectRoot, 'src', 'app', 'page.tsx');
    harness.assert(fs.existsSync(rootPagePath), 'src/app/page.tsx must exist');

    const landingDir = path.join(projectRoot, 'src', 'components', 'landing');
    const requiredModularComponents = [
      'LandingHeaderNav.tsx',
      'LandingHero.tsx',
      'LandingStickyNav.tsx',
      'IdeProductShowcase.tsx',
      'ClassroomProductShowcase.tsx',
      'LockdownProductShowcase.tsx',
      'TechnicalArchitectureGrid.tsx',
      'LandingFooter.tsx',
    ];

    const landingDirExists = fs.existsSync(landingDir);
    harness.assert(
      landingDirExists,
      'src/components/landing directory must exist for modular showcase components'
    );

    let modularComponentsFound = 0;
    if (landingDirExists) {
      for (const comp of requiredModularComponents) {
        const compPath = path.join(landingDir, comp);
        const exists = fs.existsSync(compPath);
        if (exists) {
          modularComponentsFound++;
          const compContent = fs.readFileSync(compPath, 'utf8');
          harness.assert(
            compContent.length > 50,
            `Landing component ${comp} must contain substantive implementation`
          );
        }
      }
    }

    harness.assertGreaterThanOrEqual(
      modularComponentsFound,
      requiredModularComponents.length,
      `All 8 modular landing components must exist (found ${modularComponentsFound}/${requiredModularComponents.length})`
    );

    const rootContent = fs.readFileSync(rootPagePath, 'utf8');
    harness.assertIncludes(
      rootContent,
      'LandingHeaderNav',
      'Root page must render LandingHeaderNav'
    );
    harness.assertIncludes(
      rootContent,
      'LandingHero',
      'Root page must render LandingHero'
    );
    harness.assertIncludes(
      rootContent,
      'LandingStickyNav',
      'Root page must render LandingStickyNav'
    );
    harness.assertIncludes(
      rootContent,
      'LandingFooter',
      'Root page must render LandingFooter'
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
  process.argv[1].replace(/\\/g, '/').endsWith('tier1-feature-coverage.ts')
);

if (isDirectExecution) {
  runTier1FeatureCoverage().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
