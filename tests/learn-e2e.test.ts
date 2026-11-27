import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  TestHarness,
  TierExecutionResult,
  detectEmojisInText,
  findFilesRecursively,
  parseImportSpecifiers,
} from './test-utils';
import {
  LEARN_E2E_MATRIX,
  validateMatrixCompleteness,
} from './learn-e2e/test-matrix';
import {
  fetchRouteHtml,
  getCortexBaseUrl,
  isValidHttpUrl,
  probeServerReachable,
} from './learn-e2e/http-client';
import { probePlaywrightAvailability } from './learn-e2e/playwright-loader';

interface CliOptions {
  dryRun: boolean;
  tierFilter?: number;
  filter?: string;
  verbose: boolean;
  json: boolean;
}

class PendingSkipError extends Error {
  public readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'PendingSkipError';
    this.reason = reason;
  }
}

function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    verbose: false,
    json: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '--structure') {
      opts.dryRun = true;
    } else if (arg.startsWith('--tier=')) {
      const parsed = parseInt(arg.slice('--tier='.length), 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 4) {
        opts.tierFilter = parsed;
      }
    } else if (arg.startsWith('--filter=')) {
      opts.filter = arg.slice('--filter='.length).trim().toLowerCase();
    } else if (arg === '--verbose' || arg === '-v') {
      opts.verbose = true;
    } else if (arg === '--json') {
      opts.json = true;
    }
  }

  return opts;
}

async function runCase(
  harness: TestHarness,
  name: string,
  fn: () => Promise<void> | void
): Promise<void> {
  harness.startTest(name);
  try {
    await fn();
    harness.endTest('passed');
  } catch (err: unknown) {
    if (err instanceof PendingSkipError) {
      harness.endTest('skipped', err.reason);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith('Assertion failed:')) {
      try {
        harness.assert(false, `Unexpected error: ${msg}`);
      } catch {
        // Error recorded on currentTest inside assert()
      }
    }
    // Omit 2nd arg on failed tests to avoid TestHarness appending [SKIP] Reason
    harness.endTest('failed');
  }
}

function collectLearnAndTestFiles(projectRoot: string): string[] {
  const targets: string[] = [];
  const candidates = [
    path.join(projectRoot, 'tests', 'learn-e2e.test.ts'),
    path.join(projectRoot, 'tests', 'learn-browser-e2e.ts'),
    path.join(projectRoot, 'tests', 'learn-data.test.ts'),
    path.join(projectRoot, 'src', 'types', 'learn.ts'),
    path.join(projectRoot, 'src', 'hooks', 'useCortexTheme.ts'),
    path.join(projectRoot, 'src', 'hooks', 'useLearnProgress.ts'),
    path.join(projectRoot, 'src', 'components', 'sidebar', 'LearnSidebar.tsx'),
    path.join(projectRoot, 'src', 'components', 'layout', 'GlobalSidebar.tsx'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      targets.push(filePath);
    }
  }

  const dirs = [
    path.join(projectRoot, 'tests', 'learn-e2e'),
    path.join(projectRoot, 'src', 'data', 'courses'),
    path.join(projectRoot, 'src', 'components', 'learn'),
    path.join(projectRoot, 'src', 'app', 'learn'),
  ];

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      const found = findFilesRecursively(dir, (f) => /\.(ts|tsx|js|jsx|md|json)$/i.test(f));
      targets.push(...found);
    }
  }

  return Array.from(new Set(targets));
}

function shouldRunCheck(checkTier: number, checkName: string, opts: CliOptions): boolean {
  if (opts.tierFilter && opts.tierFilter !== checkTier) {
    return false;
  }
  if (opts.filter && !checkName.toLowerCase().includes(opts.filter)) {
    return false;
  }
  return true;
}

interface CourseLike {
  id: string;
  slug: string;
  title: string;
  track: string;
  level: string;
  description: string;
  estimatedHours: number;
  attribution?: { sourceName?: string; license?: string; sourceUrl?: string };
  modules: Array<{
    id: string;
    title: string;
    summary: string;
    items: Array<{
      id: string;
      type: string;
      title: string;
      passScore?: number;
      durationMins?: number;
      ideProblemId?: string;
      language?: string;
      starterCode?: string;
      steps?: string[];
      questions?: Array<{
        id: string;
        prompt: string;
        options: string[];
        correctIndex: number;
        explanation: string;
      }>;
    }>;
  }>;
}

interface CoursesModuleLike {
  COURSES?: CourseLike[];
  COURSE_TRACKS?: readonly string[];
  getCourseByIdOrSlug?: (idOrSlug: string) => CourseLike | undefined;
  findLessonInCourse?: (course: CourseLike, lessonId: string) => unknown;
  flattenCourseLessons?: (course: CourseLike) => unknown[];
  getCourseStats?: (course: CourseLike) => {
    moduleCount: number;
    notesCount: number;
    quizCount: number;
    labCount: number;
    examCount: number;
    totalItems: number;
  };
}

export async function runLearnContractAndHttpSuite(
  projectRoot = process.cwd(),
  opts: CliOptions
): Promise<TierExecutionResult> {
  const harness = new TestHarness('Learn E2E - Contracts, Governance & Live HTTP');
  const baseUrl = getCortexBaseUrl();

  let discoveredCourseSlug = 'python-dsa';
  let discoveredTwoSumLabId = '';

  // 1. Matrix Completeness & Canonical Coverage
  const c1Name = '[Tier 4 / Matrix] Canonical 91-Test Matrix Completeness & F1-F7 Thresholds';
  if (shouldRunCheck(4, c1Name, opts)) {
    await runCase(harness, c1Name, () => {
      const validation = validateMatrixCompleteness(LEARN_E2E_MATRIX);
      harness.assert(
        validation.valid,
        `Matrix validation failed: ${validation.errors.join('; ')}`
      );
      harness.assertEquals(validation.total, 91, 'Total matrix tests should equal 91');
      harness.assertEquals(validation.tierCounts[1], 39, 'Tier 1 should have 39 tests');
      harness.assertEquals(validation.tierCounts[2], 37, 'Tier 2 should have 37 tests');
      harness.assertEquals(validation.tierCounts[3], 9, 'Tier 3 should have 9 tests');
      harness.assertEquals(validation.tierCounts[4], 6, 'Tier 4 should have 6 tests');
    });
  }

  // 2. Environment & Playwright Discovery Probe
  const c2Name = '[Tier 4 / Infra] Base URL & Dynamic Playwright/Chromium Discovery';
  if (shouldRunCheck(4, c2Name, opts)) {
    await runCase(harness, c2Name, () => {
      harness.assert(isValidHttpUrl(baseUrl), `CORTEX_BASE_URL must be valid HTTP(S) URL: ${baseUrl}`);
      const pwProbe = probePlaywrightAvailability();
      if (opts.dryRun && !pwProbe.playwrightFound) {
        throw new PendingSkipError(`Playwright not resolved in dry-run (${pwProbe.errors.join('; ')})`);
      }
      harness.assert(
        pwProbe.playwrightFound,
        `Playwright dynamic resolution failed: ${pwProbe.errors.join(' | ')}`
      );
      harness.assert(
        pwProbe.chromiumFound,
        'Chromium executable not found via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, ms-playwright, or system Chrome'
      );
    });
  }

  // 3. TC4.1 Zero-Emoji Self-Audit
  const c3Name = '[Tier 4 / TC4.1] Zero-Emoji Governance Across Learn & Test Files';
  if (shouldRunCheck(4, c3Name, opts)) {
    await runCase(harness, c3Name, () => {
      const files = collectLearnAndTestFiles(projectRoot);
      harness.assertGreaterThanOrEqual(files.length, 5, 'Should scan at least the 5 Learn E2E test files');
      const violations: string[] = [];
      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const found = detectEmojisInText(content, path.relative(projectRoot, filePath));
        for (const v of found) {
          violations.push(`${v.filePath}:${v.line}:${v.column} (${v.codePoint})`);
        }
      }
      harness.assertEquals(
        violations.length,
        0,
        `Detected Unicode emojis in Learn/test files: ${violations.join(', ')}`
      );
    });
  }

  // 4. Static Test Hygiene (No bare @ts-ignore, no static playwright imports)
  const c4Name = '[Tier 4 / TC5.3] Static Hygiene: No Bare @ts-ignore or Static Playwright Imports';
  if (shouldRunCheck(4, c4Name, opts)) {
    await runCase(harness, c4Name, () => {
      const testFiles = [
        path.join(projectRoot, 'tests', 'learn-e2e.test.ts'),
        path.join(projectRoot, 'tests', 'learn-browser-e2e.ts'),
        ...findFilesRecursively(path.join(projectRoot, 'tests', 'learn-e2e'), (f) => f.endsWith('.ts')),
      ].filter((f) => fs.existsSync(f));

      harness.assertEquals(testFiles.length, 5, 'All 5 owned Learn E2E files should exist');

      for (const filePath of testFiles) {
        const src = fs.readFileSync(filePath, 'utf-8');
        const rel = path.relative(projectRoot, filePath);
        const specs = parseImportSpecifiers(src);
        harness.assert(
          !specs.includes('playwright') && !specs.includes('playwright-core') && !specs.includes('@playwright/test'),
          `${rel} must NOT statically import playwright/playwright-core`
        );
        const tsIgnoreRegex = new RegExp('//\\s*@' + 'ts-ignore\\b');
        const lines = src.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (tsIgnoreRegex.test(lines[i])) {
            harness.assert(false, `${rel}:${i + 1} contains disallowed @ts-ignore`);
          }
        }
      }
    });
  }

  // 5. M1 Curriculum Schema & Seeded Courses Contract Audit
  const c5Name = '[Tier 1 / F1-F5] Curriculum Schema, 3 Seeded Courses & Two Sum Lab Contract';
  if (shouldRunCheck(1, c5Name, opts)) {
    await runCase(harness, c5Name, async () => {
      const typesPath = path.join(projectRoot, 'src', 'types', 'learn.ts');
      const coursesIndexPath = path.join(projectRoot, 'src', 'data', 'courses', 'index.ts');
      const themeHookPath = path.join(projectRoot, 'src', 'hooks', 'useCortexTheme.ts');
      const progressHookPath = path.join(projectRoot, 'src', 'hooks', 'useLearnProgress.ts');

      const missing = [typesPath, coursesIndexPath, themeHookPath, progressHookPath].filter(
        (p) => !fs.existsSync(p)
      );

      if (missing.length > 0) {
        const relMissing = missing.map((m) => path.relative(projectRoot, m)).join(', ');
        if (opts.dryRun) {
          throw new PendingSkipError(`M1 files not yet built: ${relMissing}`);
        }
        harness.assert(false, `Missing required M1 files: ${relMissing}`);
      }

      const mod = (await import(pathToFileURL(coursesIndexPath).href)) as CoursesModuleLike;
      const courses = mod.COURSES || [];
      const tracks = mod.COURSE_TRACKS || [];

      harness.assertGreaterThanOrEqual(courses.length, 3, 'COURSES must seed at least 3 courses');
      for (const requiredTrack of ['All Tracks', 'Python & DSA', 'Systems & C++', 'SQL & Data', 'AI & ML']) {
        harness.assertIncludes([...tracks], requiredTrack, `COURSE_TRACKS must include ${requiredTrack}`);
      }

      harness.assert(typeof mod.getCourseByIdOrSlug === 'function', 'getCourseByIdOrSlug helper must be exported');
      harness.assert(typeof mod.findLessonInCourse === 'function', 'findLessonInCourse helper must be exported');
      harness.assert(typeof mod.flattenCourseLessons === 'function', 'flattenCourseLessons helper must be exported');
      harness.assert(typeof mod.getCourseStats === 'function', 'getCourseStats helper must be exported');

      const pythonCourse = courses.find(
        (c) => /python/i.test(c.id) || /python/i.test(c.slug) || c.track === 'Python & DSA'
      );
      const cppCourse = courses.find(
        (c) => /cpp|c\+\+/i.test(c.id) || c.track === 'Systems & C++'
      );
      const sqlCourse = courses.find(
        (c) => /sql/i.test(c.id) || c.track === 'SQL & Data'
      );

      harness.assert(Boolean(pythonCourse), 'Python & DSA starter course must exist');
      harness.assert(Boolean(cppCourse), 'Systems & C++ starter course must exist');
      harness.assert(Boolean(sqlCourse), 'SQL & Data starter course must exist');

      if (pythonCourse) {
        discoveredCourseSlug = pythonCourse.slug || pythonCourse.id;
        harness.assertGreaterThanOrEqual(
          pythonCourse.modules.length,
          2,
          'Python & DSA course must have at least 2 modules'
        );
        const allItems = pythonCourse.modules.flatMap((m) => m.items);
        const notes = allItems.find((i) => i.type === 'notes');
        const quiz = allItems.find((i) => i.type === 'quiz');
        const twoSumLab = allItems.find(
          (i) => i.type === 'lab' && (i.ideProblemId === 'two-sum' || /two\s*sum/i.test(i.title))
        );
        const exam = allItems.find((i) => i.type === 'exam');

        harness.assert(Boolean(notes), 'Python course must contain a notes lesson');
        harness.assert(Boolean(quiz), 'Python course must contain a quiz lesson');
        harness.assert(
          Boolean(quiz && (quiz.questions?.length ?? 0) >= 4 && typeof quiz.passScore === 'number'),
          'Python quiz must contain >= 4 questions and numeric passScore'
        );
        harness.assert(Boolean(twoSumLab), 'Python course must contain a Two Sum lab');
        if (twoSumLab) {
          discoveredTwoSumLabId = twoSumLab.id;
          harness.assertEquals(twoSumLab.ideProblemId, 'two-sum', 'Two Sum lab must link ideProblemId "two-sum"');
          harness.assertEquals(twoSumLab.language, 'python', 'Two Sum lab must use python language');
          const code = twoSumLab.starterCode || '';
          harness.assert(code.trim().length > 0, 'Two Sum lab starterCode must be non-empty');
          harness.assert(
            !/seen\[diff\]/.test(code),
            'Two Sum starterCode must be an incomplete stub, not pre-filled solution'
          );
        }
        harness.assert(Boolean(exam), 'Python course must contain a timed exam');
        if (exam) {
          harness.assert(
            typeof exam.durationMins === 'number' && exam.durationMins > 0,
            'Exam must define durationMins > 0'
          );
          harness.assert(
            typeof exam.passScore === 'number' && exam.passScore > 0,
            'Exam must define passScore > 0'
          );
          harness.assertGreaterThanOrEqual(
            exam.questions?.length ?? 0,
            3,
            'Exam must contain >= 3 questions'
          );
        }
      }

      for (const course of courses) {
        harness.assert(
          Boolean(course.attribution?.sourceName && course.attribution?.license),
          `Course ${course.id} must define attribution.sourceName and attribution.license`
        );
        const resolvedById = mod.getCourseByIdOrSlug?.(course.id);
        const resolvedBySlug = mod.getCourseByIdOrSlug?.(course.slug);
        harness.assert(Boolean(resolvedById), `getCourseByIdOrSlug(${course.id}) should resolve`);
        harness.assert(Boolean(resolvedBySlug), `getCourseByIdOrSlug(${course.slug}) should resolve`);

        const allCourseItems = course.modules.flatMap((m) => m.items);
        for (const item of allCourseItems) {
          if (item.type === 'quiz' || item.type === 'exam') {
            for (const q of item.questions || []) {
              harness.assert(Boolean(q.prompt), `Question ${q.id} must have a prompt`);
              harness.assertGreaterThanOrEqual(q.options.length, 2, `Question ${q.id} must have >= 2 options`);
              harness.assert(
                q.correctIndex >= 0 && q.correctIndex < q.options.length,
                `Question ${q.id} correctIndex out of range`
              );
              harness.assert(Boolean(q.explanation?.trim()), `Question ${q.id} must include an explanation`);
            }
          }
        }
      }

      if (cppCourse) {
        const cppTypes = new Set(cppCourse.modules.flatMap((m) => m.items.map((i) => i.type)));
        harness.assert(cppTypes.has('notes') && cppTypes.has('quiz') && cppTypes.has('lab'), 'C++ course must include notes, quiz, and lab');
      }
      if (sqlCourse) {
        const sqlTypes = new Set(sqlCourse.modules.flatMap((m) => m.items.map((i) => i.type)));
        harness.assert(sqlTypes.has('notes') && sqlTypes.has('quiz') && sqlTypes.has('lab'), 'SQL course must include notes, quiz, and lab');
      }
    });
  }

  // 6. Live HTTP Route Probes (/learn, /learn/[courseId], /ide, /ide?course=&lesson=, /learn/nonexistent-course)
  const routeChecks = [
    {
      tier: 1,
      name: '[Tier 1 / HTTP] GET /learn returns 200 without Next.js error overlay',
      buildPath: () => '/learn',
      checkLearnV2: true,
      allowedStatuses: [200],
    },
    {
      tier: 1,
      name: '[Tier 1 / HTTP] GET /learn/<courseId> returns 200 without Next.js error overlay',
      buildPath: () => `/learn/${encodeURIComponent(discoveredCourseSlug)}`,
      checkLearnV2: false,
      allowedStatuses: [200],
    },
    {
      tier: 1,
      name: '[Tier 1 / HTTP] GET /ide returns 200 without Next.js error overlay',
      buildPath: () => '/ide',
      checkLearnV2: false,
      allowedStatuses: [200],
    },
    {
      tier: 1,
      name: '[Tier 1 / HTTP] GET /ide?course=...&lesson=... returns 200 without Next.js error overlay',
      buildPath: () =>
        `/ide?course=${encodeURIComponent(discoveredCourseSlug)}&lesson=${encodeURIComponent(
          discoveredTwoSumLabId || 'two-sum-lab'
        )}`,
      checkLearnV2: false,
      allowedStatuses: [200],
    },
    {
      tier: 2,
      name: '[Tier 2 / HTTP] GET /learn/nonexistent-course avoids unhandled crash',
      buildPath: () => '/learn/nonexistent-course',
      checkLearnV2: false,
      allowedStatuses: [200, 404],
    },
  ];

  for (const rc of routeChecks) {
    if (!shouldRunCheck(rc.tier, rc.name, opts)) continue;
    await runCase(harness, rc.name, async () => {
      const probe = await probeServerReachable(baseUrl, 3500);
      if (!probe.reachable) {
        if (opts.dryRun) {
          throw new PendingSkipError(`Server not reachable at ${baseUrl} during dry-run (${probe.error || 'offline'})`);
        }
        harness.assert(false, `Server unreachable at ${baseUrl}: ${probe.error || 'connection refused'}`);
      }

      const routeUrl = `${baseUrl}${rc.buildPath()}`;
      const res = await fetchRouteHtml(routeUrl, 10000);

      if (opts.dryRun && rc.checkLearnV2 && /Learn to Code Entirely Online/i.test(res.html)) {
        throw new PendingSkipError('/learn still serving pre-M2 legacy page during dry-run');
      }

      harness.assert(
        rc.allowedStatuses.includes(res.status),
        `${routeUrl} returned HTTP ${res.status} (expected ${rc.allowedStatuses.join(' or ')}; ${res.error || 'unexpected status'})`
      );
      harness.assertEquals(
        res.crashMarkers.length,
        0,
        `${routeUrl} returned Next.js crash markers: ${res.crashMarkers.join(', ')}`
      );
    });
  }

  return harness.getSummary();
}

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));
  const projectRoot = process.cwd();
  const baseUrl = getCortexBaseUrl();

  console.log('='.repeat(80));
  console.log('CORTEX LEARN - CONTRACT, GOVERNANCE & HTTP E2E SUITE');
  console.log('='.repeat(80));
  console.log(`Mode:       ${opts.dryRun ? 'DRY-RUN / STRUCTURE' : 'LIVE VERIFICATION'}`);
  console.log(`Base URL:   ${baseUrl}`);
  if (opts.tierFilter) console.log(`Tier:       ${opts.tierFilter}`);
  if (opts.filter) console.log(`Filter:     ${opts.filter}`);
  console.log('='.repeat(80));

  const summary = await runLearnContractAndHttpSuite(projectRoot, opts);

  for (const r of summary.results) {
    const badge =
      r.status === 'passed'
        ? '[PASS]'
        : r.status === 'skipped'
        ? '[PENDING]'
        : '[FAIL]';
    console.log(`  ${badge} ${r.name} (${r.durationMs}ms, ${r.assertionCount} assertions)`);
    if (r.status === 'failed' && r.error) {
      console.log(`           ERROR: ${r.error}`);
    }
    if (r.status === 'skipped' && r.details) {
      const skipLine = r.details.find((d) => d.startsWith('[SKIP]'));
      if (skipLine) {
        console.log(`           ${skipLine}`);
      }
    }
    if (opts.verbose && r.details) {
      for (const d of r.details) {
        console.log(`             ${d}`);
      }
    }
  }

  console.log('-'.repeat(80));
  console.log(
    `Result: ${summary.passed ? '[PASS]' : '[FAIL]'} | Passed: ${summary.passedTests}/${summary.totalTests} | Pending/Skipped: ${summary.skippedTests} | Failed: ${summary.failedTests} | Duration: ${summary.durationMs}ms`
  );
  console.log('='.repeat(80));

  if (opts.json) {
    const outPath = path.join(projectRoot, 'learn-e2e-report.json');
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          mode: opts.dryRun ? 'dry-run' : 'live',
          baseUrl,
          summary,
        },
        null,
        2
      )
    );
    console.log(`[INFO] Wrote JSON report to ${outPath}`);
  }

  process.exit(summary.passed ? 0 : 1);
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('tests/learn-e2e.test.ts');
if (isDirectRun) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CRITICAL] learn-e2e.test.ts crashed: ${msg}`);
    process.exit(1);
  });
}
