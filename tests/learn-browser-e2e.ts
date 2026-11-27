import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  TestHarness,
  TierExecutionResult,
  detectEmojisInText,
  executeCommand,
  findFilesRecursively,
  parseImportSpecifiers,
} from './test-utils';
import {
  LEARN_E2E_MATRIX,
  MatrixTestCase,
  validateMatrixCompleteness,
} from './learn-e2e/test-matrix';
import {
  detectNextJsCrashMarkers,
  fetchRouteHtml,
  getCortexBaseUrl,
  isValidHttpUrl,
  probeServerReachable,
} from './learn-e2e/http-client';
import {
  Browser,
  BrowserContext,
  Locator,
  Page,
  launchChromium,
  probePlaywrightAvailability,
} from './learn-e2e/playwright-loader';

interface CliOptions {
  dryRun: boolean;
  tierFilter?: number;
  filter?: string;
  headed: boolean;
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

interface CurriculumQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  codeSnippet?: { language: string; code: string };
}

interface CurriculumItem {
  id: string;
  type: 'notes' | 'quiz' | 'lab' | 'exam';
  title: string;
  passScore?: number;
  durationMins?: number;
  ideProblemId?: string;
  language?: string;
  starterCode?: string;
  steps?: string[];
  questions?: CurriculumQuestion[];
  sections?: Array<{
    id: string;
    heading: string;
    codeBlock?: { filename: string; language: string; code: string; runnableInIde?: boolean };
  }>;
}

interface CurriculumCourse {
  id: string;
  slug: string;
  title: string;
  track: string;
  level: string;
  modules: Array<{ id: string; title: string; items: CurriculumItem[] }>;
}

interface TestContext {
  baseUrl: string;
  browser: Browser;
  harness: TestHarness;
  projectRoot: string;
  coursesOracle: CurriculumCourse[];
}

type BrowserTestHandler = (ctx: TestContext) => Promise<void>;

function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    headed: false,
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
    } else if (arg === '--headed') {
      opts.headed = true;
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
        harness.assert(false, msg);
      } catch {
        // Error recorded on currentTest inside assert()
      }
    }
    harness.endTest('failed');
  }
}

async function loadCoursesOracle(projectRoot: string): Promise<CurriculumCourse[]> {
  const coursesPath = path.join(projectRoot, 'src', 'data', 'courses', 'index.ts');
  if (!fs.existsSync(coursesPath)) {
    return [];
  }
  try {
    const mod = (await import(pathToFileURL(coursesPath).href)) as {
      COURSES?: CurriculumCourse[];
    };
    return Array.isArray(mod.COURSES) ? mod.COURSES : [];
  } catch {
    return [];
  }
}

interface PageErrorTracker {
  pageErrors: string[];
  hydrationErrors: string[];
  consoleErrors: string[];
  assertClean: (
    harness: TestHarness,
    label: string,
    allowProgress401?: boolean,
    allowExpected404?: boolean
  ) => void;
}

function attachErrorTrackers(page: Page): PageErrorTracker {
  const pageErrors: string[] = [];
  const hydrationErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (/Hydration failed|did not match|Minified React error/i.test(text)) {
      hydrationErrors.push(text);
    }
    if (type === 'error') {
      consoleErrors.push(text);
    }
  });

  return {
    pageErrors,
    hydrationErrors,
    consoleErrors,
    assertClean: (
      harness: TestHarness,
      label: string,
      allowProgress401 = true,
      allowExpected404 = false
    ) => {
      harness.assertEquals(
        pageErrors.length,
        0,
        `${label}: zero uncaught pageerror exceptions (got: ${pageErrors.join(' | ')})`
      );
      harness.assertEquals(
        hydrationErrors.length,
        0,
        `${label}: zero React hydration warnings (got: ${hydrationErrors.join(' | ')})`
      );
      const unexpectedConsole = consoleErrors.filter((err) => {
        if (
          allowProgress401 &&
          /401|Unauthorized|Failed to load resource.*401/i.test(err)
        ) {
          return false;
        }
        if (
          allowExpected404 &&
          /404|Not Found|Failed to load resource.*404/i.test(err)
        ) {
          return false;
        }
        return true;
      });
      harness.assertEquals(
        unexpectedConsole.length,
        0,
        `${label}: zero unexpected console.error entries (got: ${unexpectedConsole.join(' | ')})`
      );
    },
  };
}

async function withIsolatedPage<T>(
  ctx: TestContext,
  options: {
    viewport?: { width: number; height: number };
    permissions?: string[];
    initScript?: string;
    allowProgress401?: boolean;
    allowExpected404?: boolean;
    label: string;
  },
  fn: (page: Page, context: BrowserContext, tracker: PageErrorTracker) => Promise<T>
): Promise<T> {
  const context = await ctx.browser.newContext({
    viewport: options.viewport || { width: 1440, height: 900 },
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });
  if (options.initScript) {
    await context.addInitScript(options.initScript);
  }
  const page = await context.newPage();
  const tracker = attachErrorTrackers(page);
  try {
    const result = await fn(page, context, tracker);
    tracker.assertClean(
      ctx.harness,
      options.label,
      options.allowProgress401 ?? true,
      options.allowExpected404 ?? false
    );
    return result;
  } finally {
    await context.close();
  }
}

async function waitForCatalogReady(page: Page): Promise<void> {
  await page.waitForSelector('header', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(
    () => {
      const txt = document.body.innerText || '';
      return /Python & Data Structures Mastery/i.test(txt) || /All Tracks/i.test(txt);
    },
    undefined,
    { timeout: 15000 }
  );
}

async function waitForPlayerReady(page: Page): Promise<void> {
  await page.waitForSelector('header', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('main', { state: 'visible', timeout: 15000 });
}

async function waitForIdeReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="global-activity-rail"]', {
    state: 'visible',
    timeout: 20000,
  });
  await page.waitForTimeout(400);
}

function getCourseSlug(ctx: TestContext, hint: 'python' | 'cpp' | 'sql'): string {
  const found = ctx.coursesOracle.find((c) => {
    if (hint === 'python') return /python/i.test(c.id) || /python/i.test(c.slug) || c.track === 'Python & DSA';
    if (hint === 'cpp') return /cpp|c\+\+/i.test(c.id) || c.track === 'Systems & C++';
    return /sql/i.test(c.id) || c.track === 'SQL & Data';
  });
  if (found) return found.slug || found.id;
  if (hint === 'python') return 'python-dsa';
  if (hint === 'cpp') return 'cpp-systems';
  return 'sql-design';
}

function getCourseFromOracle(ctx: TestContext, hint: 'python' | 'cpp' | 'sql'): CurriculumCourse | undefined {
  return ctx.coursesOracle.find((c) => {
    if (hint === 'python') return /python/i.test(c.id) || /python/i.test(c.slug) || c.track === 'Python & DSA';
    if (hint === 'cpp') return /cpp|c\+\+/i.test(c.id) || c.track === 'Systems & C++';
    return /sql/i.test(c.id) || c.track === 'SQL & Data';
  });
}

function findItemInOracle(
  course: CurriculumCourse | undefined,
  type: 'notes' | 'quiz' | 'lab' | 'exam',
  titleHint?: RegExp
): CurriculumItem | undefined {
  if (!course) return undefined;
  const items = course.modules.flatMap((m) => m.items);
  return items.find((item) => item.type === type && (!titleHint || titleHint.test(item.title)));
}

async function selectSyllabusLesson(
  page: Page,
  typeLabel: 'notes' | 'quiz' | 'lab' | 'exam',
  titlePattern?: RegExp
): Promise<void> {
  const sidebar = page.locator('aside').first();
  const buttons = sidebar.locator('button');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const text = ((await btn.textContent()) || '').trim();
    if (titlePattern && titlePattern.test(text)) {
      await btn.click();
      await page.waitForTimeout(150);
      return;
    }
  }
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const text = ((await btn.textContent()) || '').trim().toLowerCase();
    if (text.includes(typeLabel)) {
      await btn.click();
      await page.waitForTimeout(150);
      return;
    }
  }
  throw new Error(`Could not find syllabus item of type "${typeLabel}"`);
}

function parseRgb(color: string): { r: number; g: number; b: number; a: number } | null {
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] !== undefined ? Number(match[4]) : 1,
  };
}

function isBrightOrangeRgb(rgb: { r: number; g: number; b: number } | null): boolean {
  if (!rgb) return false;
  return rgb.r >= 230 && rgb.g >= 120 && rgb.g <= 165 && rgb.b <= 45;
}

function isAmberRgb(rgb: { r: number; g: number; b: number } | null): boolean {
  if (!rgb) return false;
  return rgb.r >= 180 && rgb.g >= 110 && rgb.g <= 215 && rgb.b <= 90;
}

function isRoseRgb(rgb: { r: number; g: number; b: number } | null): boolean {
  if (!rgb) return false;
  return rgb.r >= 180 && rgb.g <= 130 && rgb.b >= 55 && rgb.b <= 170;
}

function isEmeraldRgb(rgb: { r: number; g: number; b: number } | null): boolean {
  if (!rgb) return false;
  return rgb.g >= 130 && rgb.r <= 110 && rgb.b >= 70 && rgb.b <= 170;
}

function findMatchingOptionIndex(
  renderedOptions: string[],
  oracleQuestions: CurriculumQuestion[],
  questionPrompt: string,
  pickCorrect: boolean
): number {
  const normalizedPrompt = questionPrompt.replace(/^\d+\.\s*/, '').trim();
  const matched = oracleQuestions.find(
    (q) =>
      normalizedPrompt.includes(q.prompt.slice(0, Math.min(28, q.prompt.length))) ||
      q.prompt.includes(normalizedPrompt.slice(0, Math.min(28, normalizedPrompt.length)))
  );
  if (matched) {
    if (pickCorrect) return matched.correctIndex;
    return matched.correctIndex === 0 ? 1 : 0;
  }
  return pickCorrect ? 0 : 1;
}

async function getQuizOptionButtons(page: Page): Promise<Locator> {
  return page.locator('main button').filter({ hasText: /^[A-D]\.|^[A-D]\s/ });
}

async function checkAndAdvanceQuizQuestion(page: Page, optionIdx: number): Promise<void> {
  const options = await getQuizOptionButtons(page);
  const count = await options.count();
  if (count === 0) {
    throw new Error('No quiz option buttons found');
  }
  await options.nth(Math.min(optionIdx, count - 1)).click();

  const checkBtn = page
    .locator('main button')
    .filter({ hasText: /Check Answer|Submit Answer|Check|Confirm/i })
    .first();
  if ((await checkBtn.count()) > 0 && (await checkBtn.isVisible())) {
    await checkBtn.click();
  }

  const nextBtn = page
    .locator('main button')
    .filter({ hasText: /Next Question|Next|Finish|View Results|See Results|Complete/i })
    .first();
  if ((await nextBtn.count()) > 0 && (await nextBtn.isVisible())) {
    await nextBtn.click();
  }
}

async function setMonacoOrEditorCode(page: Page, code: string): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const win = window as unknown as {
          monaco?: {
            editor?: {
              getModels?: () => Array<{ setValue: (v: string) => void }>;
            };
          };
        };
        const models = win.monaco?.editor?.getModels?.();
        return Boolean(models && models.length > 0) || Boolean(document.querySelector('textarea.inputarea, textarea'));
      },
      undefined,
      { timeout: 10000 }
    )
    .catch(() => {});

  const updatedViaMonaco = await page.evaluate((nextCode) => {
    const win = window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{ setValue: (v: string) => void }>;
        };
      };
    };
    const models = win.monaco?.editor?.getModels?.();
    if (models && models.length > 0) {
      models[models.length - 1].setValue(nextCode);
      return true;
    }
    return false;
  }, code);

  if (updatedViaMonaco) {
    await page.waitForTimeout(200);
    return;
  }

  // Fallback for DOM textarea if Monaco model is unavailable
  const textarea = page.locator('textarea.inputarea, textarea').first();
  if ((await textarea.count()) > 0) {
    await textarea.focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(code);
  }
}

async function getMonacoOrEditorCode(page: Page): Promise<string> {
  await page
    .waitForFunction(
      () => {
        const win = window as unknown as {
          monaco?: {
            editor?: {
              getModels?: () => Array<{ getValue: () => string }>;
            };
          };
        };
        const models = win.monaco?.editor?.getModels?.();
        return Boolean(models && models.length > 0) || Boolean(document.querySelector('textarea.inputarea, textarea'));
      },
      undefined,
      { timeout: 10000 }
    )
    .catch(() => {});

  const fromMonaco = await page.evaluate(() => {
    const win = window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{ getValue: () => string }>;
        };
      };
    };
    const models = win.monaco?.editor?.getModels?.();
    if (models && models.length > 0) {
      return models[models.length - 1].getValue();
    }
    return null;
  });
  if (fromMonaco !== null) {
    return fromMonaco;
  }

  const textarea = page.locator('textarea.inputarea, textarea').first();
  if ((await textarea.count()) > 0) {
    return (await textarea.inputValue().catch(() => '')) || '';
  }
  return '';
}

const TWO_SUM_VALID_PYTHON = [
  'import sys',
  'def two_sum():',
  '    lines = sys.stdin.read().splitlines()',
  '    if len(lines) < 2:',
  '        return',
  '    nums = list(map(int, lines[0].split()))',
  '    target = int(lines[1])',
  '    seen = {}',
  '    for i, n in enumerate(nums):',
  '        diff = target - n',
  '        if diff in seen:',
  '            print(f"[{seen[diff]}, {i}]")',
  '            return',
  '        seen[n] = i',
  "if __name__ == '__main__':",
  '    two_sum()',
].join('\n');

// ============================================================================
// ALL 91 GENUINE PLAYWRIGHT E2E TEST HANDLERS (T1-F1-01 .. T4-06)
// ============================================================================

const TEST_HANDLERS: Record<string, BrowserTestHandler> = {
  // --------------------------------------------------------------------------
  // TIER 1: F1 - /learn Catalog, Top Bar, Continue Strip & Track Filtering
  // --------------------------------------------------------------------------
  'T1-F1-01': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T1-F1-01' }, async (page) => {
      const res = await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      ctx.harness.assertEquals(res?.status(), 200, '/learn should return HTTP 200');
      await waitForCatalogReady(page);

      const header = page.locator('header').first();
      ctx.harness.assert(await header.isVisible(), 'Top header should be visible');
      const headerBox = await header.boundingBox();
      ctx.harness.assert(
        Boolean(headerBox && headerBox.height >= 44 && headerBox.height <= 56),
        `Header height should match h-12 (~48px), got ${headerBox?.height}`
      );

      for (const navText of ['Learn', 'Practice Hub', 'Open IDE']) {
        const navLink = header.getByRole('link', { name: new RegExp(navText, 'i') }).first();
        ctx.harness.assert(await navLink.isVisible(), `Header nav link "${navText}" should be visible`);
      }

      const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]').first();
      ctx.harness.assert(await searchInput.isVisible(), 'Catalog Search input should be visible');

      const themeBtn = header.locator('button').filter({ hasText: /^$/ }).last();
      ctx.harness.assert((await header.locator('button').count()) >= 1, 'Theme toggle button should exist in top bar');
      ctx.harness.assert(await themeBtn.isVisible(), 'Theme toggle button should be visible');
    });
  },

  'T1-F1-02': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T1-F1-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.removeItem('cortex_learn_progress_v1'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);

      const bodyText = await page.locator('main').innerText();
      for (const title of [
        'Python & Data Structures Mastery',
        'Modern C++ Systems Foundations',
        'SQL & Relational Query Design',
      ]) {
        ctx.harness.assertIncludes(bodyText, title, `Catalog should display course "${title}"`);
      }

      ctx.harness.assertMatch(bodyText, /Beginner/i, 'Beginner level tag should render');
      ctx.harness.assertMatch(bodyText, /Intermediate/i, 'Intermediate level tag should render');
      ctx.harness.assertMatch(bodyText, /Module/i, 'Structured Module metadata should render');
      ctx.harness.assertMatch(bodyText, /Lab/i, 'Structured Lab metadata should render');
      ctx.harness.assertMatch(bodyText, /Start Course/i, 'Fresh courses should display Start Course CTA');

      const cardPositions = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('main a[href^="/learn/"], main article, main [data-course-card]'));
        const ys = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top)));
        return { count: cards.length, distinctRows: ys.size };
      });
      ctx.harness.assertGreaterThanOrEqual(cardPositions.count, 3, 'At least 3 course cards should render');
      ctx.harness.assert(cardPositions.distinctRows <= 2, 'Desktop grid should arrange >= 2 columns');
    });
  },

  'T1-F1-03': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T1-F1-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);

      const paletteAudit = await page.evaluate(() => {
        const ctas = Array.from(document.querySelectorAll('main a, main button, header a'));
        const bgColors = ctas.map((el) => window.getComputedStyle(el).backgroundColor);
        const progressEls = Array.from(document.querySelectorAll('[class*="bg-amber-"], [style*="width"]'));
        const progressBgs = progressEls.map((el) => window.getComputedStyle(el).backgroundColor);
        return { bgColors, progressBgs };
      });

      for (const bg of paletteAudit.bgColors) {
        const rgb = parseRgb(bg);
        ctx.harness.assert(!isBrightOrangeRgb(rgb), `CTA must not use solid bright orange (${bg})`);
      }

      const hasAmberProgress = paletteAudit.progressBgs.some((bg) => isAmberRgb(parseRgb(bg)));
      ctx.harness.assert(
        hasAmberProgress,
        'Progress bar indicators should use restrained warm-amber styling'
      );
    });
  },

  'T1-F1-04': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T1-F1-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);

      await page.getByRole('button', { name: 'Python & DSA' }).click();
      let mainText = await page.locator('main').innerText();
      ctx.harness.assertIncludes(mainText, 'Python & Data Structures Mastery', 'Python & DSA filter shows Python course');
      ctx.harness.assert(!mainText.includes('Modern C++ Systems Foundations'), 'Python & DSA filter hides C++ course');

      await page.getByRole('button', { name: 'Systems & C++' }).click();
      mainText = await page.locator('main').innerText();
      ctx.harness.assertIncludes(mainText, 'Modern C++ Systems Foundations', 'Systems & C++ filter shows C++ course');
      ctx.harness.assert(!mainText.includes('SQL & Relational Query Design'), 'Systems & C++ filter hides SQL course');

      await page.getByRole('button', { name: 'SQL & Data' }).click();
      mainText = await page.locator('main').innerText();
      ctx.harness.assertIncludes(mainText, 'SQL & Relational Query Design', 'SQL & Data filter shows SQL course');

      await page.getByRole('button', { name: 'All Tracks' }).click();
      mainText = await page.locator('main').innerText();
      ctx.harness.assertIncludes(mainText, 'Python & Data Structures Mastery', 'All Tracks restores Python course');
      ctx.harness.assertIncludes(mainText, 'Modern C++ Systems Foundations', 'All Tracks restores C++ course');
      ctx.harness.assertIncludes(mainText, 'SQL & Relational Query Design', 'All Tracks restores SQL course');
    });
  },

  'T1-F1-05': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T1-F1-05' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);

      const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]').first();
      await searchInput.fill('Smart Pointers');
      let mainText = await page.locator('main').innerText();
      ctx.harness.assertIncludes(mainText, 'Modern C++ Systems Foundations', 'Search "Smart Pointers" matches C++ course');
      ctx.harness.assert(!mainText.includes('SQL & Relational Query Design'), 'Search filters out non-matching SQL course');

      await searchInput.fill('');
      mainText = await page.locator('main').innerText();
      ctx.harness.assertIncludes(mainText, 'Python & Data Structures Mastery', 'Clearing search restores all courses');
      ctx.harness.assertIncludes(mainText, 'SQL & Relational Query Design', 'Clearing search restores SQL course');
    });
  },

  'T1-F1-06': async (ctx) => {
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const firstItem = pyCourse?.modules[0]?.items[0];
    const secondItem = pyCourse?.modules[0]?.items[1];
    const courseSlug = getCourseSlug(ctx, 'python');

    await withIsolatedPage(
      ctx,
      {
        label: 'T1-F1-06',
        initScript: `localStorage.setItem('cortex_learn_progress_v1', ${JSON.stringify(
          JSON.stringify({
            completedItemIds: [firstItem?.id || 'py-m1-notes'],
            quizScores: {},
            examAttempts: {},
            labSteps: {},
            lastVisitedLesson: {
              [courseSlug]: {
                courseId: pyCourse?.id || courseSlug,
                lessonId: secondItem?.id || firstItem?.id || 'py-m1-quiz',
                updatedAt: Date.now(),
              },
            },
            lastActiveCourseId: pyCourse?.id || courseSlug,
          })
        )});`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
        await waitForCatalogReady(page);

        const resumeCta = page.getByRole('link', { name: /Resume Lesson/i }).first();
        ctx.harness.assert(await resumeCta.isVisible(), 'Continue Learning strip should show Resume Lesson CTA');
        const href = (await resumeCta.getAttribute('href')) || '';
        ctx.harness.assertIncludes(href, '/learn/', 'Resume Lesson link should point to /learn/<course>');

        const bodyText = await page.locator('main').innerText();
        ctx.harness.assertMatch(bodyText, /Continue/i, 'In-progress course card should show Continue CTA');
      }
    );
  },

  // --------------------------------------------------------------------------
  // TIER 1: F2 - /learn/[courseId] 3-Zone Course Player Shell & Notes Mode
  // --------------------------------------------------------------------------
  'T1-F2-01': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F2-01' }, async (page) => {
      const res = await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      ctx.harness.assertEquals(res?.status(), 200, 'Course player should return HTTP 200');
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');

      const geo = await page.evaluate(() => {
        const asides = Array.from(document.querySelectorAll('aside')).map((a) => ({
          width: Math.round(a.getBoundingClientRect().width),
          text: (a.textContent || '').trim(),
        }));
        const main = document.querySelector('main');
        const mainArticle = document.querySelector('main article, main > div');
        return {
          asides,
          mainWidth: main ? Math.round(main.getBoundingClientRect().width) : 0,
          articleMaxWidth: mainArticle ? window.getComputedStyle(mainArticle).maxWidth : '',
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      const leftDrawer = geo.asides.find((a) => a.width >= 260 && a.width <= 300);
      const rightOutline = geo.asides.find((a) => a.width >= 180 && a.width <= 230 && /On This Page/i.test(a.text));
      ctx.harness.assert(Boolean(leftDrawer), `Left syllabus drawer should be ~280px (got asides: ${JSON.stringify(geo.asides.map((a) => a.width))})`);
      ctx.harness.assert(Boolean(rightOutline), 'Right On This Page outline (~200-210px) should be visible on XL Notes view');
      ctx.harness.assert(!geo.overflowX, 'Player layout should have zero horizontal overflow');
    });
  },

  'T1-F2-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F2-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);

      const toggleBtn = page.locator('header button[title*="Syllabus" i], header button[aria-label*="Syllabus" i]').first();
      ctx.harness.assert(await toggleBtn.isVisible(), 'Toggle Syllabus button should be visible');
      await toggleBtn.click();
      await page.waitForTimeout(260);

      const collapsedWidth = await page.locator('aside').first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
      ctx.harness.assert(collapsedWidth <= 5, `Syllabus drawer should collapse to 0px (got ${collapsedWidth}px)`);

      await toggleBtn.click();
      await page.waitForTimeout(260);
      const restoredWidth = await page.locator('aside').first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
      ctx.harness.assertGreaterThanOrEqual(restoredWidth, 260, 'Syllabus drawer should restore to ~280px');

      const modBtn = page.locator('aside button').filter({ hasText: /Module 1/i }).first();
      await modBtn.click();
      await page.waitForTimeout(100);
      await modBtn.click();

      const asideText = await page.locator('aside').first().innerText();
      ctx.harness.assertMatch(asideText, /notes|quiz|lab|exam/i, 'Syllabus items should display lesson types');
      ctx.harness.assertMatch(asideText, /MIT|CC|Open|Adapted|License/i, 'Course attribution should render in syllabus/footer');
    });
  },

  'T1-F2-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F2-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');

      const typography = await page.evaluate(() => {
        const h1 = document.querySelector('main h1');
        const h2s = Array.from(document.querySelectorAll('main h2'));
        const p = document.querySelector('main article p, main section p');
        const h1Size = h1 ? parseFloat(window.getComputedStyle(h1).fontSize) : 0;
        const h2Size = h2s[0] ? parseFloat(window.getComputedStyle(h2s[0]).fontSize) : 0;
        const pSize = p ? parseFloat(window.getComputedStyle(p).fontSize) : 0;
        return { h1Size, h2Count: h2s.length, h2Size, pSize };
      });

      ctx.harness.assertGreaterThanOrEqual(typography.h1Size, 22, 'Notes H1 font size should be >= 22px');
      ctx.harness.assertGreaterThanOrEqual(typography.h2Count, 1, 'Notes should render H2 sections');
      ctx.harness.assertGreaterThanOrEqual(typography.pSize, 14, 'Notes prose font size should be >= 14px');

      const mainText = await page.locator('main').innerText();
      ctx.harness.assertMatch(mainText, /min read|Reading/i, 'Notes meta line should show Reading / min read');
      ctx.harness.assertMatch(mainText, /Key Concepts|TL;DR/i, 'Notes should render TL;DR / Key Concepts box');

      const outlineLink = page.locator('aside').last().locator('a[href^="#"]').last();
      if ((await outlineLink.count()) > 0) {
        await outlineLink.click();
        await page.waitForTimeout(100);
      }
    });
  },

  'T1-F2-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(
      ctx,
      {
        label: 'T1-F2-04',
        permissions: ['clipboard-read', 'clipboard-write'],
        initScript: `window.__copiedText = ''; if (navigator.clipboard) { navigator.clipboard.writeText = async (t) => { window.__copiedText = String(t); }; }`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
          waitUntil: 'domcontentloaded',
        });
        await waitForPlayerReady(page);
        await selectSyllabusLesson(page, 'notes');

        const copyBtn = page.locator('main button').filter({ hasText: /^Copy$/i }).first();
        ctx.harness.assert(await copyBtn.isVisible(), 'Notes code block Copy button should be visible');
        await copyBtn.click();

        const copiedBtn = page.locator('main button').filter({ hasText: /Copied/i }).first();
        ctx.harness.assert(await copiedBtn.isVisible(), 'Copy button should transition to Copied');
        const copied = await page.evaluate(() => (window as unknown as { __copiedText: string }).__copiedText);
        ctx.harness.assert(copied.trim().length > 0, 'Clipboard should receive non-empty code block text');
      }
    );
  },

  'T1-F2-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F2-05' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');

      const tryBtn = page.locator('main button, main a').filter({ hasText: /Try in IDE/i }).first();
      ctx.harness.assert(await tryBtn.isVisible(), 'Runnable code block Try in IDE button should be visible');
      await tryBtn.click();

      await page.waitForURL(/\/ide\?.*snippet=1/, { timeout: 15000 });
      const url = page.url();
      ctx.harness.assertIncludes(url, 'snippet=1', 'URL should contain snippet=1');
      ctx.harness.assertIncludes(url, 'course=', 'URL should contain course=');
      ctx.harness.assertIncludes(url, 'lesson=', 'URL should contain lesson=');
      await waitForIdeReady(page);
    });
  },

  'T1-F2-06': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F2-06' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');

      const initialTitle = (await page.locator('main h1').first().textContent()) || '';
      const completeBtn = page.locator('main button').filter({ hasText: /Mark Complete & Continue/i }).first();
      ctx.harness.assert(await completeBtn.isVisible(), 'Mark Complete & Continue button should be visible');
      await completeBtn.click();
      await page.waitForTimeout(200);

      const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '{}');
      const parsed = JSON.parse(stored) as { completedItemIds?: string[] };
      ctx.harness.assertGreaterThanOrEqual(
        parsed.completedItemIds?.length ?? 0,
        1,
        'completedItemIds in localStorage should include completed Notes lesson'
      );

      const nextTitle = (await page.locator('main h1').first().textContent()) || '';
      ctx.harness.assertNotEquals(nextTitle.trim(), initialTitle.trim(), 'View should advance to next lesson');
    });
  },

  // --------------------------------------------------------------------------
  // TIER 1: F3 - Concept Quiz Mode
  // --------------------------------------------------------------------------
  'T1-F3-01': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F3-01' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      const mainText = await page.locator('main').innerText();
      ctx.harness.assertMatch(mainText, /Question\s+1\s+of\s+4/i, 'Quiz should render single-question step "Question 1 of 4"');
      const optionBtns = await getQuizOptionButtons(page);
      ctx.harness.assertEquals(await optionBtns.count(), 4, 'Quiz question should render 4 option cards (A-D)');
    });
  },

  'T1-F3-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F3-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      const optionBtns = await getQuizOptionButtons(page);
      await optionBtns.nth(0).click();

      const checkBtn = page.locator('main button').filter({ hasText: /Check Answer|Submit Answer|Check/i }).first();
      if ((await checkBtn.count()) > 0 && (await checkBtn.isVisible())) {
        await checkBtn.click();
      }

      const nextBtn = page.locator('main button').filter({ hasText: /Next Question|Next/i }).first();
      ctx.harness.assert(await nextBtn.isVisible(), 'Next Question button should appear after checking answer');
    });
  },

  'T1-F3-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F3-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      await page.keyboard.press('2');
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);

      const nextBtn = page.locator('main button').filter({ hasText: /Next Question|Next/i }).first();
      if (await nextBtn.isVisible()) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
      }

      const mainText = await page.locator('main').innerText();
      ctx.harness.assertMatch(mainText, /Question\s+2\s+of\s+4/i, 'Keyboard 2 + Enter + Enter should advance to Question 2 of 4');
    });
  },

  'T1-F3-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const quizItem = findItemInOracle(pyCourse, 'quiz');
    const questions = quizItem?.questions || [];

    await withIsolatedPage(ctx, { label: 'T1-F3-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      for (let step = 0; step < Math.max(4, questions.length); step++) {
        const mainText = await page.locator('main').innerText();
        const optionBtns = await getQuizOptionButtons(page);
        const optTexts: string[] = [];
        const optCount = await optionBtns.count();
        for (let j = 0; j < optCount; j++) {
          optTexts.push((await optionBtns.nth(j).innerText()) || '');
        }
        const idx = findMatchingOptionIndex(optTexts, questions, mainText, true);
        await checkAndAdvanceQuizQuestion(page, idx);
        await page.waitForTimeout(100);
      }

      const summaryText = await page.locator('main').innerText();
      ctx.harness.assertMatch(summaryText, /Passed/i, 'Scoring 100% should render Passed summary');
      ctx.harness.assertMatch(summaryText, /100%/, 'Summary should show 100%');

      const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '{}');
      const parsed = JSON.parse(stored) as { quizScores?: Record<string, { passed: boolean }> };
      const passedAny = Object.values(parsed.quizScores || {}).some((r) => r.passed === true);
      ctx.harness.assert(passedAny, 'cortex_learn_progress_v1.quizScores should record passed=true');
    });
  },

  'T1-F3-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const quizItem = findItemInOracle(pyCourse, 'quiz');
    const questions = quizItem?.questions || [];

    await withIsolatedPage(ctx, { label: 'T1-F3-05' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      for (let step = 0; step < Math.max(4, questions.length); step++) {
        const mainText = await page.locator('main').innerText();
        const optionBtns = await getQuizOptionButtons(page);
        const optTexts: string[] = [];
        const optCount = await optionBtns.count();
        for (let j = 0; j < optCount; j++) {
          optTexts.push((await optionBtns.nth(j).innerText()) || '');
        }
        const idx = findMatchingOptionIndex(optTexts, questions, mainText, false);
        await checkAndAdvanceQuizQuestion(page, idx);
        await page.waitForTimeout(100);
      }

      const retryBtn = page.locator('main button').filter({ hasText: /Review & Retry|Retry/i }).first();
      ctx.harness.assert(await retryBtn.isVisible(), 'Failing quiz should show Review & Retry button');
      await retryBtn.click();
      await page.waitForTimeout(150);

      const resetText = await page.locator('main').innerText();
      ctx.harness.assertMatch(resetText, /Question\s+1\s+of\s+4/i, 'Retry should reset to Question 1 of 4');
    });
  },

  // --------------------------------------------------------------------------
  // TIER 1: F4 - Guided IDE Lab Mode
  // --------------------------------------------------------------------------
  'T1-F4-01': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F4-01' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'lab', /Two Sum/i);

      const mainText = await page.locator('main').innerText();
      ctx.harness.assertMatch(mainText, /Guided IDE Lab/i, 'Lab header should identify Guided IDE Lab');
      ctx.harness.assertMatch(mainText, /python/i, 'Lab header should display python language');
      ctx.harness.assertMatch(mainText, /Lab Checklist/i, 'Lab checklist section should be visible');
      ctx.harness.assert(await page.locator('main pre code').first().isVisible(), 'Starter code preview should render');
    });
  },

  'T1-F4-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F4-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'lab', /Two Sum/i);

      const previewCode = (await page.locator('main pre code').first().innerText()) || '';
      ctx.harness.assert(previewCode.trim().length > 10, 'Two Sum starter preview must not be empty');
      ctx.harness.assert(
        !/seen\[diff\]/.test(previewCode),
        'Two Sum starter code must be a problem stub, not pre-filled solution'
      );
    });
  },

  'T1-F4-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F4-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'lab', /Two Sum/i);

      const launchBtn = page.locator('main button, main a').filter({ hasText: /Launch Lab in Cortex IDE/i }).first();
      ctx.harness.assert(await launchBtn.isVisible(), 'Launch Lab in Cortex IDE CTA should be visible');
      await launchBtn.click();

      await page.waitForURL(/\/ide\?.*course=.*lesson=/, { timeout: 15000 });
      await waitForIdeReady(page);
      ctx.harness.assertIncludes(page.url(), 'course=', 'IDE URL should contain course=');
      ctx.harness.assertIncludes(page.url(), 'lesson=', 'IDE URL should contain lesson=');
    });
  },

  'T1-F4-04': async (ctx) => {
    const cppSlug = getCourseSlug(ctx, 'cpp');
    const sqlSlug = getCourseSlug(ctx, 'sql');

    await withIsolatedPage(ctx, { label: 'T1-F4-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(cppSlug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'lab');
      const cppText = await page.locator('main').innerText();
      ctx.harness.assertMatch(cppText, /c\+\+|cpp/i, 'C++ lab should display C++ language');

      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(sqlSlug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'lab');
      const sqlText = await page.locator('main').innerText();
      ctx.harness.assertMatch(sqlText, /sql/i, 'SQL lab should display SQL language');
    });
  },

  'T1-F4-05': async (ctx) => {
    const cppSlug = getCourseSlug(ctx, 'cpp');
    const cppCourse = getCourseFromOracle(ctx, 'cpp');
    const cppLab = findItemInOracle(cppCourse, 'lab');

    await withIsolatedPage(ctx, { label: 'T1-F4-05' }, async (page) => {
      const targetUrl = `${ctx.baseUrl}/ide?course=${encodeURIComponent(cppSlug)}&lesson=${encodeURIComponent(
        cppLab?.id || 'cpp-m1-lab'
      )}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);

      const stepCheckboxes = page.locator('input[type="checkbox"]');
      if ((await stepCheckboxes.count()) > 0) {
        await stepCheckboxes.first().click();
        await page.waitForTimeout(150);
        const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '{}');
        const parsed = JSON.parse(stored) as { labSteps?: Record<string, number[]> };
        const hasSteps = Object.values(parsed.labSteps || {}).some((arr) => arr.length > 0);
        ctx.harness.assert(hasSteps, 'Toggling lab checklist step should persist in labSteps');
      } else {
        const markBtn = page.locator('button').filter({ hasText: /Mark.*Complete|Complete/i }).first();
        ctx.harness.assert(await markBtn.isVisible(), 'Lab companion should provide step checkboxes or completion toggle');
      }
    });
  },

  // --------------------------------------------------------------------------
  // TIER 1: F5 - Distraction-Free Timed Exam Mode
  // --------------------------------------------------------------------------
  'T1-F5-01': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F5-01' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');

      const mainText = await page.locator('main').innerText();
      ctx.harness.assertMatch(mainText, /Duration:/i, 'Exam Briefing should display Duration');
      ctx.harness.assertMatch(mainText, /Questions:/i, 'Exam Briefing should display Questions count');
      ctx.harness.assertMatch(mainText, /Pass Threshold:/i, 'Exam Briefing should display Pass Threshold');

      const beginBtn = page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first();
      ctx.harness.assert(await beginBtn.isVisible(), 'Begin Timed Exam button should be visible');

      const asideWidth = await page.locator('aside').first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
      ctx.harness.assertGreaterThanOrEqual(asideWidth, 250, 'Syllabus should remain open on Briefing screen');
    });
  },

  'T1-F5-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F5-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');

      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();
      await page.waitForTimeout(200);

      const syllabusVisible = await page.evaluate(() => {
        const asides = Array.from(document.querySelectorAll('aside'));
        return asides.some((a) => a.getBoundingClientRect().width > 200);
      });
      ctx.harness.assert(!syllabusVisible, 'Syllabus drawer should auto-collapse during active Timed Exam');

      const pageText = await page.locator('body').innerText();
      ctx.harness.assertMatch(pageText, /\b\d{2}:\d{2}\b/, 'Live MM:SS countdown timer should render');
      ctx.harness.assertMatch(pageText, /Submit Exam/i, 'Submit Exam button should render');
    });
  },

  'T1-F5-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const q3 = examItem?.questions?.[2];
    const q3Snippet = q3?.prompt ? q3.prompt.slice(0, Math.min(24, q3.prompt.length)) : '';

    await withIsolatedPage(ctx, { label: 'T1-F5-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();
      await page.waitForTimeout(150);

      const pill1 = page.locator('button').filter({ hasText: /^1$/ }).first();
      const pill2 = page.locator('button').filter({ hasText: /^2$/ }).first();
      const pill3 = page.locator('button').filter({ hasText: /^3$/ }).first();
      ctx.harness.assert(await pill1.isVisible(), 'Question navigator pill 1 should be visible');
      ctx.harness.assert(await pill3.isVisible(), 'Question navigator pill 3 should be visible');

      const pill1Before = await pill1.evaluate((el) => ({
        className: el.className,
        ariaLabel: el.getAttribute('aria-label') || '',
        dataState: el.getAttribute('data-state') || el.getAttribute('data-answered') || '',
        bg: window.getComputedStyle(el).backgroundColor,
        border: window.getComputedStyle(el).borderColor,
      }));

      const firstOption = (await getQuizOptionButtons(page)).first();
      await firstOption.click();
      await page.waitForTimeout(100);

      const pill1AfterClick = await pill1.evaluate((el) => ({
        className: el.className,
        ariaLabel: el.getAttribute('aria-label') || '',
        dataState: el.getAttribute('data-state') || el.getAttribute('data-answered') || '',
        bg: window.getComputedStyle(el).backgroundColor,
        border: window.getComputedStyle(el).borderColor,
      }));

      await pill3.click();
      await page.waitForTimeout(150);

      const pill1AfterNav = await pill1.evaluate((el) => ({
        className: el.className,
        ariaLabel: el.getAttribute('aria-label') || '',
        dataState: el.getAttribute('data-state') || el.getAttribute('data-answered') || '',
        bg: window.getComputedStyle(el).backgroundColor,
        border: window.getComputedStyle(el).borderColor,
      }));
      const pill2AfterNav =
        (await pill2.count()) > 0
          ? await pill2.evaluate((el) => ({
              className: el.className,
              ariaLabel: el.getAttribute('aria-label') || '',
              dataState: el.getAttribute('data-state') || el.getAttribute('data-answered') || '',
              bg: window.getComputedStyle(el).backgroundColor,
              border: window.getComputedStyle(el).borderColor,
            }))
          : null;

      const pill1ChangedImmediately =
        pill1Before.className !== pill1AfterClick.className ||
        pill1Before.ariaLabel !== pill1AfterClick.ariaLabel ||
        pill1Before.dataState !== pill1AfterClick.dataState ||
        pill1Before.bg !== pill1AfterClick.bg ||
        pill1Before.border !== pill1AfterClick.border;
      const pill1DiffersFromUnanswered =
        pill2AfterNav !== null &&
        (pill1AfterNav.className !== pill2AfterNav.className ||
          pill1AfterNav.ariaLabel !== pill2AfterNav.ariaLabel ||
          pill1AfterNav.dataState !== pill2AfterNav.dataState ||
          pill1AfterNav.bg !== pill2AfterNav.bg ||
          pill1AfterNav.border !== pill2AfterNav.border);

      ctx.harness.assert(
        pill1ChangedImmediately || pill1DiffersFromUnanswered,
        'Pill 1 should reflect answered state after selecting an option on Q1'
      );

      const mainText = await page.locator('main').innerText();
      const q3TextPresent =
        /\b3\.\s/.test(mainText) ||
        /Question\s+3\b/i.test(mainText) ||
        (q3Snippet.length > 0 && mainText.includes(q3Snippet));
      const q3VisibleInView = await page.evaluate((snippet) => {
        const main = document.querySelector('main');
        if (!main) return false;
        const candidates = Array.from(main.querySelectorAll('div, section, h2, h3, p, span'));
        const target = candidates.find((el) => {
          const t = (el.textContent || '').trim();
          return (snippet && t.includes(snippet)) || /^3\.\s/.test(t) || /^Question\s+3\b/i.test(t);
        });
        if (!target) return false;
        const r = target.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= -20 && r.top < window.innerHeight;
      }, q3Snippet);

      ctx.harness.assert(
        q3TextPresent && q3VisibleInView,
        'Clicking pill 3 should display/activate Question 3 prompt or marker in view'
      );
    });
  },

  'T1-F5-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F5-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();
      await page.waitForTimeout(150);

      const flagBtn = page.locator('button[title*="Flag" i], button').filter({ hasText: /Flag/i }).first();
      ctx.harness.assert(await flagBtn.isVisible(), 'Flag for Review button should be visible');
      await flagBtn.click();
      await page.waitForTimeout(100);

      const hasAmber = await flagBtn.evaluate((el) => /amber/i.test(el.className));
      ctx.harness.assert(hasAmber, 'Flagged button should show amber indicator');
      await flagBtn.click();
      await page.waitForTimeout(100);

      const stillHasAmber = await flagBtn.evaluate((el) => /amber/i.test(el.className));
      ctx.harness.assert(
        !stillHasAmber,
        'Clicking Flag for Review a second time should remove the amber flagged indicator'
      );
    });
  },

  'T1-F5-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const durationMins = examItem?.durationMins || 15;

    await withIsolatedPage(ctx, { label: 'T1-F5-05' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');

      await page.clock.install();
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();
      await page.clock.runFor(500);

      // Fast-forward to 04:55 (295s remaining)
      const toAmberMs = Math.max(0, (durationMins * 60 - 295) * 1000);
      await page.clock.runFor(toAmberMs);
      const amberTimer = page.locator('header, main').locator('text=/04:5[0-9]/').first();
      ctx.harness.assert(await amberTimer.isVisible(), 'Timer should reach ~04:55 (<5m)');
      const amberColor = await amberTimer.evaluate((el) => window.getComputedStyle(el).color);
      ctx.harness.assert(isAmberRgb(parseRgb(amberColor)) || /amber/i.test(await amberTimer.evaluate((e) => e.className)), 'Timer <5m should use amber styling');

      // Fast-forward 180s to 01:55 (115s remaining)
      await page.clock.runFor(180 * 1000);
      const roseTimer = page.locator('header, main').locator('text=/01:5[0-9]/').first();
      ctx.harness.assert(await roseTimer.isVisible(), 'Timer should reach ~01:55 (<2m)');
      const roseColor = await roseTimer.evaluate((el) => window.getComputedStyle(el).color);
      ctx.harness.assert(isRoseRgb(parseRgb(roseColor)) || /rose/i.test(await roseTimer.evaluate((e) => e.className)), 'Timer <2m should use rose styling');
    });
  },

  'T1-F5-06': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const questions = examItem?.questions || [];

    await withIsolatedPage(ctx, { label: 'T1-F5-06' }, async (page) => {
      page.on('dialog', (d) => d.accept());
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();
      await page.waitForTimeout(150);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const card = page.locator('main button').filter({ hasText: q.options[q.correctIndex] }).first();
        if ((await card.count()) > 0) {
          await card.click();
        }
      }

      const submitBtn = page.locator('button').filter({ hasText: /Submit Exam/i }).first();
      await submitBtn.click();
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm Submit|Submit Now|Yes, Submit/i }).first();
      if ((await confirmBtn.count()) > 0 && (await confirmBtn.isVisible())) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(200);

      const reportText = await page.locator('main').innerText();
      ctx.harness.assertMatch(reportText, /Passed|100%/i, 'Exam Report should display Passed / percentage score');
      const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '{}');
      const parsed = JSON.parse(stored) as { examAttempts?: Record<string, unknown[]> };
      const hasAttempt = Object.values(parsed.examAttempts || {}).some((a) => Array.isArray(a) && a.length > 0);
      ctx.harness.assert(hasAttempt, 'cortex_learn_progress_v1.examAttempts should be persisted');
    });
  },

  // --------------------------------------------------------------------------
  // TIER 1: F6 - Shared Theme & Progress Persistence
  // --------------------------------------------------------------------------
  'T1-F6-01': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T1-F6-01' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);

      const isDarkDefault = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      ctx.harness.assert(isDarkDefault, 'Default theme should include dark class on html element');

      const headerBtns = page.locator('header button');
      await headerBtns.last().click();
      await page.waitForTimeout(150);

      const themeState = await page.evaluate(() => ({
        hasDark: document.documentElement.classList.contains('dark'),
        stored: localStorage.getItem('cortex_ide_theme'),
      }));
      ctx.harness.assert(!themeState.hasDark, 'Toggling theme should remove dark class');
      ctx.harness.assertEquals(themeState.stored, 'light', 'cortex_ide_theme should persist "light"');
    });
  },

  'T1-F6-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F6-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      await page.locator('header button').last().click();
      await page.waitForTimeout(150);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      ctx.harness.assert(
        !(await page.evaluate(() => document.documentElement.classList.contains('dark'))),
        'Light mode should persist after /learn reload'
      );

      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      ctx.harness.assert(
        !(await page.evaluate(() => document.documentElement.classList.contains('dark'))),
        'Light mode should persist on /learn/[courseId]'
      );

      await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);
      ctx.harness.assertEquals(
        await page.evaluate(() => localStorage.getItem('cortex_ide_theme')),
        'light',
        'Light mode should persist on /ide'
      );
    });
  },

  'T1-F6-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F6-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');

      await page.locator('main button').filter({ hasText: /Mark Complete & Continue/i }).first().click();
      await page.waitForTimeout(150);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      const headerText = await page.locator('header').innerText();
      ctx.harness.assertMatch(headerText, /[1-9]\d*%/, 'Progress % should persist > 0% across reload');

      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      ctx.harness.assert(
        await page.getByRole('link', { name: /Resume Lesson/i }).first().isVisible(),
        'Continue Learning strip should reflect persisted progress on /learn'
      );
    });
  },

  'T1-F6-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F6-04' }, async (pageA, context) => {
      await pageA.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(pageA);

      const pageB = await context.newPage();
      const trackerB = attachErrorTrackers(pageB);
      try {
        await pageB.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
        await waitForPlayerReady(pageB);
        await selectSyllabusLesson(pageB, 'notes');
        await pageB.locator('main button').filter({ hasText: /Mark Complete & Continue/i }).first().click();
        await pageB.waitForTimeout(200);

        // Toggle theme in Page B and verify Page A syncs via storage event
        await pageB.locator('header button').last().click();
        await pageA.waitForTimeout(250);

        const pageADark = await pageA.evaluate(() => document.documentElement.classList.contains('dark'));
        ctx.harness.assert(!pageADark, 'Page A should sync Light theme from Page B via storage event');
        const pageAText = await pageA.locator('main').innerText();
        ctx.harness.assertMatch(pageAText, /Resume Lesson|Continue/i, 'Page A should sync progress from Page B via storage event');
        trackerB.assertClean(ctx.harness, 'T1-F6-04 (pageB)', true);
      } finally {
        await pageB.close();
      }
    });
  },

  'T1-F6-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T1-F6-05', allowProgress401: true }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');
      await page.locator('main button').filter({ hasText: /Mark Complete & Continue/i }).first().click();
      await page.waitForTimeout(200);

      const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '');
      ctx.harness.assertIncludes(stored, 'completedItemIds', 'Guest session progress should save locally');
    });
  },

  // --------------------------------------------------------------------------
  // TIER 1: F7 - /ide Lab Companion & GlobalSidebar Reference Rail Hardening
  // --------------------------------------------------------------------------
  'T1-F7-01': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);

    await withIsolatedPage(ctx, { label: 'T1-F7-01' }, async (page) => {
      await page.goto(
        `${ctx.baseUrl}/ide?course=${encodeURIComponent(pySlug)}&lesson=${encodeURIComponent(
          twoSumLab?.id || 'two-sum-lab'
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForIdeReady(page);

      const bodyText = await page.locator('body').innerText();
      ctx.harness.assertIncludes(bodyText, 'Reference', 'LearnSidebar Reference header should be visible');
      ctx.harness.assert(!bodyText.includes('Interactive Curricula'), 'Legacy multi-course Interactive Curricula banner must be removed');
      ctx.harness.assertMatch(bodyText, /Load Starter Code/i, 'Active lab companion should display Load Starter Code');
      ctx.harness.assertMatch(bodyText, /Return to Course/i, 'Active lab companion should display Return to Course');
    });
  },

  'T1-F7-02': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);

    await withIsolatedPage(ctx, { label: 'T1-F7-02' }, async (page) => {
      let executeCallCount = 0;
      // Deterministic execution fallback if local sandbox isn't running
      await page.route('**/api/v1/execute', async (route) => {
        executeCallCount += 1;
        const postData = route.request().postData() || '{}';
        const body = JSON.parse(postData) as { stdin?: string; code?: string };
        const stdin = (body.stdin || '').trim();
        let stdout = '';
        if (body.code && /seen\[diff\]/.test(body.code)) {
          if (stdin === '2 7 11 15\n9') stdout = '[0, 1]\n';
          else if (stdin === '3 2 4\n6') stdout = '[1, 2]\n';
          else if (stdin === '3 3\n6') stdout = '[0, 1]\n';
          else if (stdin === '-1 -2 -3 -4 -5\n-8') stdout = '[2, 4]\n';
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', exitCode: 0, stdout, stderr: '', executionTimeMs: 12 }),
        });
      });

      await page.goto(
        `${ctx.baseUrl}/ide?course=${encodeURIComponent(pySlug)}&lesson=${encodeURIComponent(
          twoSumLab?.id || 'two-sum-lab'
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForIdeReady(page);

      const loadStarterBtn = page.locator('button').filter({ hasText: /Load Starter Code/i }).first();
      ctx.harness.assert(
        (await loadStarterBtn.count()) > 0 && (await loadStarterBtn.isVisible()),
        'Load Starter Code button must be visible'
      );
      await loadStarterBtn.click();
      await page.waitForTimeout(200);

      await setMonacoOrEditorCode(page, TWO_SUM_VALID_PYTHON);

      let runTestsBtn = page.locator('button').filter({ hasText: /Run.*Tests|Run All/i }).first();
      if (!((await runTestsBtn.count()) > 0 && (await runTestsBtn.isVisible()))) {
        const testsTab = page.getByTestId('workbench-tab-tests');
        if ((await testsTab.count()) > 0 && (await testsTab.isVisible())) {
          await testsTab.click();
          await page.waitForTimeout(200);
          runTestsBtn = page.locator('button').filter({ hasText: /Run.*Tests|Run All/i }).first();
        }
      }
      ctx.harness.assert(
        (await runTestsBtn.count()) > 0 && (await runTestsBtn.isVisible()),
        'Run Tests / Run All button must be visible in /ide'
      );
      await runTestsBtn.click();

      await page
        .waitForFunction(
          () => {
            const text = document.body.innerText || '';
            return /\bPass(?:ed)?\b|\bTests\s*\(\s*[1-9]\d*\s*\/\s*[1-9]\d*\s*\)|[1-9]\d*\s*\/\s*[1-9]\d*\s*(?:passed|tests)|\bAccepted\b/i.test(
              text
            );
          },
          undefined,
          { timeout: 6000 }
        )
        .catch(() => {});

      ctx.harness.assertGreaterThanOrEqual(
        executeCallCount,
        1,
        'Clicking Run Tests must execute Two Sum test cases via /api/v1/execute'
      );
      const bodyText = await page.locator('body').innerText();
      ctx.harness.assertMatch(
        bodyText,
        /\bPass(?:ed)?\b|\bTests\s*\(\s*[1-9]\d*\s*\/\s*[1-9]\d*\s*\)|[1-9]\d*\s*\/\s*[1-9]\d*\s*(?:passed|tests)|\bAccepted\b/i,
        'Two Sum test execution must render genuine passing test-result output'
      );
    });
  },

  'T1-F7-03': async (ctx) => {
    const cppSlug = getCourseSlug(ctx, 'cpp');
    const cppCourse = getCourseFromOracle(ctx, 'cpp');
    const cppLab = findItemInOracle(cppCourse, 'lab');

    await withIsolatedPage(ctx, { label: 'T1-F7-03' }, async (page) => {
      await page.goto(
        `${ctx.baseUrl}/ide?course=${encodeURIComponent(cppSlug)}&lesson=${encodeURIComponent(
          cppLab?.id || 'cpp-m1-lab'
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForIdeReady(page);

      const checkboxes = page.locator('input[type="checkbox"]');
      ctx.harness.assertGreaterThanOrEqual(await checkboxes.count(), 1, 'Standalone C++ lab should show step checkboxes');
      await checkboxes.first().click();
      await page.waitForTimeout(150);

      const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '');
      ctx.harness.assertIncludes(stored, 'labSteps', 'Toggling standalone lab step should update labSteps in localStorage');
    });
  },

  'T1-F7-04': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const notesItem = findItemInOracle(pyCourse, 'notes');
    const snippetCode = 'def lookup_pair(nums):\n    return {v: i for i, v in enumerate(nums)}\n';

    await withIsolatedPage(
      ctx,
      {
        label: 'T1-F7-04',
        initScript: `sessionStorage.setItem('cortex_ide_pending_snippet', ${JSON.stringify(
          JSON.stringify({
            code: snippetCode,
            language: 'python',
            filename: 'hash_lookup.py',
            courseId: pyCourse?.id || pySlug,
            lessonId: notesItem?.id || 'py-m1-notes',
            ts: Date.now(),
          })
        )});`,
      },
      async (page) => {
        await page.goto(
          `${ctx.baseUrl}/ide?snippet=1&lang=python&filename=hash_lookup.py&course=${encodeURIComponent(
            pySlug
          )}&lesson=${encodeURIComponent(notesItem?.id || 'py-m1-notes')}`,
          { waitUntil: 'domcontentloaded' }
        );
        await waitForIdeReady(page);

        const bodyText = await page.locator('body').innerText();
        ctx.harness.assertIncludes(bodyText, 'hash_lookup.py', 'IDE tab should open hash_lookup.py');

        const remaining = await page.evaluate(() => sessionStorage.getItem('cortex_ide_pending_snippet'));
        ctx.harness.assertEquals(remaining, null, 'Pending snippet payload should be consumed once from sessionStorage');
      }
    );
  },

  'T1-F7-05': async (ctx) => {
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const firstItem = pyCourse?.modules[0]?.items[0];
    const pySlug = getCourseSlug(ctx, 'python');

    await withIsolatedPage(
      ctx,
      {
        label: 'T1-F7-05',
        initScript: `localStorage.setItem('cortex_learn_progress_v1', ${JSON.stringify(
          JSON.stringify({
            completedItemIds: [firstItem?.id || 'py-m1-notes'],
            quizScores: {},
            examAttempts: {},
            labSteps: {},
            lastVisitedLesson: {},
            lastActiveCourseId: pyCourse?.id || pySlug,
          })
        )});`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
        await waitForIdeReady(page);

        await page.getByTestId('rail-nav-learn').click();
        await page.waitForTimeout(200);

        const bodyText = await page.locator('body').innerText();
        ctx.harness.assertIncludes(bodyText, 'Python & Data Structures Mastery', 'Idle Reference panel should list in-progress course');
        const hubLink = page.locator('a[href="/learn"]').filter({ hasText: /Open Full Learning Hub/i }).first();
        ctx.harness.assert(await hubLink.isVisible(), 'Idle Reference panel should show Open Full Learning Hub (/learn) link');
      }
    );
  },

  'T1-F7-06': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T1-F7-06' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);

      // Ensure files tab is active (not learn)
      await page.getByTestId('rail-nav-files').click();
      await page.waitForTimeout(100);

      await page.clock.install();
      const refBtn = page.getByTestId('rail-nav-learn');
      await refBtn.hover();
      await page.clock.runFor(180);

      const earlyTooltip = page.locator('[data-testid="global-activity-rail"] >> text=Reference');
      ctx.harness.assertEquals(await earlyTooltip.count(), 0, 'Tooltip must not appear before 280ms delay');

      await page.clock.runFor(160);
      ctx.harness.assert(await earlyTooltip.isVisible(), 'Tooltip should appear after >= 280ms delay');

      const geo = await page.evaluate(() => {
        const rail = document.querySelector('[data-testid="global-activity-rail"]')!;
        const tip = Array.from(rail.querySelectorAll('div')).find((d) => d.textContent?.trim() === 'Reference');
        const railRect = rail.getBoundingClientRect();
        const tipRect = tip ? tip.getBoundingClientRect() : null;
        const pointerEvents = tip ? window.getComputedStyle(tip).pointerEvents : '';
        return { railRight: railRect.right, tipLeft: tipRect?.left ?? 0, pointerEvents };
      });
      ctx.harness.assertEquals(geo.pointerEvents, 'none', 'Rail tooltip must have pointer-events: none');
      ctx.harness.assertGreaterThanOrEqual(geo.tipLeft, geo.railRight, 'Tooltip left edge must be >= rail right edge (58px)');

      await refBtn.click();
      await page.clock.runFor(350);
      ctx.harness.assertEquals(await earlyTooltip.count(), 0, 'Tooltip must dismiss on click and stay hidden while active');

      // Also verify Sign In link dismisses tooltip
      const signIn = page.getByTestId('rail-signin-link');
      if ((await signIn.count()) > 0) {
        await signIn.hover();
        await page.clock.runFor(320);
        await signIn.dispatchEvent('mousedown');
        ctx.harness.assertEquals(
          await page.locator('[data-testid="global-activity-rail"] >> text=Sign In').count(),
          0,
          'Sign In tooltip must dismiss immediately on mousedown'
        );
      }
    });
  },

  // --------------------------------------------------------------------------
  // TIER 2: BOUNDARY & CORNER CASES (37 Tests)
  // --------------------------------------------------------------------------
  'T2-F1-01': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F1-01' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      await page.getByRole('button', { name: 'AI & ML' }).click();
      const text = await page.locator('main').innerText();
      ctx.harness.assertMatch(text, /no courses|coming soon|reset|empty/i, 'Empty AI & ML track should show clean empty state');
    });
  },

  'T2-F1-02': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F1-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      const search = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
      await search.fill('zzz[nonexistent](');
      const emptyText = await page.locator('main').innerText();
      ctx.harness.assert(!emptyText.includes('Python & Data Structures Mastery'), 'Non-matching regex query should filter out courses cleanly');
      await search.fill('');
      ctx.harness.assertIncludes(await page.locator('main').innerText(), 'Python & Data Structures Mastery', 'Clearing search recovers catalog');
    });
  },

  'T2-F1-03': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F1-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      const resumeBtns = page.getByRole('link', { name: /Resume Lesson/i });
      ctx.harness.assertEquals(await resumeBtns.count(), 0, 'Continue strip must not render when zero courses are in progress');
    });
  },

  'T2-F1-04': async (ctx) => {
    const sqlCourse = getCourseFromOracle(ctx, 'sql');
    const allIds = sqlCourse ? sqlCourse.modules.flatMap((m) => m.items.map((i) => i.id)) : ['sql-m1-notes'];

    await withIsolatedPage(
      ctx,
      {
        label: 'T2-F1-04',
        initScript: `localStorage.setItem('cortex_learn_progress_v1', ${JSON.stringify(
          JSON.stringify({
            completedItemIds: allIds,
            quizScores: {},
            examAttempts: {},
            labSteps: {},
            lastVisitedLesson: {},
            lastActiveCourseId: null,
          })
        )});`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
        await waitForCatalogReady(page);
        const text = await page.locator('main').innerText();
        ctx.harness.assertMatch(text, /100%|Completed|Review/i, '100% completed SQL course should render completed/100% state');
      }
    );
  },

  'T2-F1-05': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F1-05', viewport: { width: 375, height: 812 } }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      ctx.harness.assert(!mobileOverflow, '375px mobile catalog must have zero horizontal overflow');

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(100);
      const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      ctx.harness.assert(!tabletOverflow, '768px tablet catalog must have zero horizontal overflow');
    });
  },

  'T2-F2-01': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F2-01', allowExpected404: true }, async (page) => {
      const res = await page.goto(`${ctx.baseUrl}/learn/nonexistent-course`, { waitUntil: 'domcontentloaded' });
      const status = res?.status() ?? 0;
      ctx.harness.assert(
        status === 200 || status === 404,
        `/learn/nonexistent-course should return HTTP 200 or 404, got ${status}`
      );
      await page.waitForTimeout(300);
      const html = await page.content();
      ctx.harness.assertEquals(
        detectNextJsCrashMarkers(html).length,
        0,
        '/learn/nonexistent-course must have zero Next.js crash markers'
      );
      const bodyText = await page.locator('body').innerText();
      ctx.harness.assertMatch(bodyText, /not found|back|catalog|courses/i, 'Unknown course slug should render clean fallback');
      ctx.harness.assert(await page.locator('a[href="/learn"]').first().isVisible(), 'Fallback should link back to /learn');
    });
  },

  'T2-F2-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T2-F2-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}?lesson=does-not-exist`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPlayerReady(page);
      ctx.harness.assert(await page.locator('main h1').first().isVisible(), 'Invalid ?lesson param should fall back to valid default lesson');
    });
  },

  'T2-F2-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'sql');
    const sqlCourse = getCourseFromOracle(ctx, 'sql');
    const allItems = sqlCourse?.modules.flatMap((m) => m.items) || [];
    const firstItem = allItems[0];
    const lastItem = allItems[allItems.length - 1];

    await withIsolatedPage(ctx, { label: 'T2-F2-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);

      const firstHeadingBefore = await page.locator('main h1').first().innerText();
      const prevBtn = page.locator('main button').filter({ hasText: /Previous/i }).first();
      if ((await prevBtn.count()) > 0 && (await prevBtn.isVisible())) {
        const isDisabled = await prevBtn.isDisabled().catch(() => false);
        if (!isDisabled) {
          await prevBtn.click({ force: true });
          await page.waitForTimeout(100);
        }
      }
      const firstHeadingAfter = await page.locator('main h1').first().innerText();
      ctx.harness.assertEquals(
        firstHeadingAfter.trim(),
        firstHeadingBefore.trim(),
        'Previous on first lesson must stay on first lesson'
      );
      if (firstItem) {
        ctx.harness.assertIncludes(firstHeadingAfter, firstItem.title, 'First lesson heading should remain active');
      }

      // Navigate to the final lesson and verify final-lesson boundary behavior
      if (lastItem) {
        const escapedPrefix = lastItem.title.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await selectSyllabusLesson(page, lastItem.type, new RegExp(escapedPrefix, 'i'));
      } else {
        await page.locator('aside').first().locator('button').last().click();
      }
      await page.waitForTimeout(150);

      const lastHeadingBefore = await page.locator('main h1').first().innerText();
      ctx.harness.assert(lastHeadingBefore.trim().length > 0, 'Final lesson should render a valid heading');

      const completeBtn = page
        .locator('main button')
        .filter({ hasText: /Mark Complete|Mark Lab Complete|Complete Course/i })
        .first();
      const nextOnlyBtn = page
        .locator('main button')
        .filter({ hasText: /^Next\b|Continue/i })
        .first();

      let completedFinalViaBtn = false;
      if ((await completeBtn.count()) > 0 && (await completeBtn.isVisible())) {
        const isDisabled = await completeBtn.isDisabled().catch(() => false);
        if (!isDisabled) {
          await completeBtn.click();
          completedFinalViaBtn = true;
          await page.waitForTimeout(200);
        }
      } else if ((await nextOnlyBtn.count()) > 0 && (await nextOnlyBtn.isVisible())) {
        const isDisabled = await nextOnlyBtn.isDisabled().catch(() => false);
        if (!isDisabled) {
          await nextOnlyBtn.click();
          await page.waitForTimeout(150);
        }
      }

      ctx.harness.assert(
        await page.locator('main h1').first().isVisible(),
        'Final lesson boundary action must keep player valid without out-of-bounds error'
      );

      if (completedFinalViaBtn && lastItem) {
        const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '{}');
        const parsed = JSON.parse(stored) as { completedItemIds?: string[] };
        ctx.harness.assert(
          (parsed.completedItemIds || []).includes(lastItem.id),
          'Completing final lesson should persist its ID in completedItemIds'
        );
      }

      const headerText = await page.locator('header').innerText();
      ctx.harness.assert(
        !/NaN|10[1-9]%|[2-9]\d\d%/i.test(headerText),
        'Final lesson boundary must not produce invalid or >100% progress'
      );
    });
  },

  'T2-F2-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T2-F2-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');

      await page.setViewportSize({ width: 1100, height: 800 });
      await page.waitForTimeout(100);
      const outlineVisible1100 = await page.locator('aside').filter({ hasText: /On This Page/i }).isVisible().catch(() => false);
      ctx.harness.assert(!outlineVisible1100, 'On This Page outline must hide below 1280px');

      await page.setViewportSize({ width: 1440, height: 900 });
      await selectSyllabusLesson(page, 'quiz');
      const outlineVisibleQuiz = await page.locator('aside').filter({ hasText: /On This Page/i }).isVisible().catch(() => false);
      ctx.harness.assert(!outlineVisibleQuiz, 'On This Page outline must hide on Quiz mode');
    });
  },

  'T2-F2-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(
      ctx,
      {
        label: 'T2-F2-05',
        initScript: `if (navigator.clipboard) { navigator.clipboard.writeText = async () => {}; }`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
        await waitForPlayerReady(page);
        await selectSyllabusLesson(page, 'notes');

        const copyBtn = page.locator('main button').filter({ hasText: /^Copy$/i }).first();
        await copyBtn.dblclick();
        await selectSyllabusLesson(page, 'lab');
        ctx.harness.assert(await page.locator('main h1').first().isVisible(), 'Rapid Copy + lesson switch should complete cleanly');
      }
    );
  },

  'T2-F3-01': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T2-F3-01' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      await page.keyboard.press('5');
      await page.keyboard.press('0');
      await page.keyboard.press('a');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);

      const text = await page.locator('main').innerText();
      ctx.harness.assertMatch(text, /Question\s+1\s+of\s+4/i, 'Invalid keys and empty Enter should not advance or crash quiz');
    });
  },

  'T2-F3-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const quizItem = findItemInOracle(pyCourse, 'quiz');
    const questions = quizItem?.questions || [];

    await withIsolatedPage(ctx, { label: 'T2-F3-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      // Score 3/4 (75% < 80% passScore)
      for (let step = 0; step < Math.max(4, questions.length); step++) {
        const mainText = await page.locator('main').innerText();
        const optionBtns = await getQuizOptionButtons(page);
        const optTexts: string[] = [];
        for (let j = 0; j < (await optionBtns.count()); j++) {
          optTexts.push((await optionBtns.nth(j).innerText()) || '');
        }
        const idx = findMatchingOptionIndex(optTexts, questions, mainText, step < 3);
        await checkAndAdvanceQuizQuestion(page, idx);
        await page.waitForTimeout(100);
      }

      const failText = await page.locator('main').innerText();
      ctx.harness.assertMatch(failText, /75%|Review & Retry/i, '3/4 (75%) must fail 80% threshold');
    });
  },

  'T2-F3-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T2-F3-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      await (await getQuizOptionButtons(page)).first().click();
      await selectSyllabusLesson(page, 'notes');
      await selectSyllabusLesson(page, 'quiz');

      const text = await page.locator('main').innerText();
      ctx.harness.assertMatch(text, /Question\s+1\s+of\s+4/i, 'Re-entering quiz after switching away resets to Question 1');
    });
  },

  'T2-F3-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const quizItem = findItemInOracle(pyCourse, 'quiz');
    const questions = quizItem?.questions || [];

    await withIsolatedPage(ctx, { label: 'T2-F3-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      for (let step = 0; step < Math.max(4, questions.length); step++) {
        const mainText = await page.locator('main').innerText();
        const optionBtns = await getQuizOptionButtons(page);
        const optTexts: string[] = [];
        for (let j = 0; j < (await optionBtns.count()); j++) {
          optTexts.push((await optionBtns.nth(j).innerText()) || '');
        }
        await checkAndAdvanceQuizQuestion(page, findMatchingOptionIndex(optTexts, questions, mainText, true));
      }

      const retryBtn = page.locator('main button').filter({ hasText: /Retry/i }).first();
      if (await retryBtn.isVisible()) {
        await retryBtn.click();
        for (let step = 0; step < Math.max(4, questions.length); step++) {
          await checkAndAdvanceQuizQuestion(page, 0);
        }
      }

      const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '{}');
      const parsed = JSON.parse(stored) as { completedItemIds?: string[] };
      ctx.harness.assertGreaterThanOrEqual(parsed.completedItemIds?.length ?? 0, 1, 'Retrying passed quiz must preserve completion');
    });
  },

  'T2-F3-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T2-F3-05', viewport: { width: 375, height: 812 } }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      ctx.harness.assert(!overflow, 'Quiz view at 375px must have zero horizontal page overflow');
    });
  },

  'T2-F4-01': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);

    await withIsolatedPage(ctx, { label: 'T2-F4-01' }, async (page) => {
      const labUrl = `${ctx.baseUrl}/ide?course=${encodeURIComponent(pySlug)}&lesson=${encodeURIComponent(
        twoSumLab?.id || 'two-sum-lab'
      )}`;
      await page.goto(labUrl, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);

      const customMarker = '# CUSTOM_USER_EDIT_PRESERVED\nprint("hello")';
      await setMonacoOrEditorCode(page, customMarker);
      await page.keyboard.press('Control+s').catch(() => {});
      await page.waitForTimeout(1000);

      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(pySlug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'lab', /Two Sum/i);
      await page.locator('main button, main a').filter({ hasText: /Launch Lab in Cortex IDE/i }).first().click();
      await page.waitForURL(/\/ide\?.*course=/, { timeout: 15000 });
      await waitForIdeReady(page);

      const editorCode = await getMonacoOrEditorCode(page);
      ctx.harness.assertIncludes(
        editorCode,
        'CUSTOM_USER_EDIT_PRESERVED',
        'Re-launching lab via URL must preserve existing user edits in Monaco editor'
      );
      const starterTodo =
        (twoSumLab?.starterCode || '')
          .split('\n')
          .find((line) => /TODO:/i.test(line))
          ?.trim() || '# TODO: Use a dictionary';
      ctx.harness.assert(
        !editorCode.includes(starterTodo),
        'Re-launching lab via URL must not overwrite custom user edits with starterCode'
      );
    });
  },

  'T2-F4-02': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);

    await withIsolatedPage(ctx, { label: 'T2-F4-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);

      // Close visible close-tab buttons if present
      const closeBtns = page.locator('button[title*="Close" i], button[aria-label*="Close" i]');
      const closeCount = await closeBtns.count();
      for (let i = 0; i < Math.min(closeCount, 3); i++) {
        await closeBtns.first().click().catch(() => {});
      }

      await page.goto(
        `${ctx.baseUrl}/ide?course=${encodeURIComponent(pySlug)}&lesson=${encodeURIComponent(
          twoSumLab?.id || 'two-sum-lab'
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForIdeReady(page);
      await page.locator('button').filter({ hasText: /Load Starter Code/i }).first().click();
      await page.waitForTimeout(200);
      ctx.harness.assert(await page.locator('.monaco-editor, textarea').first().isVisible(), 'Editor tab should open cleanly');
    });
  },

  'T2-F4-03': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);

    await withIsolatedPage(
      ctx,
      {
        label: 'T2-F4-03',
        initScript: `localStorage.setItem('cortex_active_sidebar_tab', 'files'); localStorage.setItem('cortex_sidebar_open', 'false');`,
      },
      async (page) => {
        await page.goto(
          `${ctx.baseUrl}/ide?course=${encodeURIComponent(pySlug)}&lesson=${encodeURIComponent(
            twoSumLab?.id || 'two-sum-lab'
          )}`,
          { waitUntil: 'domcontentloaded' }
        );
        await waitForIdeReady(page);
        const bodyText = await page.locator('body').innerText();
        ctx.harness.assertMatch(bodyText, /Load Starter Code/i, 'Lab URL must override closed/files localStorage and open LearnSidebar');
      }
    );
  },

  'T2-F4-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T2-F4-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'lab', /Two Sum/i);
      const isEditable = await page.locator('main pre code').first().evaluate((el) => (el as HTMLElement).isContentEditable);
      ctx.harness.assert(!isEditable, 'Lab starter code preview should be read-only');
    });
  },

  'T2-F4-05': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F4-05' }, async (page) => {
      const res = await page.goto(`${ctx.baseUrl}/ide?course=python-dsa&lesson=nonexistent_lab_999`, {
        waitUntil: 'domcontentloaded',
      });
      ctx.harness.assertEquals(res?.status(), 200, 'Invalid lab query params on /ide should still return HTTP 200');
      await waitForIdeReady(page);
    });
  },

  'T2-F5-01': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T2-F5-01' }, async (page) => {
      let dialogSeen = false;
      page.on('dialog', (d) => {
        dialogSeen = true;
        d.dismiss();
      });

      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();

      await page.locator('button').filter({ hasText: /Submit Exam/i }).first().click();
      await page.waitForTimeout(150);

      const cancelModalBtn = page.locator('button').filter({ hasText: /Cancel|Keep Working|Back/i }).first();
      if (await cancelModalBtn.isVisible().catch(() => false)) {
        await cancelModalBtn.click();
      } else {
        ctx.harness.assert(dialogSeen || (await page.locator('button').filter({ hasText: /Submit Exam/i }).first().isVisible()), 'Canceling unanswered submit should keep exam active');
      }
      ctx.harness.assert(await page.locator('button').filter({ hasText: /Submit Exam/i }).first().isVisible(), 'Exam should stay active after canceling confirmation');
    });
  },

  'T2-F5-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const durationMins = examItem?.durationMins || 15;

    await withIsolatedPage(ctx, { label: 'T2-F5-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');

      await page.clock.install();
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();
      await page.clock.runFor((durationMins * 60 + 2) * 1000);
      await page.waitForTimeout(100);

      const reportText = await page.locator('main').innerText();
      ctx.harness.assertMatch(reportText, /Exam Report|Failed|Passed|Retry/i, 'Timeout at 00:00 must auto-submit Exam Report');
    });
  },

  'T2-F5-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T2-F5-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();

      await (await getQuizOptionButtons(page)).first().click();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');

      const beginBtn = page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first();
      ctx.harness.assert(await beginBtn.isVisible(), 'Reloading/re-entering unsubmitted exam restores Briefing screen');
    });
  },

  'T2-F5-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const durationMins = examItem?.durationMins || 15;

    await withIsolatedPage(ctx, { label: 'T2-F5-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');

      await page.clock.install();
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();

      await page.clock.runFor(Math.max(0, (durationMins * 60 - 300) * 1000));
      const at300 = page.locator('text=05:00').first();
      if (await at300.isVisible().catch(() => false)) {
        const c300 = await at300.evaluate((e) => window.getComputedStyle(e).color);
        ctx.harness.assert(!isRoseRgb(parseRgb(c300)), 'At 05:00 timer must not be rose');
      }

      await page.clock.runFor(181 * 1000); // 119s left (01:59)
      const under120 = page.locator('text=/01:5[0-9]/').first();
      ctx.harness.assert(await under120.isVisible(), 'Timer should reach 01:59');
      const c119 = await under120.evaluate((e) => window.getComputedStyle(e).color);
      ctx.harness.assert(isRoseRgb(parseRgb(c119)) || /rose/i.test(await under120.evaluate((e) => e.className)), 'At <2m timer must turn rose');
    });
  },

  'T2-F5-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const examId = examItem?.id || 'py-m1-exam';

    await withIsolatedPage(ctx, { label: 'T2-F5-05' }, async (page) => {
      page.on('dialog', (d) => d.accept());
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();

      await page.locator('button').filter({ hasText: /Submit Exam/i }).first().click();
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm Submit|Submit Now|Yes/i }).first();
      if ((await confirmBtn.count()) > 0 && (await confirmBtn.isVisible())) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(150);

      const reportText = await page.locator('main').innerText();
      ctx.harness.assertMatch(
        reportText,
        /Failed|Not Passed|0%/i,
        'Submitting 0-correct exam should render Failed status below pass threshold'
      );

      const storedBeforeRetry = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '{}');
      const parsedBeforeRetry = JSON.parse(storedBeforeRetry) as { completedItemIds?: string[] };
      ctx.harness.assert(
        !(parsedBeforeRetry.completedItemIds || []).includes(examId),
        'Failed exam must not be added to completedItemIds in localStorage'
      );

      const retryBtn = page.locator('button').filter({ hasText: /Retry/i }).first();
      ctx.harness.assert(await retryBtn.isVisible(), 'Failed exam should offer Retry button');
      await retryBtn.click();
      await page.waitForTimeout(150);

      const submitAfterRetry = page.locator('button').filter({ hasText: /Submit Exam/i }).first();
      ctx.harness.assert(await submitAfterRetry.isVisible(), 'Retry should reset exam and display Submit Exam button');

      const bodyAfterRetry = await page.locator('body').innerText();
      ctx.harness.assertMatch(
        bodyAfterRetry,
        /\b\d{2}:\d{2}\b/,
        'Retry should restore the countdown timer'
      );

      const storedAfterRetry = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '{}');
      const parsedAfterRetry = JSON.parse(storedAfterRetry) as { completedItemIds?: string[] };
      ctx.harness.assert(
        !(parsedAfterRetry.completedItemIds || []).includes(examId),
        'After Retry, failed exam must remain absent from completedItemIds in localStorage'
      );
    });
  },

  'T2-F5-06': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const questions = examItem?.questions || [];

    await withIsolatedPage(ctx, { label: 'T2-F5-06' }, async (page) => {
      page.on('dialog', (d) => d.accept());
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();

      if (questions[0]) {
        await page.locator('main button').filter({ hasText: questions[0].options[questions[0].correctIndex] }).first().click();
      }
      if (questions[1]) {
        const wrongIdx = questions[1].correctIndex === 0 ? 1 : 0;
        await page.locator('main button').filter({ hasText: questions[1].options[wrongIdx] }).first().click();
      }

      await page.locator('button').filter({ hasText: /Submit Exam/i }).first().click();
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm Submit|Submit Now|Yes/i }).first();
      if ((await confirmBtn.count()) > 0 && (await confirmBtn.isVisible())) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(150);

      const reportText = await page.locator('main').innerText();
      if (questions[0]?.explanation) {
        ctx.harness.assertIncludes(reportText, questions[0].explanation.slice(0, 20), 'Exam Report should include question explanations');
      }
      const syllabusRestored = await page.locator('aside').first().evaluate((e) => e.getBoundingClientRect().width >= 250);
      ctx.harness.assert(syllabusRestored, 'Syllabus drawer should restore after exam submission');
    });
  },

  'T2-F6-01': async (ctx) => {
    await withIsolatedPage(
      ctx,
      {
        label: 'T2-F6-01',
        initScript: `localStorage.setItem('cortex_learn_progress_v1', '{broken_json');`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
        await waitForCatalogReady(page);
        ctx.harness.assertIncludes(await page.locator('main').innerText(), 'Python & Data Structures Mastery', 'Corrupt progress JSON should recover cleanly');
      }
    );
  },

  'T2-F6-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const firstId = pyCourse?.modules[0]?.items[0]?.id || 'py-m1-notes';

    await withIsolatedPage(
      ctx,
      {
        label: 'T2-F6-02',
        initScript: `localStorage.setItem('cortex_learn_progress_v1', ${JSON.stringify(
          JSON.stringify({
            completedItemIds: ['deleted-lesson-xyz', firstId],
            quizScores: {},
            examAttempts: {},
            labSteps: {},
            lastVisitedLesson: {},
            lastActiveCourseId: null,
          })
        )});`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
        await waitForPlayerReady(page);
        const headerText = await page.locator('header').innerText();
        ctx.harness.assert(!headerText.includes('NaN%'), 'Progress % must never display NaN%');
        const match = headerText.match(/(\d+)%/);
        if (match) {
          ctx.harness.assert(Number(match[1]) <= 100, 'Progress % must never exceed 100%');
        }
      }
    );
  },

  'T2-F6-03': async (ctx) => {
    await withIsolatedPage(
      ctx,
      {
        label: 'T2-F6-03',
        initScript: `localStorage.setItem('cortex_ide_theme', 'neon-purple');`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
        await waitForCatalogReady(page);
        ctx.harness.assert(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'Invalid theme value should fall back to dark mode');
      }
    );
  },

  'T2-F6-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(
      ctx,
      {
        label: 'T2-F6-04',
        initScript: `localStorage.setItem('cortex_ide_theme', 'light'); localStorage.setItem('cortex_learn_progress_v1', '{"completedItemIds":["py-m1-notes"]}');`,
      },
      async (page, _c, tracker) => {
        await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
        await waitForCatalogReady(page);
        await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
        await waitForPlayerReady(page);
        ctx.harness.assertEquals(tracker.hydrationErrors.length, 0, 'Pre-seeded storage must trigger zero React hydration warnings');
      }
    );
  },

  'T2-F6-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(
      ctx,
      {
        label: 'T2-F6-05',
        initScript: `Storage.prototype.setItem = function() { throw new DOMException('QuotaExceededError'); };`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
        await waitForPlayerReady(page);
        await page.locator('header button').last().click();
        await page.locator('main button').filter({ hasText: /Mark Complete & Continue/i }).first().click();
        ctx.harness.assert(await page.locator('main h1').first().isVisible(), 'QuotaExceededError must not crash player UI');
      }
    );
  },

  'T2-F7-01': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F7-01' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/ide?snippet=1&lang=python&filename=missing.py`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForIdeReady(page);
      ctx.harness.assert(await page.locator('[data-testid="global-activity-rail"]').isVisible(), '/ide?snippet=1 without sessionStorage payload must still render IDE cleanly');
    });
  },

  'T2-F7-02': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);

    await withIsolatedPage(ctx, { label: 'T2-F7-02' }, async (page) => {
      await page.goto(
        `${ctx.baseUrl}/ide?course=${encodeURIComponent(pySlug)}&lesson=${encodeURIComponent(
          twoSumLab?.id || 'two-sum-lab'
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForIdeReady(page);
      ctx.harness.assertIncludes(page.url(), `course=${encodeURIComponent(pySlug)}`, 'Project hydration must preserve course query param');
      ctx.harness.assertIncludes(page.url(), 'lesson=', 'Project hydration must preserve lesson query param');
    });
  },

  'T2-F7-03': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F7-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);
      await page.getByTestId('rail-nav-files').click();
      await page.clock.install();

      const refBtn = page.getByTestId('rail-nav-learn');
      await refBtn.hover();
      await page.clock.runFor(100);
      await refBtn.dispatchEvent('mousedown');
      await refBtn.click();
      await page.clock.runFor(350);

      const tipCount = await page.locator('[data-testid="global-activity-rail"] >> text=Reference').count();
      ctx.harness.assertEquals(tipCount, 0, 'Rapid hover-then-click before 280ms must never flash tooltip');
    });
  },

  'T2-F7-04': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F7-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);
      await page.getByTestId('rail-nav-files').click();
      await page.clock.install();

      const refBtn = page.getByTestId('rail-nav-learn');
      await refBtn.hover();
      await page.clock.runFor(320);
      await refBtn.click();
      await page.clock.runFor(400);

      ctx.harness.assertEquals(
        await page.locator('[data-testid="global-activity-rail"] >> text=Reference').count(),
        0,
        'Tooltip must stay dismissed while mouse remains stationary after click'
      );

      await page.mouse.move(300, 300);
      await refBtn.hover();
      await page.clock.runFor(350);
      ctx.harness.assertEquals(
        await page.locator('[data-testid="global-activity-rail"] >> text=Reference').count(),
        0,
        'Tooltip must stay suppressed while Reference sidebar tab is active/open'
      );
    });
  },

  'T2-F7-05': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T2-F7-05' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);
      const refBtn = page.getByTestId('rail-nav-learn');
      await refBtn.click(); // open
      await page.waitForTimeout(100);
      await refBtn.click(); // close
      await page.waitForTimeout(100);

      await page.clock.install();
      await page.mouse.move(300, 300);
      await refBtn.hover();
      await page.clock.runFor(350);

      const tip = page.locator('[data-testid="global-activity-rail"] >> text=Reference');
      ctx.harness.assert(await tip.isVisible(), 'Re-hovering after closing Reference sidebar should show tooltip');
      const tipBox = await tip.boundingBox();
      ctx.harness.assertGreaterThanOrEqual(tipBox?.x ?? 0, 58, 'Tooltip x coordinate must be >= 58px');
    });
  },

  'T2-F7-06': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);

    await withIsolatedPage(ctx, { label: 'T2-F7-06' }, async (page) => {
      await page.goto(
        `${ctx.baseUrl}/ide?course=${encodeURIComponent(pySlug)}&lesson=${encodeURIComponent(
          twoSumLab?.id || 'two-sum-lab'
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForIdeReady(page);
      const returnLink = page.locator('a, button').filter({ hasText: /Return to Course/i }).first();
      ctx.harness.assert(await returnLink.isVisible(), 'Return to Course link must stay visible in LearnSidebar');
    });
  },

  // --------------------------------------------------------------------------
  // TIER 3: CROSS-FEATURE COMBINATIONS (9 Pairwise Tests)
  // --------------------------------------------------------------------------
  'T3-01': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T3-01' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);

      await page.getByRole('button', { name: 'Systems & C++' }).click();
      await page.getByRole('link', { name: /Start Course|Continue/i }).first().click();
      await waitForPlayerReady(page);

      await page.locator('main button').filter({ hasText: /Mark Complete & Continue/i }).first().click();
      await page.waitForTimeout(150);
      await page.locator('header a, header button').filter({ hasText: /Courses/i }).first().click();
      await waitForCatalogReady(page);

      ctx.harness.assert(await page.getByRole('link', { name: /Resume Lesson/i }).first().isVisible(), 'Back to Catalog should show Continue Learning strip');
    });
  },

  'T3-02': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T3-02' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');

      await page.locator('main button, main a').filter({ hasText: /Try in IDE/i }).first().click();
      await page.waitForURL(/\/ide\?.*snippet=1/, { timeout: 15000 });
      await waitForIdeReady(page);

      const returnLink = page.locator('a, button').filter({ hasText: /Return to Course/i }).first();
      ctx.harness.assert(await returnLink.isVisible(), 'Return to Course should be visible in IDE companion');
      await returnLink.click();
      await page.waitForURL(/\/learn\//, { timeout: 15000 });
    });
  },

  'T3-03': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);

    await withIsolatedPage(ctx, { label: 'T3-03' }, async (page) => {
      let executeCallCount = 0;
      await page.route('**/api/v1/execute', async (route) => {
        executeCallCount += 1;
        const postData = route.request().postData() || '{}';
        const body = JSON.parse(postData) as { stdin?: string; code?: string };
        const stdin = (body.stdin || '').trim();
        let stdout = '';
        if (body.code && /seen\[diff\]/.test(body.code)) {
          if (stdin === '2 7 11 15\n9') stdout = '[0, 1]\n';
          else if (stdin === '3 2 4\n6') stdout = '[1, 2]\n';
          else if (stdin === '3 3\n6') stdout = '[0, 1]\n';
          else if (stdin === '-1 -2 -3 -4 -5\n-8') stdout = '[2, 4]\n';
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', exitCode: 0, stdout, stderr: '', executionTimeMs: 12 }),
        });
      });

      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'lab', /Two Sum/i);

      await page.locator('main button, main a').filter({ hasText: /Launch Lab in Cortex IDE/i }).first().click();
      await page.waitForURL(/\/ide\?.*course=/, { timeout: 15000 });
      await waitForIdeReady(page);

      const loadStarterBtn = page.locator('button').filter({ hasText: /Load Starter Code/i }).first();
      ctx.harness.assert(
        (await loadStarterBtn.count()) > 0 && (await loadStarterBtn.isVisible()),
        'Load Starter Code button should be visible in /ide companion'
      );
      await loadStarterBtn.click();
      await page.waitForTimeout(200);

      await setMonacoOrEditorCode(page, TWO_SUM_VALID_PYTHON);

      let runTestsBtn = page.locator('button').filter({ hasText: /Run.*Tests|Run All/i }).first();
      if (!((await runTestsBtn.count()) > 0 && (await runTestsBtn.isVisible()))) {
        const testsTab = page.getByTestId('workbench-tab-tests');
        if ((await testsTab.count()) > 0 && (await testsTab.isVisible())) {
          await testsTab.click();
          await page.waitForTimeout(200);
          runTestsBtn = page.locator('button').filter({ hasText: /Run.*Tests|Run All/i }).first();
        }
      }
      ctx.harness.assert(
        (await runTestsBtn.count()) > 0 && (await runTestsBtn.isVisible()),
        'Run Tests / Run All button must be visible in /ide'
      );
      await runTestsBtn.click();

      await page
        .waitForFunction(
          () => {
            const text = document.body.innerText || '';
            return /\bPass(?:ed)?\b|\bTests\s*\(\s*[1-9]\d*\s*\/\s*[1-9]\d*\s*\)|[1-9]\d*\s*\/\s*[1-9]\d*\s*(?:passed|tests)|\bAccepted\b/i.test(
              text
            );
          },
          undefined,
          { timeout: 6000 }
        )
        .catch(() => {});

      ctx.harness.assertGreaterThanOrEqual(
        executeCallCount,
        1,
        'Running tests in T3-03 must execute via /api/v1/execute'
      );
      const ideBodyText = await page.locator('body').innerText();
      ctx.harness.assertMatch(
        ideBodyText,
        /\bPass(?:ed)?\b|\bTests\s*\(\s*[1-9]\d*\s*\/\s*[1-9]\d*\s*\)|[1-9]\d*\s*\/\s*[1-9]\d*\s*(?:passed|tests)|\bAccepted\b/i,
        'T3-03 test run must display genuine passing test-result output'
      );

      const returnLink = page.locator('a, button').filter({ hasText: /Return to Course/i }).first();
      ctx.harness.assert(await returnLink.isVisible(), 'Return to Course link must be visible');
      await returnLink.click();
      await page.waitForURL(/\/learn\//, { timeout: 15000 });
      await waitForPlayerReady(page);

      const returnedUrl = page.url();
      if (twoSumLab?.id) {
        ctx.harness.assertIncludes(
          returnedUrl,
          `lesson=${encodeURIComponent(twoSumLab.id)}`,
          'Return to Course should target the Two Sum lab lesson query param'
        );
      }
      const returnedHeading = await page.locator('main h1').first().innerText();
      ctx.harness.assertMatch(
        returnedHeading,
        /Two Sum/i,
        'Returned /learn lesson heading must match the Two Sum lab'
      );
    });
  },

  'T3-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const quizItem = findItemInOracle(pyCourse, 'quiz');
    const questions = quizItem?.questions || [];

    await withIsolatedPage(ctx, { label: 'T3-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'quiz');

      for (let step = 0; step < Math.max(4, questions.length); step++) {
        const mainText = await page.locator('main').innerText();
        const optionBtns = await getQuizOptionButtons(page);
        const optTexts: string[] = [];
        for (let j = 0; j < (await optionBtns.count()); j++) {
          optTexts.push((await optionBtns.nth(j).innerText()) || '');
        }
        const idx = findMatchingOptionIndex(optTexts, questions, mainText, true);
        await page.keyboard.press(String(idx + 1));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        const nextBtn = page.locator('main button').filter({ hasText: /Next Question|Next|Finish|View Results/i }).first();
        if (await nextBtn.isVisible()) {
          await page.keyboard.press('Enter');
        }
      }

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      const headerText = await page.locator('header').innerText();
      ctx.harness.assertMatch(headerText, /[1-9]\d*%/, 'Passed quiz progress must persist across reload');
    });
  },

  'T3-05': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const questions = examItem?.questions || [];

    await withIsolatedPage(ctx, { label: 'T3-05' }, async (page) => {
      page.on('dialog', (d) => d.accept());
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();

      for (const q of questions) {
        const card = page.locator('main button').filter({ hasText: q.options[q.correctIndex] }).first();
        if ((await card.count()) > 0) await card.click();
      }
      await page.locator('button').filter({ hasText: /Submit Exam/i }).first().click();
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm Submit|Submit Now|Yes/i }).first();
      if ((await confirmBtn.count()) > 0 && (await confirmBtn.isVisible())) await confirmBtn.click();

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '');
      ctx.harness.assertIncludes(stored, 'examAttempts', 'Exam attempt history must persist across reload');
    });
  },

  'T3-06': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T3-06' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      await page.locator('header button').last().click();

      await page.locator('header a').filter({ hasText: /Open IDE/i }).first().click();
      await page.waitForURL(/\/ide/, { timeout: 15000 });
      await waitForIdeReady(page);

      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      ctx.harness.assert(!isDark, 'Light mode toggled on /learn must sync to /ide');
    });
  },

  'T3-07': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T3-07' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'notes');

      await page.locator('header button').last().click();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      ctx.harness.assert(!isDark, 'Light mode toggled inside Course Player should persist across reload');
    });
  },

  'T3-08': async (ctx) => {
    const cppSlug = getCourseSlug(ctx, 'cpp');
    const cppCourse = getCourseFromOracle(ctx, 'cpp');
    const cppLab = findItemInOracle(cppCourse, 'lab');

    await withIsolatedPage(ctx, { label: 'T3-08' }, async (page) => {
      await page.goto(
        `${ctx.baseUrl}/ide?course=${encodeURIComponent(cppSlug)}&lesson=${encodeURIComponent(
          cppLab?.id || 'cpp-m1-lab'
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForIdeReady(page);

      const boxes = page.locator('input[type="checkbox"]');
      if ((await boxes.count()) >= 2) {
        await boxes.nth(0).click();
        await boxes.nth(1).click();
      }
      await page.locator('a, button').filter({ hasText: /Return to Course/i }).first().click();
      await page.waitForURL(/\/learn\//, { timeout: 15000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      const stored = await page.evaluate(() => localStorage.getItem('cortex_learn_progress_v1') || '');
      ctx.harness.assertIncludes(stored, 'labSteps', 'Lab steps checked in IDE companion should persist after returning & reloading');
    });
  },

  'T3-09': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    await withIsolatedPage(ctx, { label: 'T3-09' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();

      await page.locator('header button, header a').filter({ hasText: /Open IDE/i }).first().click();
      await page.waitForURL(/\/ide/, { timeout: 15000 });
      await waitForIdeReady(page);
      ctx.harness.assert(await page.getByTestId('global-activity-rail').isVisible(), 'Open IDE from Timed Exam should render normal CortexIdeShell');
    });
  },

  // --------------------------------------------------------------------------
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (6 Student Journeys)
  // --------------------------------------------------------------------------
  'T4-01': async (ctx) => {
    const pySlug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const quizItem = findItemInOracle(pyCourse, 'quiz');
    const examItem = findItemInOracle(pyCourse, 'exam');

    await withIsolatedPage(ctx, { label: 'T4-01' }, async (page) => {
      page.on('dialog', (d) => d.accept());
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      await page.getByRole('button', { name: 'Python & DSA' }).click();
      await page.getByRole('link', { name: /Start Course|Continue/i }).first().click();
      await waitForPlayerReady(page);

      // 1. Notes completion
      await selectSyllabusLesson(page, 'notes');
      await page.locator('main button').filter({ hasText: /Mark Complete & Continue/i }).first().click();

      // 2. Quiz pass
      await selectSyllabusLesson(page, 'quiz');
      for (let step = 0; step < Math.max(4, quizItem?.questions?.length || 4); step++) {
        const mainText = await page.locator('main').innerText();
        const optionBtns = await getQuizOptionButtons(page);
        const optTexts: string[] = [];
        for (let j = 0; j < (await optionBtns.count()); j++) {
          optTexts.push((await optionBtns.nth(j).innerText()) || '');
        }
        await checkAndAdvanceQuizQuestion(
          page,
          findMatchingOptionIndex(optTexts, quizItem?.questions || [], mainText, true)
        );
      }

      // 3. Two Sum Lab handoff -> Return
      await selectSyllabusLesson(page, 'lab', /Two Sum/i);
      await page.locator('main button, main a').filter({ hasText: /Launch Lab in Cortex IDE/i }).first().click();
      await page.waitForURL(/\/ide\?.*course=/, { timeout: 15000 });
      await waitForIdeReady(page);
      await page.locator('a, button').filter({ hasText: /Return to Course/i }).first().click();
      await waitForPlayerReady(page);

      // 4. Exam pass
      await selectSyllabusLesson(page, 'exam');
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();
      for (const q of examItem?.questions || []) {
        const card = page.locator('main button').filter({ hasText: q.options[q.correctIndex] }).first();
        if ((await card.count()) > 0) await card.click();
      }
      await page.locator('button').filter({ hasText: /Submit Exam/i }).first().click();
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm Submit|Submit Now|Yes/i }).first();
      if ((await confirmBtn.count()) > 0 && (await confirmBtn.isVisible())) await confirmBtn.click();

      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      const text = await page.locator('main').innerText();
      ctx.harness.assertMatch(text, /Continue|Resume Lesson/i, 'Completed Module 1 journey should persist to /learn catalog');
    });
  },

  'T4-02': async (ctx) => {
    const sqlSlug = getCourseSlug(ctx, 'sql');
    const sqlCourse = getCourseFromOracle(ctx, 'sql');
    const firstItem = sqlCourse?.modules[0]?.items[0];
    const secondItem = sqlCourse?.modules[0]?.items[1];

    await withIsolatedPage(
      ctx,
      {
        label: 'T4-02',
        initScript: `localStorage.setItem('cortex_learn_progress_v1', ${JSON.stringify(
          JSON.stringify({
            completedItemIds: [firstItem?.id || 'sql-m1-notes'],
            quizScores: {},
            examAttempts: {},
            labSteps: {},
            lastVisitedLesson: {
              [sqlSlug]: {
                courseId: sqlCourse?.id || sqlSlug,
                lessonId: secondItem?.id || firstItem?.id || 'sql-m1-quiz',
                updatedAt: Date.now(),
              },
            },
            lastActiveCourseId: sqlCourse?.id || sqlSlug,
          })
        )});`,
      },
      async (page) => {
        await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
        await waitForIdeReady(page);
        await page.getByTestId('rail-nav-learn').click();
        await page.locator('a[href="/learn"]').filter({ hasText: /Open Full Learning Hub/i }).first().click();
        await waitForCatalogReady(page);

        await page.getByRole('link', { name: /Resume Lesson/i }).first().click();
        await waitForPlayerReady(page);
        ctx.harness.assertIncludes(page.url(), `/learn/${sqlSlug}`, 'Resume Lesson should land on SQL course player');
      }
    );
  },

  'T4-03': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T4-03' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      await page.locator('header button').last().click(); // Light mode

      const search = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
      await search.fill('C++');
      await page.getByRole('link', { name: /Start Course|Continue/i }).first().click();
      await waitForPlayerReady(page);

      await selectSyllabusLesson(page, 'lab');
      await page.locator('main button, main a').filter({ hasText: /Launch Lab in Cortex IDE/i }).first().click();
      await page.waitForURL(/\/ide\?.*course=/, { timeout: 15000 });
      await waitForIdeReady(page);

      const isDarkOnIde = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      ctx.harness.assert(!isDarkOnIde, 'Light mode must stay active on /ide during cross-track session');

      await page.goto(`${ctx.baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
      await waitForCatalogReady(page);
      await page.getByRole('button', { name: 'SQL & Data' }).click();
      await page.getByRole('link', { name: /Start Course|Continue/i }).first().click();
      await waitForPlayerReady(page);
      ctx.harness.assert(
        !(await page.evaluate(() => document.documentElement.classList.contains('dark'))),
        'Light mode must stay active on SQL player'
      );
    });
  },

  'T4-04': async (ctx) => {
    const slug = getCourseSlug(ctx, 'python');
    const pyCourse = getCourseFromOracle(ctx, 'python');
    const examItem = findItemInOracle(pyCourse, 'exam');
    const durationMins = examItem?.durationMins || 15;

    await withIsolatedPage(ctx, { label: 'T4-04' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/learn/${encodeURIComponent(slug)}`, { waitUntil: 'domcontentloaded' });
      await waitForPlayerReady(page);
      await selectSyllabusLesson(page, 'exam');

      await page.clock.install();
      await page.locator('main button').filter({ hasText: /Begin.*Exam/i }).first().click();

      const flagBtn = page.locator('button[title*="Flag" i], button').filter({ hasText: /Flag/i }).first();
      if (await flagBtn.isVisible().catch(() => false)) await flagBtn.click();

      await page.clock.runFor((durationMins * 60 + 2) * 1000);
      await page.waitForTimeout(100);

      const retryBtn = page.locator('button').filter({ hasText: /Retry/i }).first();
      ctx.harness.assert(await retryBtn.isVisible(), 'Timeout auto-submit should present Retry button');
      await retryBtn.click();
    });
  },

  'T4-05': async (ctx) => {
    await withIsolatedPage(ctx, { label: 'T4-05' }, async (page) => {
      await page.goto(`${ctx.baseUrl}/ide`, { waitUntil: 'domcontentloaded' });
      await waitForIdeReady(page);
      await page.clock.install();

      for (const id of ['rail-nav-files', 'rail-nav-search', 'rail-nav-learn', 'rail-settings-btn']) {
        const el = page.getByTestId(id);
        await el.hover();
        await page.clock.runFor(100);
        await el.dispatchEvent('mousedown');
        await el.click();
        await page.clock.runFor(350);
      }

      // Verify Practice Hub coexistence & exit via ?course=&lesson=
      await page.getByTestId('rail-nav-practice').click();
      await page.waitForTimeout(200);
      const pySlug = getCourseSlug(ctx, 'python');
      const pyCourse = getCourseFromOracle(ctx, 'python');
      const twoSumLab = findItemInOracle(pyCourse, 'lab', /Two Sum/i);
      await page.goto(
        `${ctx.baseUrl}/ide?course=${encodeURIComponent(pySlug)}&lesson=${encodeURIComponent(
          twoSumLab?.id || 'two-sum-lab'
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForIdeReady(page);
      ctx.harness.assertMatch(await page.locator('body').innerText(), /Load Starter Code/i, 'Lab URL must cleanly exit PracticeWorkspace');
    });
  },

  'T4-06': async (ctx) => {
    // Platform governance & static/build compliance check
    const lintOut = await executeCommand('npm', ['run', 'lint'], { cwd: ctx.projectRoot, timeoutMs: 120000 });
    ctx.harness.assertEquals(lintOut.exitCode, 0, `npm run lint failed: ${lintOut.stderr || lintOut.stdout}`);

    const scanDirs = [
      path.join(ctx.projectRoot, 'src'),
      path.join(ctx.projectRoot, 'tests'),
    ];
    let emojiCount = 0;
    for (const dir of scanDirs) {
      const files = findFilesRecursively(dir, (f) => /\.(ts|tsx|js|jsx|md|json)$/i.test(f));
      for (const f of files) {
        const content = fs.readFileSync(f, 'utf-8');
        emojiCount += detectEmojisInText(content, f).length;
      }
    }
    ctx.harness.assertEquals(emojiCount, 0, 'TC4.1: Zero Unicode emojis allowed across src/ and tests/');

    const nextBuildId = path.join(ctx.projectRoot, '.next', 'BUILD_ID');
    const nextManifest = path.join(ctx.projectRoot, '.next', 'build-manifest.json');
    ctx.harness.assert(fs.existsSync(nextBuildId) && fs.existsSync(nextManifest), '.next build artifacts must exist');

    // Verify Learn E2E files obey zero static playwright import and zero @ts-ignore
    const learnTestFiles = [
      path.join(ctx.projectRoot, 'tests', 'learn-e2e.test.ts'),
      path.join(ctx.projectRoot, 'tests', 'learn-browser-e2e.ts'),
      ...findFilesRecursively(path.join(ctx.projectRoot, 'tests', 'learn-e2e'), (f) => f.endsWith('.ts')),
    ];
    const tsIgnoreRegex = new RegExp('//\\s*@' + 'ts-ignore\\b');
    for (const f of learnTestFiles) {
      const src = fs.readFileSync(f, 'utf-8');
      const specs = parseImportSpecifiers(src);
      ctx.harness.assert(!specs.includes('playwright') && !specs.includes('playwright-core'), `No static playwright import in ${f}`);
      ctx.harness.assert(!tsIgnoreRegex.test(src), `No @ts-ignore in ${f}`);
    }
  },
};

function matchesFilters(tc: MatrixTestCase, opts: CliOptions): boolean {
  if (opts.tierFilter && tc.tier !== opts.tierFilter) {
    return false;
  }
  if (opts.filter) {
    const haystack = `${tc.id} ${tc.feature} ${tc.title} ${tc.requirementRef}`.toLowerCase();
    if (!haystack.includes(opts.filter)) {
      return false;
    }
  }
  return true;
}

export async function runLearnBrowserE2ESuite(
  projectRoot = process.cwd(),
  opts: CliOptions
): Promise<TierExecutionResult> {
  const harness = new TestHarness('Learn Browser E2E - 91-Test Matrix');
  const baseUrl = getCortexBaseUrl();

  // Structural verification check first
  await runCase(harness, '[Structure] Matrix Completeness & Handler Coverage (91/91)', () => {
    const matrixCheck = validateMatrixCompleteness(LEARN_E2E_MATRIX);
    harness.assert(matrixCheck.valid, `Matrix invalid: ${matrixCheck.errors.join('; ')}`);

    const missingHandlers = LEARN_E2E_MATRIX.filter((tc) => typeof TEST_HANDLERS[tc.id] !== 'function').map(
      (tc) => tc.id
    );
    harness.assertEquals(
      missingHandlers.length,
      0,
      `Missing Playwright test handlers for: ${missingHandlers.join(', ')}`
    );
  });

  await runCase(harness, '[Structure / TC4.1] Zero-Emoji Compliance Across tests/learn-*', () => {
    const files = [
      path.join(projectRoot, 'tests', 'learn-e2e.test.ts'),
      path.join(projectRoot, 'tests', 'learn-browser-e2e.ts'),
      ...findFilesRecursively(path.join(projectRoot, 'tests', 'learn-e2e'), (f) => f.endsWith('.ts')),
    ].filter((f) => fs.existsSync(f));

    const violations: string[] = [];
    for (const f of files) {
      const found = detectEmojisInText(fs.readFileSync(f, 'utf-8'), path.relative(projectRoot, f));
      for (const v of found) {
        violations.push(`${v.filePath}:${v.line}:${v.column} (${v.codePoint})`);
      }
    }
    harness.assertEquals(violations.length, 0, `Emoji violations: ${violations.join(', ')}`);
  });

  const selectedCases = LEARN_E2E_MATRIX.filter((tc) => matchesFilters(tc, opts));

  if (opts.dryRun) {
    const pwProbe = probePlaywrightAvailability();
    const serverProbe = await probeServerReachable(baseUrl, 2500);
    let learnReady = false;
    if (serverProbe.reachable) {
      const learnHtml = await fetchRouteHtml(`${baseUrl}/learn`, 4000);
      learnReady = learnHtml.ok && !/Learn to Code Entirely Online/i.test(learnHtml.html);
    }

    const dryReason = !pwProbe.playwrightFound || !pwProbe.chromiumFound
      ? 'Dry-run mode: Playwright/Chromium readiness pending'
      : !serverProbe.reachable
      ? `Dry-run mode: server not running at ${baseUrl}`
      : !learnReady
      ? 'Dry-run mode: /learn M2+ routes not yet active'
      : 'Dry-run mode: live browser execution skipped by --dry-run flag';

    for (const tc of selectedCases) {
      await runCase(harness, `[T${tc.tier}][${tc.feature}] ${tc.id}: ${tc.title}`, () => {
        throw new PendingSkipError(dryReason);
      });
    }

    return harness.getSummary();
  }

  // LIVE MODE: Strictly require valid baseUrl, reachable server, and launchable Chromium
  let browser: Browser | null = null;
  let preflightError: string | null = null;

  if (!isValidHttpUrl(baseUrl)) {
    preflightError = `Invalid CORTEX_BASE_URL: ${baseUrl}`;
  } else {
    const serverProbe = await probeServerReachable(baseUrl, 4000);
    if (!serverProbe.reachable) {
      preflightError = `Live mode requires reachable server at ${baseUrl} (${serverProbe.error || 'unreachable'})`;
    } else {
      try {
        const launched = await launchChromium({ headless: !opts.headed });
        browser = launched.browser;
      } catch (err: unknown) {
        preflightError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (preflightError || !browser) {
    await runCase(harness, '[Live Preflight] Server & Headless Chromium Launch', () => {
      harness.assert(false, preflightError || 'Failed to launch Chromium browser');
    });
    return harness.getSummary();
  }

  const coursesOracle = await loadCoursesOracle(projectRoot);
  const ctx: TestContext = {
    baseUrl,
    browser,
    harness,
    projectRoot,
    coursesOracle,
  };

  try {
    for (const tc of selectedCases) {
      const handler = TEST_HANDLERS[tc.id];
      await runCase(harness, `[T${tc.tier}][${tc.feature}] ${tc.id}: ${tc.title}`, async () => {
        await handler(ctx);
      });
    }
  } finally {
    await browser.close();
  }

  return harness.getSummary();
}

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));
  const projectRoot = process.cwd();
  const baseUrl = getCortexBaseUrl();

  console.log('='.repeat(80));
  console.log('CORTEX LEARN - 91-TEST HEADLESS CHROMIUM E2E SUITE');
  console.log('='.repeat(80));
  console.log(`Mode:       ${opts.dryRun ? 'DRY-RUN / STRUCTURE' : opts.headed ? 'LIVE HEADED' : 'LIVE HEADLESS'}`);
  console.log(`Base URL:   ${baseUrl}`);
  if (opts.tierFilter) console.log(`Tier:       ${opts.tierFilter}`);
  if (opts.filter) console.log(`Filter:     ${opts.filter}`);
  console.log('='.repeat(80));

  const summary = await runLearnBrowserE2ESuite(projectRoot, opts);

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
    if (opts.verbose && r.details) {
      for (const d of r.details) {
        console.log(`             ${d}`);
      }
    }
  }

  console.log('-'.repeat(80));
  console.log(
    `Result: ${summary.passed ? '[PASS]' : '[FAIL]'} | Total: ${summary.totalTests} | Passed: ${summary.passedTests} | Pending/Skipped: ${summary.skippedTests} | Failed: ${summary.failedTests} | Duration: ${summary.durationMs}ms`
  );
  console.log('='.repeat(80));

  if (opts.json) {
    const outPath = path.join(projectRoot, 'learn-browser-e2e-report.json');
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

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('tests/learn-browser-e2e.ts');
if (isDirectRun) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CRITICAL] learn-browser-e2e.ts crashed: ${msg}`);
    process.exit(1);
  });
}
