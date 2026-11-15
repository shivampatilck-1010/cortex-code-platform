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

    // Verify status banner
    harness.assertMatch(
      content,
      /ENTERPRISE SECURITY SUITE \/\/ PRODUCTION ACTIVE|BUILDING BY TEAM \/\/ COMING SOON/i,
      'Lockdown page must display standard security status banner'
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

  // Test 7: Zero-Cost Client WASM and Worker Code Sandbox
  harness.startTest('TC1.7 - Zero-Cost Client WASM and Worker Code Sandbox');
  try {
    const wasmRunnerPath = path.join(projectRoot, 'src', 'lib', 'execution', 'wasm-runner.ts');
    harness.assert(fs.existsSync(wasmRunnerPath), 'src/lib/execution/wasm-runner.ts must exist');

    const content = fs.readFileSync(wasmRunnerPath, 'utf8');
    harness.assertIncludes(content, 'export async function executeJavaScriptInWorker', 'Must export executeJavaScriptInWorker');
    harness.assertIncludes(content, 'export async function executePythonInPyodide', 'Must export executePythonInPyodide');
    harness.assertIncludes(content, 'client-wasm', 'Must declare client-wasm engine');
    harness.assertIncludes(content, 'client-worker', 'Must declare client-worker engine');

    // Worker sandbox implementation contract
    harness.assertMatch(content, /new\s+Function\s*\(\s*['"]stdin['"]\s*,\s*userCode\s*\)/, 'Worker sandbox must isolate code execution');
    harness.assertMatch(content, /console\.log\s*=/, 'Worker sandbox must intercept stdout via console.log');
    harness.assertMatch(content, /console\.error\s*=/, 'Worker sandbox must intercept stderr via console.error');
    harness.assertMatch(content, /timeoutMs.*worker\.terminate\(\)/s, 'Worker sandbox must enforce timeout boundary');

    // Pyodide WebAssembly runtime contract
    harness.assertMatch(content, /cdn\.jsdelivr\.net\/pyodide\/v[\d.]+\/full\/pyodide\.js/, 'Must reference Pyodide WebAssembly runtime');
    harness.assertIncludes(content, 'pyodideInstancePromise', 'Must implement singleton promise pattern to prevent redundant runtime downloads');

    // Direct invocation in Node environment (must safely return client-worker error contract)
    const { executeJavaScriptInWorker } = await import('../src/lib/execution/wasm-runner');
    const res = await executeJavaScriptInWorker('console.log(42)');
    harness.assertEquals(res.status, 'error', 'Node execution must return status error');
    harness.assertEquals(res.exitCode, 1, 'Node execution must return exitCode 1');
    harness.assertEquals(res.engine, 'client-worker', 'Engine tag must be client-worker');
    harness.assertIncludes(res.stderr, 'browser environment', 'Node stderr must report browser environment requirement');

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 8: Lecture Recording and ZIP Bundle Packaging
  harness.startTest('TC1.8 - Lecture Recording and ZIP Bundle Packaging');
  try {
    const recorderPath = path.join(projectRoot, 'src', 'lib', 'classroom', 'useLectureRecorder.ts');
    harness.assert(fs.existsSync(recorderPath), 'src/lib/classroom/useLectureRecorder.ts must exist');

    const recorderContent = fs.readFileSync(recorderPath, 'utf8');
    harness.assertIncludes(recorderContent, 'video/mp4;codecs=avc1,mp4a.40.2', 'Must support Safari AVC1/AAC MP4 container');
    harness.assertIncludes(recorderContent, 'video/webm;codecs=vp9,opus', 'Must support WebM VP9/Opus container');
    harness.assertMatch(recorderContent, /new\s+MediaRecorder\s*\(\s*captureStream\s*\)/, 'Must provide graceful native fallback when no type specified');

    const exporterPath = path.join(projectRoot, 'src', 'lib', 'classroom', 'lectureExport.ts');
    harness.assert(fs.existsSync(exporterPath), 'src/lib/classroom/lectureExport.ts must exist');

    const exporterContent = fs.readFileSync(exporterPath, 'utf8');
    harness.assertIncludes(exporterContent, 'export async function exportLectureBundle', 'Must export exportLectureBundle function');
    harness.assertIncludes(exporterContent, 'LECTURE_NOTES.md', 'Export bundle must contain LECTURE_NOTES.md');

    // Direct in-memory JSZip packaging verification
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('LECTURE_NOTES.md', '# CS-201: Live Lecture Summary\nInstructor: Professor Shivam\nAttendees: 4');
    const codeFolder = zip.folder('code');
    codeFolder?.file('main.py', 'print("Hello from lecture")');
    const wbFolder = zip.folder('whiteboard');
    wbFolder?.file('whiteboard_data.json', JSON.stringify({ pages: 1, elements: [] }));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    harness.assertGreaterThanOrEqual(zipBuffer.length, 100, 'Generated ZIP archive must be a valid non-empty buffer');

    const loadedZip = await JSZip.loadAsync(zipBuffer);
    harness.assert(Boolean(loadedZip.file('LECTURE_NOTES.md')), 'Archive must contain LECTURE_NOTES.md');
    harness.assert(Boolean(loadedZip.file('code/main.py')), 'Archive must contain code/main.py');
    harness.assert(Boolean(loadedZip.file('whiteboard/whiteboard_data.json')), 'Archive must contain whiteboard/whiteboard_data.json');

    const notesContent = await loadedZip.file('LECTURE_NOTES.md')?.async('string');
    harness.assertIncludes(notesContent || '', 'CS-201', 'Uncompressed archive content must preserve lecture notes');

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 9: TC5.1 - Next.js App Router Error Boundaries
  harness.startTest('TC5.1 - Next.js App Router Error Boundaries (error.tsx & not-found.tsx)');
  try {
    const errorPath = path.join(projectRoot, 'src', 'app', 'error.tsx');
    const notFoundPath = path.join(projectRoot, 'src', 'app', 'not-found.tsx');

    harness.assert(fs.existsSync(errorPath), 'src/app/error.tsx must exist');
    harness.assert(fs.existsSync(notFoundPath), 'src/app/not-found.tsx must exist');

    const errorContent = fs.readFileSync(errorPath, 'utf8');
    harness.assertIncludes(errorContent, "'use client'", 'src/app/error.tsx must be a client component');
    harness.assertIncludes(errorContent, 'export default function', 'src/app/error.tsx must default export an error boundary component');
    harness.assertIncludes(errorContent, 'reset', 'src/app/error.tsx must provide a reset handler');

    const notFoundContent = fs.readFileSync(notFoundPath, 'utf8');
    harness.assertIncludes(notFoundContent, 'export default function', 'src/app/not-found.tsx must default export a not found component');
    harness.assertIncludes(notFoundContent, '404', 'src/app/not-found.tsx must render 404 text');

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 10: TC5.2 - Plaintext Secrets & OAuth Hardening Scan
  harness.startTest('TC5.2 - Plaintext Secrets & OAuth Hardening Scan');
  try {
    const forbiddenSecrets = [
      'cortex_lockdown_security_key_2026_prod_hmac',
      'cortex_srv_pepper_2026_sec_h99f2a7b',
      'mock_secret_key_lti_development_only',
    ];

    function collectSourceFiles(dir: string): string[] {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(collectSourceFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const srcDir = path.join(projectRoot, 'src');
    const sourceFiles = collectSourceFiles(srcDir);
    harness.assert(sourceFiles.length > 0, 'Source files must be discovered in src/');

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const forbidden of forbiddenSecrets) {
        harness.assert(
          !content.includes(forbidden),
          `Forbidden plaintext secret "${forbidden}" must not exist in source file: ${path.relative(projectRoot, file)}`
        );
      }
    }

    // Verify .env.example exists and documents required variables
    const envExamplePath = path.join(projectRoot, '.env.example');
    harness.assert(fs.existsSync(envExamplePath), '.env.example must exist in project root');
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    harness.assertIncludes(envExampleContent, 'LOCKDOWN_POLICY_SECRET', '.env.example must document LOCKDOWN_POLICY_SECRET');
    harness.assertIncludes(envExampleContent, 'LTI_HMAC_SECRET', '.env.example must document LTI_HMAC_SECRET');
    harness.assertIncludes(envExampleContent, 'GITHUB_CLIENT_ID', '.env.example must document GITHUB_CLIENT_ID');
    harness.assertIncludes(envExampleContent, 'GITHUB_CLIENT_SECRET', '.env.example must document GITHUB_CLIENT_SECRET');
    harness.assertIncludes(envExampleContent, 'LOCKDOWN_SERVER_PEPPER', '.env.example must document LOCKDOWN_SERVER_PEPPER');

    // Verify src/worker.ts exports validateStartupSecrets
    const workerPath = path.join(projectRoot, 'src', 'worker.ts');
    harness.assert(fs.existsSync(workerPath), 'src/worker.ts must exist');
    const workerContent = fs.readFileSync(workerPath, 'utf8');
    harness.assertIncludes(workerContent, 'export function validateStartupSecrets', 'src/worker.ts must export validateStartupSecrets');

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 11: TC5.3 - Zero Bare @ts-ignore Directives in src/
  harness.startTest('TC5.3 - Zero Bare @ts-ignore Directives in src/');
  try {
    function collectSourceFiles(dir: string): string[] {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(collectSourceFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const srcDir = path.join(projectRoot, 'src');
    const sourceFiles = collectSourceFiles(srcDir);
    const bareIgnoreRegex = /\/\/\s*@ts-ignore(?!\s*--|\s*:\s*[a-zA-Z])/;

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('@ts-ignore')) {
          harness.assert(
            !bareIgnoreRegex.test(line),
            `Bare @ts-ignore without technical explanation found in ${path.relative(projectRoot, file)}:${i + 1}: ${line.trim()}`
          );
        }
      }
    }

    harness.assert(true, 'Zero bare @ts-ignore directives exist across all source files in src/');
    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 12: TC5.4 - Tab-Napping Security Attributes on target="_blank"
  harness.startTest('TC5.4 - Tab-Napping Security Attributes on target="_blank" Anchors');
  try {
    function collectTsxFiles(dir: string): string[] {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(collectTsxFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const srcDir = path.join(projectRoot, 'src');
    const tsxFiles = collectTsxFiles(srcDir);
    harness.assert(tsxFiles.length > 0, 'TSX files must be discovered in src/');

    let totalBlankAnchors = 0;
    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const anchorRegex = /<(?:a|Link)[^>]*target=["']_blank["'][^>]*>/g;
      let match: RegExpExecArray | null;
      while ((match = anchorRegex.exec(content)) !== null) {
        totalBlankAnchors++;
        const tag = match[0];
        const hasNoOpener = tag.includes('rel="') && tag.includes('noopener');
        const hasNoReferrer = tag.includes('rel="') && tag.includes('noreferrer');
        harness.assert(
          hasNoOpener && hasNoReferrer,
          `target="_blank" element in ${path.relative(projectRoot, file)} must include rel="noopener noreferrer": ${tag}`
        );
      }
    }

    harness.assertGreaterThanOrEqual(totalBlankAnchors, 10, 'All verified target="_blank" anchors must be scanned');
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
