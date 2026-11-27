import { CHALLENGES } from '@/lib/challenges/challenges-data';
import { getLanguageConfig } from '@/config/languages';
import type { LabLesson } from '@/types/learn';
import type { ProjectFile, TestCase } from './types';
import { executeInCloudSandbox, runTestCases } from './engine';

/**
 * Resolve runnable TestCase[] for a Learn LabLesson, checking linked Practice Hub
 * challenge cases first and falling back to standalone lab testCases.
 */
export function resolveLabTestCases(lab: LabLesson): TestCase[] {
  if (lab.ideProblemId) {
    const linked = CHALLENGES.find(
      (c) => c.id === lab.ideProblemId || c.slug === lab.ideProblemId
    );
    if (linked && linked.testCases.length > 0) {
      return linked.testCases.map((tc) => ({ ...tc }));
    }
  }

  if (Array.isArray(lab.testCases) && lab.testCases.length > 0) {
    return lab.testCases.map((tc, idx) => ({
      id: tc.id,
      name: `Test Case ${idx + 1}`,
      stdin: tc.input,
      expectedStdout: tc.expectedStdout,
      isHidden: tc.isHidden ?? false,
    }));
  }

  return [];
}

/**
 * Shared test evaluation runner supporting both standard compiled/interpreted languages
 * and SQLite SQL labs.
 */
export async function evaluateLabTestCases(params: {
  language: string;
  code: string;
  filename: string;
  testCases: TestCase[];
  projectId?: string;
}): Promise<{
  testCases: TestCase[];
  passedCount: number;
  totalCount: number;
}> {
  const { language, code, filename, testCases, projectId } = params;
  const langConfig = getLanguageConfig(language || 'python');
  const file: ProjectFile = {
    id: `lab_${filename}`,
    name: filename,
    path: `/${filename}`,
    content: code,
    isFolder: false,
  };

  if (langConfig.id === 'sql') {
    const evaluated: TestCase[] = [];
    let passedCount = 0;

    for (const tc of testCases) {
      let actualStdout = '';
      let execErr: string | undefined;
      let timeMs = 0;

      let sqlApiData: {
        result?: {
          error?: string;
          executionTimeMs?: number;
          rows?: unknown[][];
        };
      } | null = null;

      try {
        const res = await fetch('/api/v1/sql/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectId || 'demo_sql_project',
            query: code,
            dialect: 'sqlite',
          }),
        });
        if (res.ok) {
          sqlApiData = await res.json();
        }
      } catch {
        // Fallback to cloud sandbox below
      }

      const isSqlUnavailable =
        !sqlApiData?.result ||
        (typeof sqlApiData.result.error === 'string' &&
          sqlApiData.result.error
            .toLowerCase()
            .includes('not available in the current runtime environment'));

      if (!isSqlUnavailable && sqlApiData?.result) {
        timeMs = sqlApiData.result.executionTimeMs || 0;
        if (sqlApiData.result.error) {
          execErr = sqlApiData.result.error;
        } else {
          const rows = Array.isArray(sqlApiData.result.rows) ? sqlApiData.result.rows : [];
          actualStdout = rows
            .map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))).join('|'))
            .join('\n')
            .trim();
        }
      } else {
        const cloudRes = await executeInCloudSandbox({
          projectId,
          language: 'sql',
          files: [file],
          entrypoint: filename,
          stdin: tc.stdin,
        });
        timeMs = cloudRes.executionTimeMs;
        actualStdout = (cloudRes.stdout || '').replace(/\r\n/g, '\n').trim();
        if (cloudRes.status !== 'success') {
          execErr = (cloudRes.stderr || cloudRes.stdout || '').replace(/\r\n/g, '\n');
        }
      }

      const expected = (tc.expectedStdout || '').replace(/\r\n/g, '\n').trim();
      const passed = !execErr && actualStdout === expected;
      if (passed) passedCount++;

      evaluated.push({
        ...tc,
        actualStdout,
        passed,
        timeMs,
        error: execErr,
      });
    }

    return {
      testCases: evaluated,
      passedCount,
      totalCount: testCases.length,
    };
  }

  return runTestCases(
    {
      projectId,
      language: langConfig.id,
      files: [file],
      entrypoint: filename,
    },
    testCases
  );
}
