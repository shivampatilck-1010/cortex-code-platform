import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { detectEmojisInText } from './test-utils';
import {
  COURSE_CATEGORIES,
  COURSE_TRACKS,
  COURSES,
  findLessonInCourse,
  flattenCourseLessons,
  getCourseByIdOrSlug,
  getCourseStats,
} from '../src/data/courses';
import { CHALLENGES } from '../src/lib/challenges/challenges-data';
import { getLanguageConfig } from '../src/config/languages';
import {
  computeCourseProgress,
  computeInProgressCourses,
  DEFAULT_LEARN_PROGRESS,
  LEARN_PROGRESS_STORAGE_KEY,
  loadLearnProgress,
  normalizeLearnProgress,
  reduceMarkItemCompleted,
  reduceRecordExamAttempt,
  reduceRecordQuizResult,
  reduceSetLastVisitedLesson,
  reduceToggleLabStep,
  saveLearnProgress,
} from '../src/hooks/useLearnProgress';
import type { LabLesson, NotesLesson, QuizLesson, ExamLesson } from '../src/types/learn';

function runSection(name: string, fn: () => void): void {
  fn();
  console.log(`[PASS] ${name}`);
}

function main(): void {
  const projectRoot = process.cwd();

  runSection('1. Catalog & Schema Integrity', () => {
    assert.deepEqual(COURSE_TRACKS, [
      'All Tracks',
      'Python & DSA',
      'Systems & C++',
      'SQL & Data',
      'AI & ML',
    ]);
    assert.deepEqual(COURSE_CATEGORIES, [
      'All Courses',
      'Data Structures',
      'Programming',
      'Machine Learning',
      'Data Science',
      'Web Development',
      'Databases & SQL',
      'Cyber Security',
      'Systems & C++',
    ]);
    assert.ok(COURSES.length >= 8, `Expected at least 8 courses across categories, got ${COURSES.length}`);

    const courseIds = new Set<string>();
    const courseSlugs = new Set<string>();
    const moduleIds = new Set<string>();
    const lessonIds = new Set<string>();
    const questionIds = new Set<string>();

    const bannedPlaceholderRegex = /\b(lorem|ipsum|placeholder|tbd)\b/i;

    for (const course of COURSES) {
      assert.ok(course.id.trim().length > 0);
      assert.ok(course.slug.trim().length > 0);
      assert.ok(!courseIds.has(course.id), `Duplicate course id: ${course.id}`);
      assert.ok(!courseSlugs.has(course.slug), `Duplicate course slug: ${course.slug}`);
      courseIds.add(course.id);
      courseSlugs.add(course.slug);

      assert.ok(course.estimatedHours > 0, `Course ${course.id} must have estimatedHours > 0`);
      assert.ok(course.category.trim().length > 0, `Course ${course.id} must define category`);
      assert.ok(course.instructor.trim().length > 0, `Course ${course.id} must define instructor`);
      assert.ok(course.instructorInit.trim().length > 0, `Course ${course.id} must define instructorInit`);
      assert.ok(course.poster, `Course ${course.id} must define studio poster metadata`);
      assert.ok(course.attribution, `Course ${course.id} must include attribution`);
      assert.ok(course.attribution.sourceName.trim().length > 0);
      assert.ok(course.attribution.license.trim().length > 0);
      assert.ok(course.modules.length > 0, `Course ${course.id} must have at least 1 module`);

      assert.equal(
        bannedPlaceholderRegex.test(`${course.title} ${course.description}`),
        false,
        `Placeholder prose detected in course ${course.id}`
      );

      for (const mod of course.modules) {
        assert.ok(!moduleIds.has(mod.id), `Duplicate module id: ${mod.id}`);
        moduleIds.add(mod.id);
        assert.ok(mod.items.length > 0, `Module ${mod.id} must have items`);

        for (const item of mod.items) {
          assert.ok(!lessonIds.has(item.id), `Duplicate lesson id: ${item.id}`);
          lessonIds.add(item.id);
          assert.ok(item.title.trim().length > 0);
          assert.equal(
            bannedPlaceholderRegex.test(item.title),
            false,
            `Placeholder text in lesson title ${item.id}`
          );

          if (item.type === 'notes') {
            const notes = item as NotesLesson;
            assert.ok(notes.readMins > 0);
            assert.ok(notes.tldr.length > 0);
            assert.ok(notes.sections.length > 0);
            assert.ok(notes.keyTakeaways.length > 0);

            for (const sec of notes.sections) {
              assert.ok(sec.id.trim().length > 0);
              assert.ok(sec.heading.trim().length > 0);
              assert.ok(sec.paragraphs.length > 0);
              for (const para of sec.paragraphs) {
                assert.equal(
                  bannedPlaceholderRegex.test(para),
                  false,
                  `Placeholder prose in section ${sec.id}`
                );
              }
              if (sec.codeBlock) {
                assert.equal(
                  getLanguageConfig(sec.codeBlock.language).id,
                  sec.codeBlock.language,
                  `Unsupported codeBlock language: ${sec.codeBlock.language}`
                );
              }
            }
          } else if (item.type === 'quiz' || item.type === 'exam') {
            const assessment = item as QuizLesson | ExamLesson;
            assert.ok(assessment.passScore > 0 && assessment.passScore <= 100);
            assert.ok(assessment.questions.length > 0);
            if (item.type === 'exam') {
              assert.ok((item as ExamLesson).durationMins > 0);
            }
            for (const q of assessment.questions) {
              assert.ok(!questionIds.has(q.id), `Duplicate question id: ${q.id}`);
              questionIds.add(q.id);
              assert.ok(q.prompt.trim().length > 0);
              assert.ok(q.options.length >= 2);
              assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length);
              assert.ok(q.explanation.trim().length > 0);
              if (q.codeSnippet) {
                assert.equal(
                  getLanguageConfig(q.codeSnippet.language).id,
                  q.codeSnippet.language,
                  `Unsupported codeSnippet language: ${q.codeSnippet.language}`
                );
              }
            }
          } else if (item.type === 'lab') {
            const lab = item as LabLesson;
            assert.ok(lab.estimatedMins > 0);
            assert.equal(
              getLanguageConfig(lab.language).id,
              lab.language,
              `Unsupported lab language: ${lab.language}`
            );
            assert.ok(lab.objective.trim().length > 0);
            assert.ok(lab.steps.length > 0);
            assert.ok(lab.starterCode.trim().length > 0);
            if (lab.ideProblemId) {
              const linked = CHALLENGES.find((c) => c.id === lab.ideProblemId);
              assert.ok(
                linked,
                `Lab ${lab.id} references missing challenge ${lab.ideProblemId}`
              );
            }
            if (lab.testCases) {
              assert.ok(lab.testCases.length > 0);
              for (const tc of lab.testCases) {
                assert.ok(tc.id.trim().length > 0);
                assert.equal(typeof tc.input, 'string');
                assert.ok(tc.expectedStdout.trim().length > 0);
              }
            }
          }
        }
      }
    }
  });

  runSection('2. Course-Specific Curriculum & Starter Code Contracts', () => {
    const pyCourse = getCourseByIdOrSlug('python-dsa');
    assert.ok(pyCourse);
    assert.equal(pyCourse.slug, 'python-dsa-mastery');
    assert.equal(pyCourse.track, 'Python & DSA');
    assert.equal(pyCourse.level, 'Beginner');
    assert.equal(pyCourse.modules.length, 2);

    const pyMod1Quiz = findLessonInCourse(pyCourse, 'py-m1-quiz')?.item as QuizLesson;
    assert.equal(pyMod1Quiz.type, 'quiz');
    assert.equal(pyMod1Quiz.questions.length, 4);

    const twoSumLab = findLessonInCourse(pyCourse, 'py-m1-lab')?.item as LabLesson;
    assert.equal(twoSumLab.type, 'lab');
    assert.equal(twoSumLab.ideProblemId, 'two-sum');
    assert.equal(twoSumLab.language, 'python');
    assert.ok(twoSumLab.starterCode.includes('# TODO:'));
    assert.equal(
      twoSumLab.starterCode.includes('seen[diff]'),
      false,
      'Two Sum starterCode must NOT leak the pre-filled solution'
    );

    const pyExam = findLessonInCourse(pyCourse, 'py-m1-exam')?.item as ExamLesson;
    assert.equal(pyExam.type, 'exam');
    assert.equal(pyExam.durationMins, 15);
    assert.equal(pyExam.passScore, 75);
    assert.ok(pyExam.questions.length >= 5);

    const validParensLab = findLessonInCourse(pyCourse, 'py-m2-lab')?.item as LabLesson;
    assert.equal(validParensLab.type, 'lab');
    assert.equal(validParensLab.ideProblemId, 'valid-parentheses');
    assert.equal(validParensLab.language, 'python');
    assert.ok(validParensLab.starterCode.includes('# TODO:'));

    const cppCourse = getCourseByIdOrSlug('modern-cpp-systems');
    assert.ok(cppCourse);
    assert.equal(cppCourse.id, 'cpp-systems');
    assert.equal(cppCourse.track, 'Systems & C++');
    assert.equal(cppCourse.level, 'Intermediate');
    const cppLab = findLessonInCourse(cppCourse, 'cpp-m1-lab')?.item as LabLesson;
    assert.equal(cppLab.language, 'cpp');
    assert.ok(cppLab.starterCode.includes('// TODO:'));
    assert.ok(cppLab.testCases && cppLab.testCases.length >= 1);

    const sqlCourse = getCourseByIdOrSlug('sql-relational-design');
    assert.ok(sqlCourse);
    assert.equal(sqlCourse.id, 'sql-design');
    assert.equal(sqlCourse.track, 'SQL & Data');
    assert.equal(sqlCourse.level, 'Beginner');
    const sqlLab = findLessonInCourse(sqlCourse, 'sql-m1-lab')?.item as LabLesson;
    assert.equal(sqlLab.language, 'sql');
    assert.ok(sqlLab.starterCode.includes('-- TODO:'));
    assert.equal(
      /\nSELECT\b/i.test(sqlLab.starterCode),
      false,
      'SQL lab starterCode must not leak the SELECT answer'
    );
    assert.ok(sqlLab.testCases && sqlLab.testCases.length >= 1);
    assert.ok(sqlLab.testCases[0].expectedStdout.includes('|'));
  });

  runSection('3. Course Lookup & Stats Helpers', () => {
    assert.equal(getCourseByIdOrSlug(''), undefined);
    assert.equal(getCourseByIdOrSlug('non-existent'), undefined);
    assert.equal(getCourseByIdOrSlug('  python-dsa  ')?.slug, 'python-dsa-mastery');
    assert.equal(getCourseByIdOrSlug('modern-cpp-systems')?.id, 'cpp-systems');

    const pyCourse = getCourseByIdOrSlug('python-dsa')!;
    const flat = flattenCourseLessons(pyCourse);
    const stats = getCourseStats(pyCourse);
    assert.equal(stats.moduleCount, 2);
    assert.equal(stats.notesCount, 2);
    assert.equal(stats.quizCount, 2);
    assert.equal(stats.labCount, 2);
    assert.equal(stats.examCount, 1);
    assert.equal(stats.totalItems, flat.length);
    assert.equal(stats.totalItems, 7);

    const found = findLessonInCourse(pyCourse, 'py-m2-notes');
    assert.ok(found);
    assert.equal(found.moduleIndex, 1);
    assert.equal(found.flatIndex, 4);
    assert.equal(findLessonInCourse(pyCourse, 'missing-lesson'), undefined);
  });

  runSection('4. Zero-Emoji Governance Audit on M1 Files', () => {
    const filesToAudit = [
      'src/types/learn.ts',
      'src/data/courses/python-dsa.ts',
      'src/data/courses/cpp-systems.ts',
      'src/data/courses/sql-design.ts',
      'src/data/courses/extended-courses.ts',
      'src/data/courses/index.ts',
      'src/lib/execution/lab-runner.ts',
      'src/hooks/useCortexTheme.ts',
      'src/hooks/useLearnProgress.ts',
      'src/hooks/index.ts',
      'src/app/globals.css',
      'tests/learn-data.test.ts',
    ];

    for (const relPath of filesToAudit) {
      const fullPath = path.join(projectRoot, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const violations = detectEmojisInText(content, relPath);
      assert.equal(
        violations.length,
        0,
        `Found forbidden emoji in ${relPath}: ${JSON.stringify(violations)}`
      );
    }
  });

  runSection('5. Progress Normalization, Reducers & localStorage Mock Persistence', () => {
    // Resilience against invalid/malformed inputs
    assert.deepEqual(normalizeLearnProgress(null), DEFAULT_LEARN_PROGRESS);
    assert.deepEqual(normalizeLearnProgress('bad-string'), DEFAULT_LEARN_PROGRESS);
    const normalized = normalizeLearnProgress({
      completedItemIds: ['py-m1-notes', 'py-m1-notes', '', 42],
      labSteps: { 'py-m1-lab': [2, -1, 0, 2] },
      quizScores: {
        'py-m1-quiz': {
          scorePct: 120,
          correctCount: 4,
          totalCount: 4,
          passed: true,
          attempts: 0,
          updatedAt: 1000,
        },
      },
      lastActiveCourseId: 'python-dsa',
    });
    assert.deepEqual(normalized.completedItemIds, ['py-m1-notes']);
    assert.deepEqual(normalized.labSteps['py-m1-lab'], [0, 2]);
    assert.equal(normalized.quizScores['py-m1-quiz'].scorePct, 100);
    assert.equal(normalized.quizScores['py-m1-quiz'].attempts, 1);

    // Pure reducer flow + progress math
    const pyCourse = getCourseByIdOrSlug('python-dsa')!;
    const cppCourse = getCourseByIdOrSlug('cpp-systems')!;

    let state = DEFAULT_LEARN_PROGRESS;
    assert.equal(computeInProgressCourses(state, COURSES).length, 0);

    state = reduceSetLastVisitedLesson(state, 'cpp-systems', 'cpp-m1-notes', 100);
    state = reduceMarkItemCompleted(state, 'python-dsa', 'py-m1-notes', true, 200);
    state = reduceRecordQuizResult(
      state,
      'python-dsa',
      'py-m1-quiz',
      { scorePct: 50, correctCount: 2, totalCount: 4, passed: false },
      210
    );
    assert.equal(state.quizScores['py-m1-quiz'].attempts, 1);
    assert.equal(state.completedItemIds.includes('py-m1-quiz'), false);

    state = reduceRecordQuizResult(
      state,
      'python-dsa',
      'py-m1-quiz',
      { scorePct: 100, correctCount: 4, totalCount: 4, passed: true },
      220
    );
    assert.equal(state.quizScores['py-m1-quiz'].attempts, 2);
    assert.equal(state.completedItemIds.includes('py-m1-quiz'), true);

    state = reduceToggleLabStep(state, 'python-dsa', 'py-m1-lab', 2);
    state = reduceToggleLabStep(state, 'python-dsa', 'py-m1-lab', 0);
    assert.deepEqual(state.labSteps['py-m1-lab'], [0, 2]);
    state = reduceToggleLabStep(state, 'python-dsa', 'py-m1-lab', 0);
    assert.deepEqual(state.labSteps['py-m1-lab'], [2]);

    state = reduceRecordExamAttempt(
      state,
      'python-dsa',
      'py-m1-exam',
      { scorePct: 83, correctCount: 5, totalCount: 6, passed: true, timeTakenSecs: 300 },
      250
    );
    assert.equal(state.examAttempts['py-m1-exam'].length, 1);
    assert.equal(state.completedItemIds.includes('py-m1-exam'), true);

    const pySummary = computeCourseProgress(state, pyCourse);
    assert.equal(pySummary.completedCount, 3);
    assert.equal(pySummary.totalCount, 7);
    assert.equal(pySummary.pct, 43);
    assert.equal(pySummary.resumeLessonId, 'py-m1-exam');

    const inProgress = computeInProgressCourses(state, COURSES);
    assert.equal(inProgress.length, 2);
    assert.equal(inProgress[0].course.id, 'python-dsa');
    assert.equal(inProgress[1].course.id, 'cpp-systems');

    // Completing all cpp lessons removes cpp-systems from inProgress list
    for (const item of flattenCourseLessons(cppCourse)) {
      state = reduceMarkItemCompleted(state, cppCourse.id, item.id, true, 300);
    }
    const cppSummary = computeCourseProgress(state, cppCourse);
    assert.equal(cppSummary.pct, 100);
    const inProgressAfterCppDone = computeInProgressCourses(state, COURSES);
    assert.equal(inProgressAfterCppDone.length, 1);
    assert.equal(inProgressAfterCppDone[0].course.id, 'python-dsa');

    // localStorage persistence test with temporary window/localStorage mock
    const prevWindow = (globalThis as Record<string, unknown>).window;
    const prevStorage = (globalThis as Record<string, unknown>).localStorage;
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      key: (idx: number) => Array.from(store.keys())[idx] ?? null,
      get length() {
        return store.size;
      },
    };

    try {
      (globalThis as Record<string, unknown>).localStorage = mockStorage;
      (globalThis as Record<string, unknown>).window = { localStorage: mockStorage };

      saveLearnProgress(state);
      const rawStored = mockStorage.getItem(LEARN_PROGRESS_STORAGE_KEY);
      assert.ok(rawStored);
      const reloaded = loadLearnProgress();
      assert.deepEqual(reloaded, state);

      mockStorage.setItem(LEARN_PROGRESS_STORAGE_KEY, '{not-valid-json');
      assert.deepEqual(loadLearnProgress(), DEFAULT_LEARN_PROGRESS);
    } finally {
      if (prevWindow === undefined) {
        delete (globalThis as Record<string, unknown>).window;
      } else {
        (globalThis as Record<string, unknown>).window = prevWindow;
      }
      if (prevStorage === undefined) {
        delete (globalThis as Record<string, unknown>).localStorage;
      } else {
        (globalThis as Record<string, unknown>).localStorage = prevStorage;
      }
    }
  });

  runSection('6. SQL Lab & Notes SQLite Reference Execution', () => {
    let DatabaseSync: (new (path: string) => { exec: (sql: string) => void; prepare: (sql: string) => { all: () => Record<string, unknown>[] } }) | undefined;
    try {
      const customReq = createRequire(import.meta.url);
      DatabaseSync = customReq('node:sqlite').DatabaseSync;
    } catch {
      DatabaseSync = undefined;
    }
    if (!DatabaseSync) {
      console.log('   (skipped node:sqlite check: module unavailable)');
      return;
    }

    const sqlCourse = getCourseByIdOrSlug('sql-design')!;
    const sqlNotes = findLessonInCourse(sqlCourse, 'sql-m1-notes')!.item as NotesLesson;
    const notesSqlCode = sqlNotes.sections.find((s) => s.codeBlock)?.codeBlock?.code;
    assert.ok(notesSqlCode);

    const db1 = new DatabaseSync(':memory:');
    const notesStmts = notesSqlCode
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < notesStmts.length - 1; i++) {
      db1.exec(`${notesStmts[i]};`);
    }
    const notesRows = db1.prepare(notesStmts[notesStmts.length - 1]).all();
    assert.equal(notesRows.length, 3);
    assert.equal(notesRows[0].dept_name, 'Engineering');
    assert.equal(notesRows[2].dept_name, 'Research');
    assert.equal(notesRows[2].total_salary, 0);

    const sqlLab = findLessonInCourse(sqlCourse, 'sql-m1-lab')!.item as LabLesson;
    const refQuery = `${sqlLab.starterCode}
SELECT
  d.name AS department_name,
  COUNT(e.id) AS headcount,
  SUM(e.salary) AS total_payroll,
  RANK() OVER (ORDER BY SUM(e.salary) DESC) AS payroll_rank
FROM departments d
INNER JOIN employees e ON e.dept_id = d.id
GROUP BY d.id, d.name
ORDER BY payroll_rank ASC, d.name ASC;`;

    const db2 = new DatabaseSync(':memory:');
    const labStmts = refQuery
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < labStmts.length - 1; i++) {
      db2.exec(`${labStmts[i]};`);
    }
    const labRows = db2.prepare(labStmts[labStmts.length - 1]).all();
    const formatted = labRows.map((r) => Object.values(r).join('|')).join('\n');
    assert.equal(formatted, sqlLab.testCases![0].expectedStdout);
  });

  console.log('All M1 learn-data tests passed.');
}

main();
