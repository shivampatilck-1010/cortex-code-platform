import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface TestCaseResult {
  name: string;
  tier: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  assertionCount: number;
  error?: string;
  details?: string[];
}

export interface TierExecutionResult {
  tierName: string;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  durationMs: number;
  results: TestCaseResult[];
}

export class TestHarness {
  private tierName: string;
  private results: TestCaseResult[] = [];
  private currentTest: TestCaseResult | null = null;
  private currentAssertions = 0;
  private startTime = 0;

  constructor(tierName: string) {
    this.tierName = tierName;
  }

  public startTest(testName: string): void {
    this.currentTest = {
      name: testName,
      tier: this.tierName,
      status: 'passed',
      durationMs: 0,
      assertionCount: 0,
      details: [],
    };
    this.currentAssertions = 0;
    this.startTime = Date.now();
  }

  public assert(condition: boolean, message: string): void {
    this.currentAssertions++;
    if (!condition) {
      const errMsg = `Assertion failed: ${message}`;
      if (this.currentTest) {
        this.currentTest.status = 'failed';
        this.currentTest.error = this.currentTest.error
          ? `${this.currentTest.error} | ${errMsg}`
          : errMsg;
        this.currentTest.details?.push(`[FAIL] ${message}`);
      }
      throw new Error(errMsg);
    } else {
      if (this.currentTest) {
        this.currentTest.details?.push(`[PASS] ${message}`);
      }
    }
  }

  public assertEquals(actual: unknown, expected: unknown, message: string): void {
    const passed = actual === expected;
    const detail = `${message} (expected: ${String(expected)}, got: ${String(actual)})`;
    this.assert(passed, detail);
  }

  public assertNotEquals(actual: unknown, expected: unknown, message: string): void {
    const passed = actual !== expected;
    const detail = `${message} (expected not equal to: ${String(expected)}, got: ${String(actual)})`;
    this.assert(passed, detail);
  }

  public assertMatch(actual: string, pattern: RegExp, message: string): void {
    const passed = pattern.test(actual);
    const detail = `${message} (string did not match pattern: ${pattern.toString()})`;
    this.assert(passed, detail);
  }

  public assertIncludes(actual: string | unknown[], item: unknown, message: string): void {
    let passed = false;
    if (typeof actual === 'string') {
      passed = actual.includes(String(item));
    } else if (Array.isArray(actual)) {
      passed = actual.includes(item);
    }
    const detail = `${message} (target did not contain expected element)`;
    this.assert(passed, detail);
  }

  public assertGreaterThanOrEqual(actual: number, threshold: number, message: string): void {
    const passed = actual >= threshold;
    const detail = `${message} (expected >= ${threshold}, got ${actual})`;
    this.assert(passed, detail);
  }

  public endTest(statusOverride?: 'passed' | 'failed' | 'skipped', skipReason?: string): void {
    if (!this.currentTest) {
      return;
    }
    this.currentTest.durationMs = Date.now() - this.startTime;
    this.currentTest.assertionCount = this.currentAssertions;
    if (statusOverride) {
      this.currentTest.status = statusOverride;
      if (skipReason) {
        this.currentTest.details?.push(`[SKIP] Reason: ${skipReason}`);
      }
    }
    this.results.push(this.currentTest);
    this.currentTest = null;
  }

  public getSummary(): TierExecutionResult {
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    let totalAssertions = 0;
    let passedAssertions = 0;
    let failedAssertions = 0;
    let totalDurationMs = 0;

    for (const r of this.results) {
      totalDurationMs += r.durationMs;
      totalAssertions += r.assertionCount;
      if (r.status === 'passed') {
        passedTests++;
        passedAssertions += r.assertionCount;
      } else if (r.status === 'failed') {
        failedTests++;
        // Count passed vs failed within the test
        const fails = (r.details || []).filter((d) => d.startsWith('[FAIL]')).length;
        failedAssertions += fails;
        passedAssertions += Math.max(0, r.assertionCount - fails);
      } else {
        skippedTests++;
      }
    }

    return {
      tierName: this.tierName,
      passed: failedTests === 0,
      totalTests: this.results.length,
      passedTests,
      failedTests,
      skippedTests,
      totalAssertions,
      passedAssertions,
      failedAssertions,
      durationMs: totalDurationMs,
      results: this.results,
    };
  }
}

export interface ExecOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export function executeCommand(
  cmd: string,
  args: string[],
  options?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }
): Promise<ExecOutput> {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = '';
    let stderr = '';

    const fullCmd = args.length > 0 ? `${cmd} ${args.join(' ')}` : cmd;
    const child = spawn(fullCmd, [], {
      cwd: options?.cwd || process.cwd(),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...options?.env },
    });

    const timeout = options?.timeoutMs || 180000;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      stderr += `\nCommand timed out after ${timeout}ms`;
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode: exitCode ?? -1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      stderr += `\nProcess error: ${err.message}`;
      resolve({
        exitCode: -1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });
  });
}

export function findFilesRecursively(
  dir: string,
  predicate?: (filePath: string) => boolean,
  ignoreDirs: string[] = ['node_modules', '.next', '.git', 'dist', 'build']
): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        results.push(...findFilesRecursively(fullPath, predicate, ignoreDirs));
      }
    } else if (entry.isFile()) {
      if (!predicate || predicate(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

export interface EmojiViolation {
  filePath: string;
  line: number;
  column: number;
  character: string;
  codePoint: string;
}

export function detectEmojisInText(text: string, filePath = 'unknown'): EmojiViolation[] {
  // Regex constructed using escape sequences to prevent raw emojis in source code
  const emojiPattern = new RegExp(
    '[' +
      '\\u{1F300}-\\u{1F5FF}' +
      '\\u{1F600}-\\u{1F64F}' +
      '\\u{1F680}-\\u{1F6FF}' +
      '\\u{1F700}-\\u{1F77F}' +
      '\\u{1F780}-\\u{1F7FF}' +
      '\\u{1F800}-\\u{1F8FF}' +
      '\\u{1F900}-\\u{1F9FF}' +
      '\\u{1FA00}-\\u{1FA6F}' +
      '\\u{1FA70}-\\u{1FAFF}' +
      '\\u{2600}-\\u{26FF}' +
      '\\u{2700}-\\u{27BF}' +
      ']',
    'gu'
  );

  const violations: EmojiViolation[] = [];
  const lines = text.split(/\r?\n/);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineContent = lines[lineIdx];
    let match: RegExpExecArray | null;
    emojiPattern.lastIndex = 0;
    while ((match = emojiPattern.exec(lineContent)) !== null) {
      const char = match[0];
      const codePoint = 'U+' + (char.codePointAt(0)?.toString(16).toUpperCase() || 'UNKNOWN');
      violations.push({
        filePath,
        line: lineIdx + 1,
        column: match.index + 1,
        character: char,
        codePoint,
      });
    }
  }

  return violations;
}

export function parseImportSpecifiers(sourceCode: string): string[] {
  const importRegex = /(?:import\s+(?:[\w*\s{},]*)\s+from\s+['"]([^'"]+)['"])|(?:import\(['"]([^'"]+)['"]\))/g;
  const specifiers: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(sourceCode)) !== null) {
    const spec = match[1] || match[2];
    if (spec && !specifiers.includes(spec)) {
      specifiers.push(spec);
    }
  }
  return specifiers;
}
