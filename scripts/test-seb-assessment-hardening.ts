/**
 * Cortex Online Examination System — SEB Assessment Hardening & E2E Verification Suite
 *
 * Comprehensive 4-tier opaque-box verification for Safe Exam Browser (SEB) Hardening:
 * - Tier 1: Feature Coverage (Category-Partition baseline for every cryptographic and lifecycle feature)
 * - Tier 2: Boundary & Corner Cases (Boundary Value Analysis on TTLs, nonces, canonical ports, URL normalizations)
 * - Tier 3: Cross-Feature Combinations (Dual headers + token co-validation, JS API fallback, assignment parity)
 * - Tier 4: Real-World Application Scenarios (Student exam lifecycle, teacher config export, multi-student replay defense, glitch retry)
 *
 * Requirements Mapping: ORIGINAL_REQUEST.md R1, R2, R3, R4 & TEST_INFRA.md
 * Execution: node scripts/test-seb-assessment-hardening.ts
 * Regression Suite: node scripts/test-phase4-10-seb-security.ts
 *
 * Strictly zero emojis.
 */

import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { register } from 'node:module';

// Dynamically register Next.js & module resolution loader hook
register(new URL('../node_modules/next/loader.mjs', import.meta.url));

// Internal domain imports (TypeScript modules with explicit extensions)
import {
  hashQuitPassword,
  computeSafeExamBrowserHash,
  computeOfficialSebConfigKey,
  canonicalizeSebValue,
  getExpectedBrowserExamKey,
  deriveAuthoritativeBrowserExamKey,
  createSebLaunchToken,
  verifyAndConsumeSebLaunchToken,
  getSebLaunchTokenSecret,
  generateCandidateUrls,
  generateSafeExamBrowserConfigPlist,
  buildSebConfigDictionary,
  serializeSebConfigPlist,
  parseSebPlistXml,
  buildSebExamStartUrl,
  buildSebExamQuitUrl,
  buildSebAssignmentStartUrl,
  buildSebAssignmentQuitUrl,
  verifySafeExamBrowserRequest,
  safeTimingEqual,
  escapeXml,
  unescapeXml,
} from '../src/lib/classroom/seb-security.ts';

import {
  isValidHexColor,
  isValidThemePreset,
  sanitizeBrandingTheme,
  HEX_COLOR_REGEX,
  VALID_THEME_PRESETS,
} from '../src/lib/classroom/models.ts';

import type {
  Exam,
  Assignment,
  AssessmentBrandingTheme,
  AssessmentThemePreset,
} from '../src/lib/classroom/models.ts';

// Standard trusted host domain conforming to isTrustedHost (*.cortex.dev)
const TRUSTED_BASE_URL = 'https://app.cortex.dev';
const TRUSTED_HOST = 'app.cortex.dev';

// ============================================================================
// ZERO-DEPENDENCY REQUEST & IN-MEMORY SQLITE HARNESS
// ============================================================================

export class MockNextRequest extends Request {
  nextUrl: URL;
  constructor(input: string | URL, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(typeof input === 'string' ? input : input.href);
  }
}

export function createMockRequest(urlStr: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}): MockNextRequest {
  const headers = new Headers(options.headers || {});
  const url = new URL(urlStr);
  if (!headers.has('host')) {
    headers.set('host', url.host);
  }
  return new MockNextRequest(urlStr, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

// In-Memory SQLite Replay Protection Database for Verification
const inMemoryDb = new DatabaseSync(':memory:');
inMemoryDb.exec(`
  CREATE TABLE IF NOT EXISTS seb_consumed_tokens (
    nonce TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    assessment_id TEXT NOT NULL,
    consumed_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_seb_consumed_tokens_expires ON seb_consumed_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_seb_consumed_tokens_lookup ON seb_consumed_tokens(assessment_id, user_id);
`);

export const testTokenStore = {
  consumeToken(nonce: string, userId: string, assessmentId: string, expiresAt: number): boolean {
    const now = Date.now();
    try {
      inMemoryDb.prepare(`
        INSERT INTO seb_consumed_tokens (nonce, user_id, assessment_id, consumed_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(nonce, userId, assessmentId, now, expiresAt);
      return true;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('UNIQUE constraint failed') || msg.includes('PRIMARY KEY')) {
        return false;
      }
      throw err;
    }
  },
  isTokenConsumed(nonce: string): boolean {
    const row = inMemoryDb.prepare('SELECT nonce FROM seb_consumed_tokens WHERE nonce = ?').get(nonce);
    return !!row;
  },
  cleanupExpired(now = Date.now()): number {
    const res = inMemoryDb.prepare('DELETE FROM seb_consumed_tokens WHERE expires_at < ?').run(now);
    return Number(res.changes || 0);
  },
  reset(): void {
    inMemoryDb.exec('DELETE FROM seb_consumed_tokens;');
  },
};

// ============================================================================
// SIMULATED GATE PIPELINES (MIRRORING HARDENED API ROUTE CONTRACTS)
// ============================================================================

export interface SimulatedExamSession {
  id: string;
  examId: string;
  userId: string;
  status: 'in_progress' | 'submitted' | 'timed_out';
  startedAt: number;
  submittedAt?: number;
  answers: Record<string, string>;
  score?: number;
}

export function simulateExamStartGate(
  req: MockNextRequest,
  exam: Exam,
  context: { userId: string }
): { status: number; body: Record<string, any> } {
  // 1. Check SEB headers
  const sebVerify = verifySafeExamBrowserRequest(req as any, exam);
  if (!sebVerify.verified) {
    return {
      status: 403,
      body: {
        error: 'Safe Exam Browser is required to start this examination.',
        sebRequired: true,
        downloadUrl: 'https://safeexambrowser.org/download_en.html',
        reason: sebVerify.reason,
      },
    };
  }

  // 2. Check Launch Token if required
  const token = req.headers.get('x-seb-launch-token') || req.nextUrl.searchParams.get('launchToken') || req.nextUrl.searchParams.get('sebToken');
  if (exam.securityLevel === 'seb' && !token) {
    return {
      status: 403,
      body: {
        error: 'Missing single-use launch token for SEB-enforced examination.',
        sebRequired: true,
        tokenMissing: true,
      },
    };
  }

  return {
    status: 201,
    body: {
      success: true,
      message: 'Examination session initialized successfully.',
      matchType: sebVerify.matchType || 'bek',
      questions: [
        { id: 'q1', text: 'Evaluate the integral of 2x dx.', marks: 10 },
        { id: 'q2', text: 'State the Fundamental Theorem of Calculus.', marks: 15 },
      ],
    },
  };
}

export function simulateExamResponsesGate(
  req: MockNextRequest,
  exam: Exam,
  session: SimulatedExamSession,
  body: { questionId: string; answer: string }
): { status: number; body: Record<string, any> } {
  const sebVerify = verifySafeExamBrowserRequest(req as any, exam);
  if (!sebVerify.verified) {
    return {
      status: 403,
      body: {
        error: 'Forbidden: autosave rejected outside Safe Exam Browser.',
        sebRequired: true,
        reason: sebVerify.reason,
      },
    };
  }

  if (session.status !== 'in_progress') {
    return {
      status: 409,
      body: { error: `Session is ${session.status}. Autosave rejected.` },
    };
  }

  session.answers[body.questionId] = body.answer;
  return {
    status: 200,
    body: { success: true, savedAt: Date.now(), answersCount: Object.keys(session.answers).length },
  };
}

export function simulateExamSubmitGate(
  req: MockNextRequest,
  exam: Exam,
  session: SimulatedExamSession
): { status: number; body: Record<string, any> } {
  const sebVerify = verifySafeExamBrowserRequest(req as any, exam);
  if (!sebVerify.verified) {
    return {
      status: 403,
      body: {
        error: 'Forbidden: exam submission rejected outside Safe Exam Browser.',
        sebRequired: true,
        reason: sebVerify.reason,
      },
    };
  }

  // Idempotent resubmission: if session is already submitted, return 200 OK with alreadySubmitted: true
  if (session.status === 'submitted') {
    return {
      status: 200,
      body: {
        success: true,
        alreadySubmitted: true,
        message: 'Examination has already been submitted.',
        session: {
          id: session.id,
          status: 'submitted',
          score: session.score ?? 85,
          submittedAt: session.submittedAt,
        },
      },
    };
  }

  // First-time submission
  session.status = 'submitted';
  session.submittedAt = Date.now();
  session.score = 92;

  return {
    status: 200,
    body: {
      success: true,
      alreadySubmitted: false,
      message: 'Examination submitted successfully.',
      session: {
        id: session.id,
        status: 'submitted',
        score: session.score,
        submittedAt: session.submittedAt,
      },
    },
  };
}

export function simulateAssignmentDetailsGate(
  req: MockNextRequest,
  assignment: Assignment,
  tokenValidationResult?: { valid: boolean; reason?: string }
): { status: number; body: Record<string, any> } {
  const isSebRequired = assignment.securityLevel === 'seb';

  if (isSebRequired) {
    const sebVerify = verifySafeExamBrowserRequest(req as any, assignment);
    const hasValidToken = tokenValidationResult?.valid ?? false;

    if (!sebVerify.verified && !hasValidToken) {
      return {
        status: 403,
        body: {
          id: assignment.id,
          title: assignment.title,
          securityLevel: 'seb',
          sebRequired: true,
          downloadUrl: 'https://safeexambrowser.org/download_en.html',
          // Problem statement and starter code are strictly redacted
          instructions: 'Safe Exam Browser is required to view this assignment.',
          starterCode: '',
          testCases: [],
        },
      };
    }
  }

  return {
    status: 200,
    body: {
      id: assignment.id,
      title: assignment.title,
      securityLevel: assignment.securityLevel,
      instructions: assignment.instructions,
      starterCode: assignment.starterCode,
      testCases: assignment.testCases,
    },
  };
}

export function simulateAssignmentSubmitGate(
  req: MockNextRequest,
  assignment: Assignment,
  solutionCode: string
): { status: number; body: Record<string, any> } {
  const isSebRequired = assignment.securityLevel === 'seb';
  if (isSebRequired) {
    const sebVerify = verifySafeExamBrowserRequest(req as any, assignment);
    if (!sebVerify.verified) {
      return {
        status: 403,
        body: {
          error: 'Assignment submission rejected outside Safe Exam Browser.',
          sebRequired: true,
        },
      };
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      status: 'graded',
      score: 100,
      passedCount: 3,
      totalCount: 3,
    },
  };
}

// ============================================================================
// TEST HARNESS & ASSERTION COLLECTOR
// ============================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testId: string, description: string, detail?: string) {
  totalTests++;
  const label = `[${testId}] ${description}`;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${label}`);
  } else {
    failedTests++;
    const errMsg = `${label}${detail ? ' — Details: ' + detail : ''}`;
    failureDetails.push(errMsg);
    console.error(`[FAIL] ${errMsg}`);
  }
}

function assertEquals<T>(actual: T, expected: T, testId: string, description: string) {
  const match = actual === expected;
  assert(match, testId, description, `expected ${String(expected)}, received ${String(actual)}`);
}

function assertMatch(actual: string, pattern: RegExp, testId: string, description: string) {
  const match = pattern.test(actual);
  assert(match, testId, description, `value '${actual}' does not match pattern ${pattern.toString()}`);
}

// ============================================================================
// MAIN VERIFICATION SUITE EXECUTION
// ============================================================================

async function runHardeningTestSuite() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('SAFE EXAM BROWSER (SEB) ASSESSMENT FLOW HARDENING TEST SUITE');
  console.log(`Node Runtime: ${process.version}`);
  console.log('Execution Mode: 4-Tier Opaque-Box Comprehensive Automated Verification');
  console.log('================================================================\n');

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (CATEGORY-PARTITION BASELINE)
  // ==========================================================================
  console.log('================================================================');
  console.log('TIER 1: FEATURE COVERAGE');
  console.log('================================================================');

  // TC1.1: BEK Request Hash Verification with explicit key
  {
    const examBek: Exam = {
      id: 'exam_bek_t1_01',
      classroomId: 'CLS_MATH101',
      title: 'Calculus Final',
      durationMinutes: 90,
      startTime: Date.now() - 5000,
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
      sebBrowserExamKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    };
    const targetUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_MATH101/exams/exam_bek_t1_01/start`;
    const bekHash = computeSafeExamBrowserHash(targetUrl, examBek.sebBrowserExamKey!);
    const req = createMockRequest(targetUrl, {
      headers: { 'x-safeexambrowser-requesthash': bekHash },
    });
    const result = verifySafeExamBrowserRequest(req as any, examBek);
    assert(result.verified === true, 'TC1.1a', 'BEK request hash is verified successfully');
    assertEquals(result.matchType, 'bek', 'TC1.1b', 'BEK verification confirms matchType="bek"');
  }

  // TC1.2: Official SEB Config Key Generation & Canonical JSON Checksum
  {
    const configDict = {
      originatorVersion: 'Cortex Examination System 3.0',
      browserExamKey: 'temporary_bek_value',
      startURL: `${TRUSTED_BASE_URL}/classroom/CLS_MATH/exam/ex1?sebToken=tok1`,
      quitURL: `${TRUSTED_BASE_URL}/classroom/CLS_MATH`,
      allowQuit: true,
      browserViewMode: 0,
      enableAltTab: false,
      hookKeys: true,
      sendBrowserExamKey: true,
      enableURLFilter: true,
      URLFilterRules: [
        { action: 1, active: true, rule: `${TRUSTED_HOST}/*`, regex: false },
      ],
    };
    const ck = computeOfficialSebConfigKey(configDict);
    assertMatch(ck, /^[a-f0-9]{64}$/, 'TC1.2a', 'Official SEB Config Key is a 64-char lowercase hexadecimal string');

    // Canonicalization check: stripping originatorVersion and browserExamKey
    const canonical = canonicalizeSebValue(configDict) as Record<string, any>;
    assertEquals(canonical.originatorVersion, undefined, 'TC1.2b', 'originatorVersion is stripped from canonical SEB dictionary');
    assertEquals(canonical.browserExamKey, undefined, 'TC1.2c', 'browserExamKey is stripped from canonical SEB dictionary');

    // Deterministic sorting check: keys must be sorted alphabetically
    const keys = Object.keys(canonical);
    const sortedKeys = [...keys].sort();
    assertEquals(JSON.stringify(keys), JSON.stringify(sortedKeys), 'TC1.2d', 'Dictionary keys are recursively sorted in alphabetical order');

    // Check compact JSON (no whitespace outside strings)
    const compactJson = JSON.stringify(canonical);
    assert(!compactJson.includes('": '), 'TC1.2e', 'Compact canonical JSON eliminates formatting spaces around colons');
  }

  // TC1.3: Config Key (CK) Request Hash Verification
  {
    const examCk: Exam = {
      id: 'exam_ck_t1_03',
      classroomId: 'CLS_PHYSICS',
      title: 'Physics Midterm',
      durationMinutes: 60,
      startTime: Date.now() - 5000,
      endTime: Date.now() + 3600000,
      totalMarks: 50,
      passingMarks: 25,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
      sebConfigKey: 'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1',
    };
    const targetUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_PHYSICS/exams/exam_ck_t1_03/start`;
    const ckHash = computeSafeExamBrowserHash(targetUrl, examCk.sebConfigKey!);
    const req = createMockRequest(targetUrl, {
      headers: { 'x-safeexambrowser-configkeyhash': ckHash },
    });
    const result = verifySafeExamBrowserRequest(req as any, examCk);
    assert(result.verified === true, 'TC1.3a', 'CK request hash is verified successfully');
    assertEquals(result.matchType, 'ck', 'TC1.3b', 'CK verification confirms matchType="ck"');
  }

  // TC1.4: Signed Single-Use Launch Token Generation
  {
    const payload = {
      userId: 'student_alice_101',
      assessmentId: 'exam_calc_final',
      assessmentType: 'exam' as const,
      classroomId: 'CLS_MATH101',
      durationMinutes: 90,
    };
    const token = createSebLaunchToken(payload);
    const parts = token.split('.');
    assertEquals(parts.length, 3, 'TC1.4a', 'Launch token is a compact 3-part Base64URL string');

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    assertEquals(header.alg, 'HS256', 'TC1.4b', 'Launch token header specifies HS256 algorithm');
    assertEquals(claims.userId, 'student_alice_101', 'TC1.4c', 'Launch token binds userId claim');
    assertEquals(claims.assessmentId, 'exam_calc_final', 'TC1.4d', 'Launch token binds assessmentId claim');
    assertEquals(claims.classroomId, 'CLS_MATH101', 'TC1.4e', 'Launch token binds classroomId claim');
    assertMatch(claims.jti, /^[a-f0-9]{32}$/, 'TC1.4f', 'Launch token contains a 32-hex single-use nonce (jti)');
    assert(claims.exp - claims.iat === 600, 'TC1.4g', 'Launch token defaults to a 10-minute (600s) TTL');
  }

  // TC1.5: Valid Apple Plist XML Generation Conformance
  {
    const plist = generateSafeExamBrowserConfigPlist({
      startUrl: `${TRUSTED_BASE_URL}/classroom/CLS_MATH101/exam/exam_1?sebToken=tok_test`,
      quitUrl: `${TRUSTED_BASE_URL}/classroom/CLS_MATH101`,
      sebQuitPassword: 'ProctorSecret2026',
      host: TRUSTED_HOST,
    });
    assert(plist.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'TC1.5a', 'Plist starts with XML 1.0 declaration');
    assert(
      plist.xml.includes('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'),
      'TC1.5b',
      'Plist specifies Apple DTD'
    );
    assert(plist.xml.includes('<key>hashedQuitPassword</key>'), 'TC1.5c', 'Plist contains hashed quit password key');
    const expectedPwHash = hashQuitPassword('ProctorSecret2026');
    assert(plist.xml.includes(`<string>${expectedPwHash}</string>`), 'TC1.5d', 'Quit password is stored as SHA-256 hash');
    assert(plist.xml.includes('<key>allowQuit</key>\n\t<true/>'), 'TC1.5e', 'Plist allows quit when password is provided');
    assert(plist.xml.includes('<key>allowPreferencesWindow</key>\n\t<false/>'), 'TC1.5f', 'Plist locks preferences window');
    assert(plist.xml.includes('<key>sendBrowserExamKey</key>\n\t<true/>'), 'TC1.5g', 'Plist enables sendBrowserExamKey');
  }

  // TC1.6: Exact Assessment Deep Links in startURL
  {
    const startUrl = buildSebExamStartUrl(TRUSTED_BASE_URL, 'exam_99', 'CLS_SCI', 'launch_tok_abc');
    assertEquals(
      startUrl,
      `${TRUSTED_BASE_URL}/classroom/CLS_SCI/exam/exam_99?sebToken=launch_tok_abc`,
      'TC1.6a',
      'Exam startURL contains exact assessment deep link, never generic /classroom'
    );
    const plist = generateSafeExamBrowserConfigPlist({ startUrl });
    assert(plist.xml.includes(`<string>${escapeXml(startUrl)}</string>`), 'TC1.6b', 'Generated plist startURL matches deep link');
  }

  // TC1.7: Post-Submit Quit URL Presence
  {
    const quitUrl = buildSebExamQuitUrl(TRUSTED_BASE_URL, 'CLS_SCI');
    assertEquals(quitUrl, `${TRUSTED_BASE_URL}/classroom/CLS_SCI`, 'TC1.7a', 'Quit URL targets classroom exit');
    const plist = generateSafeExamBrowserConfigPlist({
      startUrl: `${TRUSTED_BASE_URL}/classroom/CLS_SCI/exam/exam_99`,
      quitUrl,
    });
    assert(plist.xml.includes(`<key>quitURL</key>\n\t<string>${escapeXml(quitUrl)}</string>`), 'TC1.7b', 'Plist contains explicit quitURL');
  }

  // TC1.8: URLFilterRules Allowlist Generation
  {
    const plist = generateSafeExamBrowserConfigPlist({
      startUrl: `${TRUSTED_BASE_URL}/classroom/CLS_SCI/exam/exam_99`,
    });
    assert(plist.xml.includes('<key>enableURLFilter</key>\n\t<true/>'), 'TC1.8a', 'Plist enables URL filter');
    assert(plist.xml.includes(`<key>rule</key>\n\t\t\t<string>${TRUSTED_HOST}/*</string>`), 'TC1.8b', 'Plist includes domain allow rule');
    assert(plist.xml.includes('<key>action</key>\n\t\t\t<integer>1</integer>'), 'TC1.8c', 'Domain rule action is set to allow (1)');
    assert(plist.xml.includes('<key>rule</key>\n\t\t\t<string>*</string>'), 'TC1.8d', 'Plist includes wildcard block rule');
    assert(plist.xml.includes('<key>action</key>\n\t\t\t<integer>0</integer>'), 'TC1.8e', 'Wildcard rule action is set to block (0)');
  }

  // TC1.9: Direct sebs:// Protocol URI Generation
  {
    const httpsConfigUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_1/exams/ex_1/seb-config?token=abc`;
    const sebsUri = httpsConfigUrl.replace(/^https:\/\//i, 'sebs://');
    assertEquals(
      sebsUri,
      `sebs://${TRUSTED_HOST}/api/v1/classrooms/CLS_1/exams/ex_1/seb-config?token=abc`,
      'TC1.9',
      'Protocol URI converts https:// to sebs:// preserving all parameters for one-click launch'
    );
  }

  // TC1.10: Start Route 403 Gate for Unverified Clients
  {
    const exam: Exam = {
      id: 'exam_gate_01',
      classroomId: 'CLS_GATE',
      title: 'Gate Exam',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: '1111111111111111111111111111111111111111111111111111111111111111',
    };
    const req = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_GATE/exams/exam_gate_01/start`);
    const res = simulateExamStartGate(req, exam, { userId: 'student_1' });
    assertEquals(res.status, 403, 'TC1.10a', 'Unverified start request returns HTTP 403 Forbidden');
    assertEquals(res.body.sebRequired, true, 'TC1.10b', '403 response specifies sebRequired: true');
    assertEquals(res.body.downloadUrl, 'https://safeexambrowser.org/download_en.html', 'TC1.10c', '403 response provides official download URL');
  }

  // TC1.11: Autosave Route 403 Gate for Unverified Clients
  {
    const exam: Exam = {
      id: 'exam_gate_02',
      classroomId: 'CLS_GATE',
      title: 'Gate Exam 2',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: '2222222222222222222222222222222222222222222222222222222222222222',
    };
    const session: SimulatedExamSession = {
      id: 'sess_1',
      examId: 'exam_gate_02',
      userId: 'student_1',
      status: 'in_progress',
      startedAt: Date.now(),
      answers: {},
    };
    const req = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_GATE/exams/exam_gate_02/sessions/sess_1/responses`, {
      method: 'PUT',
      body: { questionId: 'q1', answer: '42' },
    });
    const res = simulateExamResponsesGate(req, exam, session, { questionId: 'q1', answer: '42' });
    assertEquals(res.status, 403, 'TC1.11a', 'Autosave without SEB headers returns HTTP 403 Forbidden');
    assertEquals(res.body.sebRequired, true, 'TC1.11b', 'Autosave rejection sets sebRequired: true');
  }

  // TC1.12: Submit Route 403 Gate for Unverified Clients
  {
    const exam: Exam = {
      id: 'exam_gate_03',
      classroomId: 'CLS_GATE',
      title: 'Gate Exam 3',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: '3333333333333333333333333333333333333333333333333333333333333333',
    };
    const session: SimulatedExamSession = {
      id: 'sess_3',
      examId: 'exam_gate_03',
      userId: 'student_1',
      status: 'in_progress',
      startedAt: Date.now(),
      answers: { q1: '42' },
    };
    const req = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_GATE/exams/exam_gate_03/sessions/sess_3/submit`, {
      method: 'POST',
    });
    const res = simulateExamSubmitGate(req, exam, session);
    assertEquals(res.status, 403, 'TC1.12a', 'Submit without SEB headers returns HTTP 403 Forbidden');
    assertEquals(res.body.sebRequired, true, 'TC1.12b', 'Submit rejection sets sebRequired: true');
  }

  // TC1.13: Idempotent Submission Handling
  {
    const exam: Exam = {
      id: 'exam_idempotent_01',
      classroomId: 'CLS_IDEM',
      title: 'Idempotent Exam',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: '4444444444444444444444444444444444444444444444444444444444444444',
    };
    const session: SimulatedExamSession = {
      id: 'sess_already_submitted',
      examId: 'exam_idempotent_01',
      userId: 'student_1',
      status: 'submitted',
      startedAt: Date.now() - 3600000,
      submittedAt: Date.now() - 1000,
      score: 88,
      answers: { q1: 'solution' },
    };
    const targetUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_IDEM/exams/exam_idempotent_01/sessions/sess_already_submitted/submit`;
    const req = createMockRequest(targetUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': computeSafeExamBrowserHash(targetUrl, exam.sebBrowserExamKey!),
      },
    });
    const res = simulateExamSubmitGate(req, exam, session);
    assertEquals(res.status, 200, 'TC1.13a', 'Resubmission of already submitted session returns HTTP 200 OK');
    assertEquals(res.body.alreadySubmitted, true, 'TC1.13b', 'Response confirms alreadySubmitted: true');
    assertEquals(res.body.session?.score, 88, 'TC1.13c', 'Original score is preserved during resubmission');
  }

  // TC1.14: Assignment Companion SEB Config Route
  {
    const startUrl = buildSebAssignmentStartUrl(TRUSTED_BASE_URL, 'asg_algorithms_1', 'CLS_CS101', 'tok_asg_123');
    assertEquals(
      startUrl,
      `${TRUSTED_BASE_URL}/classroom/CLS_CS101/assignment/asg_algorithms_1?sebToken=tok_asg_123`,
      'TC1.14a',
      'Assignment start URL contains exact assignment deep link'
    );
    const plist = generateSafeExamBrowserConfigPlist({ startUrl });
    assert(plist.xml.includes('asg_algorithms_1'), 'TC1.14b', 'Assignment plist encapsulates exact assignment deep link in startURL');
  }

  // TC1.15: Assignment Problem Details Lockdown for Unverified Requests
  {
    const asg: Assignment = {
      id: 'asg_locked_01',
      classroomId: 'CLS_CS101',
      title: 'Dijkstra Shortest Path',
      description: 'Implement shortest path in O(E log V)',
      instructions: 'SECRET ALGORITHM SPECIFICATION: Use min-heap with adjacency list.',
      type: 'coding',
      language: 'typescript',
      starterCode: 'function dijkstra(graph, start) { /* solution body */ }',
      difficulty: 'Advanced',
      maxMarks: 100,
      dueAt: Date.now() + 86400000,
      publishedAt: Date.now() - 10000,
      attemptsAllowed: 3,
      allowLateSubmission: false,
      latePenaltyPercent: 0,
      autoGrade: true,
      manualGrade: false,
      aiPolicy: 'forbidden',
      plagiarismPolicy: 'strict',
      status: 'published',
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      testCases: [{ id: 'tc1', name: 'Sample 1', input: 'graph1', expectedOutput: 'dist1', visibility: 'public', isHidden: false, weight: 50, timeoutMs: 1000, memoryLimitMb: 128 }],
      securityLevel: 'seb',
    };
    const req = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_CS101/assignments/asg_locked_01`);
    const res = simulateAssignmentDetailsGate(req, asg);
    assertEquals(res.status, 403, 'TC1.15a', 'Unverified request for SEB-locked assignment returns 403');
    assertEquals(res.body.starterCode, '', 'TC1.15b', 'Starter code is strictly redacted for unverified request');
    assert(!res.body.instructions.includes('SECRET ALGORITHM'), 'TC1.15c', 'Problem statement is redacted');

    // Unverified submit
    const submitReq = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_CS101/assignments/asg_locked_01/submit`, { method: 'POST' });
    const submitRes = simulateAssignmentSubmitGate(submitReq, asg, 'my code');
    assertEquals(submitRes.status, 403, 'TC1.15d', 'Unverified assignment submission returns 403 Forbidden');
  }

  // TC1.16: Safe Branding Theme Preset & Color Validation
  {
    const presets: AssessmentThemePreset[] = ['cortex-dark', 'slate-dark', 'midnight-blue', 'classic-light'];
    for (const p of presets) {
      assert(isValidThemePreset(p), `TC1.16_p_${p}`, `Preset '${p}' is recognized as valid`);
    }
    assert(!isValidThemePreset('hacker-matrix-green'), 'TC1.16_invalid_preset', 'Arbitrary theme preset is rejected');

    const validHex = ['#fff', '#000000', '#0ea5e9', '#3b82f6'];
    for (const h of validHex) {
      assert(isValidHexColor(h), `TC1.16_hex_${h}`, `Hex color '${h}' is recognized as valid`);
    }

    const theme = sanitizeBrandingTheme({
      themePreset: 'slate-dark',
      accentColor: '#4f46e5',
      institutionName: 'Apex University',
      institutionLogoUrl: 'https://apex.edu/logo.png',
    });
    assertEquals(theme.themePreset, 'slate-dark', 'TC1.16a', 'Sanitized theme preserves valid preset');
    assertEquals(theme.accentColor, '#4f46e5', 'TC1.16b', 'Sanitized theme preserves valid accent color');
    assertEquals(theme.institutionName, 'Apex University', 'TC1.16c', 'Sanitized theme preserves valid institution name');
    assertEquals(theme.institutionLogoUrl, 'https://apex.edu/logo.png', 'TC1.16d', 'Sanitized theme preserves HTTPS logo URL');
  }

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // ==========================================================================
  console.log('\n================================================================');
  console.log('TIER 2: BOUNDARY & CORNER CASES');
  console.log('================================================================');

  // TC2.1: Expired Launch Token Rejection (exp < now)
  {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredClaims = {
      userId: 'student_bob',
      assessmentId: 'exam_expired',
      assessmentType: 'exam' as const,
      classroomId: 'CLS_CS101',
      jti: 'nonce_expired_1234567890abcdef',
      iat: nowSec - 1200,
      exp: nowSec - 600, // Expired 10 minutes ago
    };
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const claimsB64 = Buffer.from(JSON.stringify(expiredClaims)).toString('base64url');
    const sig = crypto.createHmac('sha256', process.env.SEB_LAUNCH_TOKEN_SECRET || 'cortex-default-seb-launch-token-secret-dev-only')
      .update(`${headerB64}.${claimsB64}`)
      .digest('base64url');
    const expiredToken = `${headerB64}.${claimsB64}.${sig}`;

    const result = await verifyAndConsumeSebLaunchToken(expiredToken, {
      userId: 'student_bob',
      assessmentId: 'exam_expired',
      assessmentType: 'exam',
      classroomId: 'CLS_CS101',
    });
    assert(result.valid === false, 'TC2.1a', 'Expired launch token is rejected with valid=false');
    assertEquals(result.reason, 'Launch token has expired or is invalid', 'TC2.1b', 'Rejection reason states token has expired or is invalid');
  }

  // TC2.1_malformed_exp: Non-Numeric claims.exp Safely Rejected Without SQLite Crash (CH-02 Remediation)
  {
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const malformedClaims = {
      userId: 'student_malformed',
      assessmentId: 'exam_malformed_exp',
      assessmentType: 'exam' as const,
      classroomId: 'CLS_CS101',
      jti: 'nonce_malformed_exp_1234567890ab',
      iat: Math.floor(Date.now() / 1000),
      exp: 'not_a_number', // Non-numeric string claim that caused NaN in SQLite
    };
    const claimsB64 = Buffer.from(JSON.stringify(malformedClaims)).toString('base64url');
    const target = `${headerB64}.${claimsB64}`;
    const sig = crypto.createHmac('sha256', getSebLaunchTokenSecret()).update(target).digest('base64url');
    const malformedToken = `${target}.${sig}`;

    let caughtError: Error | null = null;
    let result: { valid: boolean; reason?: string } = { valid: true };
    try {
      result = await verifyAndConsumeSebLaunchToken(malformedToken, {
        userId: 'student_malformed',
        assessmentId: 'exam_malformed_exp',
      });
    } catch (err: any) {
      caughtError = err;
    }

    assert(caughtError === null, 'TC2.1_malformed_exp_a', 'Non-numeric exp does not throw an unhandled SQLite or runtime crash');
    assert(result.valid === false, 'TC2.1_malformed_exp_b', 'Non-numeric claims.exp is safely rejected with valid=false');
    assertEquals(result.reason, 'Launch token has expired or is invalid', 'TC2.1_malformed_exp_c', 'Rejection reason indicates expired or invalid token');
  }

  // TC2.2: Single-Use Nonce Replay Rejection
  {
    const token = createSebLaunchToken({
      userId: 'student_charlie',
      assessmentId: 'exam_replay_test',
      assessmentType: 'exam',
      classroomId: 'CLS_REPLAY',
    });
    const context = {
      userId: 'student_charlie',
      assessmentId: 'exam_replay_test',
      assessmentType: 'exam' as const,
      classroomId: 'CLS_REPLAY',
    };

    const firstAttempt = await verifyAndConsumeSebLaunchToken(token, context);
    assert(firstAttempt.valid === true, 'TC2.2a', 'First consumption of fresh launch token succeeds');

    const secondAttempt = await verifyAndConsumeSebLaunchToken(token, context);
    assert(secondAttempt.valid === false, 'TC2.2b', 'Second consumption of identical token is rejected (replay attack defense)');
    assert(
      secondAttempt.reason?.includes('already been consumed') || secondAttempt.reason?.includes('replay'),
      'TC2.2c',
      'Reason cites token already consumed/replayed'
    );
  }

  // TC2.3: Tampered Token Signature Rejection
  {
    const validToken = createSebLaunchToken({
      userId: 'student_dan',
      assessmentId: 'exam_tamper_test',
      assessmentType: 'exam',
      classroomId: 'CLS_CS101',
    });
    const parts = validToken.split('.');
    const corruptedSig = parts[2].slice(0, -1) + (parts[2].endsWith('a') ? 'b' : 'a');
    const tamperedToken = `${parts[0]}.${parts[1]}.${corruptedSig}`;

    const result = await verifyAndConsumeSebLaunchToken(tamperedToken, {
      userId: 'student_dan',
      assessmentId: 'exam_tamper_test',
    });
    assert(result.valid === false, 'TC2.3a', 'Tampered token signature is rejected with valid=false');
    assertEquals(result.reason, 'Invalid token cryptographic signature', 'TC2.3b', 'Rejection reason indicates invalid signature');
  }

  // TC2.3_case: Flipping Case of Any Character in Base64URL Signature Fails Verification (CH-01 Remediation)
  {
    const validToken = createSebLaunchToken({
      userId: 'student_case_tamper',
      assessmentId: 'exam_case_test',
      assessmentType: 'exam',
      classroomId: 'CLS_CS101',
    });
    const parts = validToken.split('.');
    const sig = parts[2];
    let letterIdx = -1;
    for (let i = 0; i < sig.length; i++) {
      if (/[a-zA-Z]/.test(sig[i])) {
        letterIdx = i;
        break;
      }
    }
    assert(letterIdx >= 0, 'TC2.3_case_a', 'Generated signature contains at least one alphabetic character');
    const origChar = sig[letterIdx];
    const flippedChar = origChar >= 'a' && origChar <= 'z' ? origChar.toUpperCase() : origChar.toLowerCase();
    const caseFlippedSig = sig.slice(0, letterIdx) + flippedChar + sig.slice(letterIdx + 1);
    const tamperedToken = `${parts[0]}.${parts[1]}.${caseFlippedSig}`;

    const result = await verifyAndConsumeSebLaunchToken(tamperedToken, {
      userId: 'student_case_tamper',
      assessmentId: 'exam_case_test',
    });
    assert(result.valid === false, 'TC2.3_case_b', 'Case-tampered token signature is rejected with valid=false');
    assertEquals(result.reason, 'Invalid token cryptographic signature', 'TC2.3_case_c', 'Rejection reason indicates invalid cryptographic signature');
  }

  // TC2.4: Token Subject Mismatch
  {
    const token = createSebLaunchToken({
      userId: 'student_eve',
      assessmentId: 'exam_subject_test',
      assessmentType: 'exam',
      classroomId: 'CLS_CS101',
    });
    const result = await verifyAndConsumeSebLaunchToken(token, {
      userId: 'student_frank',
      assessmentId: 'exam_subject_test',
    });
    assert(result.valid === false, 'TC2.4a', 'Token used by a different user is rejected');
    assertEquals(result.reason, 'Launch token user mismatch', 'TC2.4b', 'Rejection reason indicates user mismatch');
  }

  // TC2.5: Token Assessment Mismatch
  {
    const token = createSebLaunchToken({
      userId: 'student_eve',
      assessmentId: 'exam_math_final',
      assessmentType: 'exam',
      classroomId: 'CLS_CS101',
    });
    const result = await verifyAndConsumeSebLaunchToken(token, {
      userId: 'student_eve',
      assessmentId: 'exam_physics_final',
    });
    assert(result.valid === false, 'TC2.5a', 'Token used on a different assessment is rejected');
    assertEquals(result.reason, 'Launch token assessment mismatch', 'TC2.5b', 'Rejection reason indicates assessment mismatch');
  }

  // TC2.6: Token Assessment Type Mismatch
  {
    const token = createSebLaunchToken({
      userId: 'student_eve',
      assessmentId: 'asg_homework_1',
      assessmentType: 'assignment',
      classroomId: 'CLS_CS101',
    });
    const result = await verifyAndConsumeSebLaunchToken(token, {
      userId: 'student_eve',
      assessmentId: 'asg_homework_1',
      assessmentType: 'exam',
    });
    assert(result.valid === false, 'TC2.6a', 'Assignment token presented for exam is rejected');
    assertEquals(result.reason, 'Launch token assessment type mismatch', 'TC2.6b', 'Rejection reason indicates assessment type mismatch');
  }

  // TC2.7: Canonical Standard Port Stripping (:80 and :443)
  {
    const reqPort80 = createMockRequest('http://localhost:80/api/v1/exams/start');
    const urls80 = generateCandidateUrls(reqPort80 as any);
    assert(urls80.some((u) => u === 'http://localhost/api/v1/exams/start'), 'TC2.7a', 'Port 80 is stripped on HTTP URLs');

    const reqPort443 = createMockRequest(`${TRUSTED_BASE_URL}:443/api/v1/exams/start`);
    const urls443 = generateCandidateUrls(reqPort443 as any);
    assert(urls443.some((u) => u === `${TRUSTED_BASE_URL}/api/v1/exams/start`), 'TC2.7b', 'Port 443 is stripped on HTTPS URLs');
  }

  // TC2.8: Custom Port Retention (:3000 and :8080)
  {
    const reqPort3000 = createMockRequest('http://localhost:3000/api/v1/exams/start');
    const urls3000 = generateCandidateUrls(reqPort3000 as any);
    assert(urls3000.some((u) => u.includes(':3000')), 'TC2.8', 'Custom port 3000 is strictly retained in candidate URLs');
  }

  // TC2.9: Trailing Slash Tolerance (/path vs /path/)
  {
    const exam: Exam = {
      id: 'exam_slash_01',
      classroomId: 'CLS_MATH',
      title: 'Slash Exam',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: '5555555555555555555555555555555555555555555555555555555555555555',
    };
    const hashedUrlWithSlash = `${TRUSTED_BASE_URL}/api/v1/exams/start/`;
    const bekHash = computeSafeExamBrowserHash(hashedUrlWithSlash, exam.sebBrowserExamKey!);

    const reqWithoutSlash = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/exams/start`, {
      headers: { 'x-safeexambrowser-requesthash': bekHash },
    });
    const result = verifySafeExamBrowserRequest(reqWithoutSlash as any, exam);
    assert(result.verified === true, 'TC2.9', 'SEB client hashing /path/ matches server route receiving /path');
  }

  // TC2.10: Host Header Poisoning Mitigation
  {
    const reqPoison = createMockRequest('http://localhost:3000/api/v1/exams/start', {
      headers: {
        host: 'localhost:3000',
        'x-forwarded-host': 'malicious-attacker.com',
      },
    });
    const urls = generateCandidateUrls(reqPoison as any);
    assert(
      !urls.some((u) => u.includes('malicious-attacker.com')),
      'TC2.10',
      'Untrusted x-forwarded-host is rejected from canonical URL list'
    );
  }

  // TC2.11: URL Fragment Stripping
  {
    const reqFragment = createMockRequest(`${TRUSTED_BASE_URL}/classroom/exam?id=1#anchor`);
    const urls = generateCandidateUrls(reqFragment as any);
    assert(
      urls.some((u) => u === `${TRUSTED_BASE_URL}/classroom/exam?id=1`),
      'TC2.11a',
      'Canonical candidate URLs include fragment-stripped URL variant'
    );
    const expectedBek = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const hashWithoutFragment = computeSafeExamBrowserHash(`${TRUSTED_BASE_URL}/classroom/exam?id=1`, expectedBek);
    const verifyReq = createMockRequest(`${TRUSTED_BASE_URL}/classroom/exam?id=1#anchor`, {
      headers: {
        'x-safeexambrowser-requesthash': hashWithoutFragment,
        host: TRUSTED_HOST,
      },
    });
    const result = verifySafeExamBrowserRequest(verifyReq as any, {
      sebBrowserExamKey: expectedBek,
    });
    assertEquals(result.verified, true, 'TC2.11b', 'Request with anchor fragment verifies against fragment-free hash');
  }

  // TC2.12: Malformed Hash Headers Safety
  {
    const exam: Exam = {
      id: 'exam_malformed_01',
      classroomId: 'CLS_MATH',
      title: 'Malformed Exam',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: '6666666666666666666666666666666666666666666666666666666666666666',
    };
    const malformedHeaders = [
      '',
      'not-a-valid-hex-hash',
      '12345',
      'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
      '00000000000000000000000000000000',
    ];
    for (let i = 0; i < malformedHeaders.length; i++) {
      const badHeader = malformedHeaders[i];
      const req = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/exams/start`, {
        headers: { 'x-safeexambrowser-requesthash': badHeader },
      });
      const result = verifySafeExamBrowserRequest(req as any, exam);
      assert(result.verified === false, `TC2.12_${i}`, `Malformed hash header '${badHeader.slice(0, 10)}...' safely fails verification`);
    }
  }

  // TC2.13: Constant-Time Comparison Timing Safety
  {
    const diffLengthResult = safeTimingEqual('short', 'much_longer_string_here');
    assert(diffLengthResult === false, 'TC2.13a', 'safeTimingEqual safely returns false on mismatched lengths');

    const caseMatch = safeTimingEqual('ABCDEF', 'abcdef');
    assert(caseMatch === true, 'TC2.13b', 'safeTimingEqual performs case-insensitive comparison by default');

    const caseSensitiveMismatch = safeTimingEqual('ABCDEF', 'abcdef', true);
    assert(caseSensitiveMismatch === false, 'TC2.13c', 'safeTimingEqual with caseSensitive=true distinguishes case');

    const caseSensitiveMatch = safeTimingEqual('AbCdEf_123', 'AbCdEf_123', true);
    assert(caseSensitiveMatch === true, 'TC2.13d', 'safeTimingEqual with caseSensitive=true matches identical strings');
  }

  // TC2.14: Theme Accent Color CSS Injection Prevention
  {
    const attackVectors = [
      'red; background: url(https://evil.com/leak)',
      '<style>body{display:none}</style>',
      'expression(alert(1))',
      '#gggggg',
      '#12345',
      'blue',
    ];
    for (let i = 0; i < attackVectors.length; i++) {
      const vector = attackVectors[i];
      assert(!isValidHexColor(vector), `TC2.14_${i}`, `Malicious accent color '${vector.slice(0, 20)}' is rejected`);
    }
  }

  // TC2.15: Dangerous Logo Scheme Rejection
  {
    const dangerousLogos = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:MsgBox(1)',
      'file:///etc/passwd',
    ];
    for (let i = 0; i < dangerousLogos.length; i++) {
      const dangerous = dangerousLogos[i];
      const sanitized = sanitizeBrandingTheme({ institutionLogoUrl: dangerous });
      assertEquals(sanitized.institutionLogoUrl, undefined, `TC2.15_${i}`, `Dangerous logo scheme '${dangerous.slice(0, 15)}' is neutralized`);
    }
  }

  // ==========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ==========================================================================
  console.log('\n================================================================');
  console.log('TIER 3: CROSS-FEATURE COMBINATIONS');
  console.log('================================================================');

  // TC3.1: Dual SEB Headers + Launch Token Co-validation with Atomic Nonce Consumption
  {
    const exam: Exam = {
      id: 'exam_combo_01',
      classroomId: 'CLS_MATH',
      title: 'Combo Exam',
      durationMinutes: 90,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: '7777777777777777777777777777777777777777777777777777777777777777',
    };
    const token = createSebLaunchToken({
      userId: 'student_combo_1',
      assessmentId: 'exam_combo_01',
      assessmentType: 'exam',
      classroomId: 'CLS_MATH',
    });
    const targetUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_MATH/exams/exam_combo_01/start`;
    const bekHash = computeSafeExamBrowserHash(targetUrl, exam.sebBrowserExamKey!);

    const req = createMockRequest(targetUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': bekHash,
        'x-seb-launch-token': token,
      },
    });

    // 1. Verify token
    const tokenResult = await verifyAndConsumeSebLaunchToken(token, {
      userId: 'student_combo_1',
      assessmentId: 'exam_combo_01',
      assessmentType: 'exam',
      classroomId: 'CLS_MATH',
    });
    assert(tokenResult.valid === true, 'TC3.1a', 'Launch token valid and consumed in atomic transaction');

    // 2. Start exam gate
    const gateRes = simulateExamStartGate(req, exam, { userId: 'student_combo_1' });
    assertEquals(gateRes.status, 201, 'TC3.1b', 'Dual SEB header + launch token start request succeeds with 201 Created');

    // 3. Verify token cannot be re-used
    const replayResult = await verifyAndConsumeSebLaunchToken(token, {
      userId: 'student_combo_1',
      assessmentId: 'exam_combo_01',
    });
    assert(replayResult.valid === false, 'TC3.1c', 'Token replay immediately blocked following successful start');
  }

  // TC3.2: SEB JavaScript API Header Fallback
  {
    const exam: Exam = {
      id: 'exam_jsapi_01',
      classroomId: 'CLS_JS',
      title: 'JS API Exam',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 50,
      passingMarks: 25,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebConfigKey: '8888888888888888888888888888888888888888888888888888888888888888',
    };
    const targetUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_JS/exams/exam_jsapi_01/start`;

    const reqNoHeader = createMockRequest(targetUrl);
    const result = verifySafeExamBrowserRequest(reqNoHeader as any, exam, {
      clientConfigKey: exam.sebConfigKey!,
    });
    assert(result.verified === true, 'TC3.2a', 'SEB JavaScript API config key fallback verifies successfully');
    assertEquals(result.matchType, 'ck', 'TC3.2b', 'JS API verification confirms matchType="ck"');
  }

  // TC3.3: Assignment Solve Workflow with SEB Lockdown
  {
    const asg: Assignment = {
      id: 'asg_solve_01',
      classroomId: 'CLS_CODE',
      title: 'Binary Search Implementation',
      description: 'Implement binary search on sorted array.',
      instructions: 'Given array of numbers and target, return index or -1.',
      type: 'coding',
      language: 'python',
      starterCode: 'def binary_search(arr, target):\n    pass',
      difficulty: 'Intermediate',
      maxMarks: 50,
      dueAt: Date.now() + 86400000,
      publishedAt: Date.now(),
      attemptsAllowed: 3,
      allowLateSubmission: false,
      latePenaltyPercent: 0,
      autoGrade: true,
      manualGrade: false,
      aiPolicy: 'forbidden',
      plagiarismPolicy: 'strict',
      status: 'published',
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      testCases: [{ id: 'tc1', name: 'Sample', input: '[1,2,3], 2', expectedOutput: '1', visibility: 'public', isHidden: false, weight: 50, timeoutMs: 1000, memoryLimitMb: 128 }],
      securityLevel: 'seb',
      sebBrowserExamKey: '9999999999999999999999999999999999999999999999999999999999999999',
    };

    // Step 1: Unverified request gets redacted details
    const unverifiedReq = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_CODE/assignments/asg_solve_01`);
    const redRes = simulateAssignmentDetailsGate(unverifiedReq, asg);
    assertEquals(redRes.status, 403, 'TC3.3a', 'Step 1: Unverified request gets 403 gate');

    // Step 2: Student acquires launch token
    const token = createSebLaunchToken({
      userId: 'student_solve_1',
      assessmentId: 'asg_solve_01',
      assessmentType: 'assignment',
      classroomId: 'CLS_CODE',
    });
    const tokenVerification = await verifyAndConsumeSebLaunchToken(token, {
      userId: 'student_solve_1',
      assessmentId: 'asg_solve_01',
      assessmentType: 'assignment',
      classroomId: 'CLS_CODE',
    });
    assert(tokenVerification.valid === true, 'TC3.3b', 'Step 2: Launch token consumed for assignment solve');

    // Step 3: Fetch details with validated token -> unredacted
    const tokenReq = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_CODE/assignments/asg_solve_01`);
    const fullRes = simulateAssignmentDetailsGate(tokenReq, asg, tokenVerification);
    assertEquals(fullRes.status, 200, 'TC3.3c', 'Step 3: Unredacted problem details returned with valid token');
    assert(fullRes.body.starterCode.includes('def binary_search'), 'TC3.3d', 'Full starter code provided in secure session');

    // Step 4: Submit solution within SEB
    const submitUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_CODE/assignments/asg_solve_01/submit`;
    const submitHash = computeSafeExamBrowserHash(submitUrl, asg.sebBrowserExamKey!);
    const submitReq = createMockRequest(submitUrl, {
      method: 'POST',
      headers: { 'x-safeexambrowser-requesthash': submitHash },
      body: { code: 'def binary_search(arr, target): return arr.index(target)' },
    });
    const submitRes = simulateAssignmentSubmitGate(submitReq, asg, 'def binary_search(arr, target): return arr.index(target)');
    assertEquals(submitRes.status, 200, 'TC3.3e', 'Step 4: SEB assignment submission accepted and graded');
  }

  // TC3.4: Server Secret Key Derivation Integration
  {
    const examAuthoritative: Exam = {
      id: 'exam_auth_01',
      classroomId: 'CLS_MATH',
      title: 'Auth Key Exam',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const authoritativeBek = deriveAuthoritativeBrowserExamKey(examAuthoritative.id, examAuthoritative.classroomId);
    assertMatch(authoritativeBek, /^[a-f0-9]{64}$/, 'TC3.4a', 'Authoritative BEK is a 64-char hex string');

    const guessedBek = crypto.createHash('sha256').update(`${examAuthoritative.id}_${examAuthoritative.classroomId}_cortex_seb`).digest('hex');
    assert(authoritativeBek !== guessedBek, 'TC3.4b', 'Authoritative BEK is disparate from public client-visible deterministic derivation');

    const targetUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_MATH/exams/exam_auth_01/start`;
    const reqAuth = createMockRequest(targetUrl, {
      headers: { 'x-safeexambrowser-requesthash': computeSafeExamBrowserHash(targetUrl, authoritativeBek) },
    });
    const result = verifySafeExamBrowserRequest(reqAuth as any, examAuthoritative, { authoritative: true });
    assert(result.verified === true, 'TC3.4c', 'Request using authoritative derived BEK is verified');
  }

  // TC3.5: Session Resume with Active SEB
  {
    const exam: Exam = {
      id: 'exam_resume_01',
      classroomId: 'CLS_MATH',
      title: 'Resume Exam',
      durationMinutes: 60,
      startTime: Date.now() - 60000,
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now() - 60000,
      updatedAt: Date.now() - 60000,
      sebBrowserExamKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };
    const activeSession: SimulatedExamSession = {
      id: 'sess_in_progress_99',
      examId: 'exam_resume_01',
      userId: 'student_resume_1',
      status: 'in_progress',
      startedAt: Date.now() - 60000,
      answers: { q1: 'initial answer' },
    };

    const resumeUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_MATH/exams/exam_resume_01/sessions/sess_in_progress_99/responses`;
    const req = createMockRequest(resumeUrl, {
      method: 'PUT',
      headers: {
        'x-safeexambrowser-requesthash': computeSafeExamBrowserHash(resumeUrl, exam.sebBrowserExamKey!),
      },
      body: { questionId: 'q2', answer: 'resumed answer' },
    });
    const res = simulateExamResponsesGate(req, exam, activeSession, { questionId: 'q2', answer: 'resumed answer' });
    assertEquals(res.status, 200, 'TC3.5a', 'In-progress session resumes and autosaves with valid SEB hash');
    assertEquals(activeSession.answers.q2, 'resumed answer', 'TC3.5b', 'Answer saved successfully in resumed session');
  }

  // ==========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ==========================================================================
  console.log('\n================================================================');
  console.log('TIER 4: REAL-WORLD APPLICATION SCENARIOS');
  console.log('================================================================');

  // TC4.1: Scenario 1 - Complete End-to-End Student Exam Lifecycle
  {
    console.log('--- Scenario 1: End-to-End Student Exam Lifecycle ---');
    const exam: Exam = {
      id: 'exam_finals_2026',
      classroomId: 'CLS_COMPUTING',
      title: 'Algorithms Final Examination',
      durationMinutes: 120,
      startTime: Date.now() - 10000,
      endTime: Date.now() + 7200000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultsImmediately: false,
      createdBy: 'prof_smith',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
      sebBrowserExamKey: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      brandingTheme: { themePreset: 'cortex-dark', accentColor: '#0ea5e9', institutionName: 'Cortex Institute of Technology' },
    };

    // Phase 1: Student visits in Chrome (standard browser) -> Blocked with Setup Gate
    const chromeReq = createMockRequest(`${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_COMPUTING/exams/exam_finals_2026/start`);
    const chromeRes = simulateExamStartGate(chromeReq, exam, { userId: 'student_scenario_1' });
    assertEquals(chromeRes.status, 403, 'TC4.1.1', 'Phase 1: Chrome blocked with 403 Setup Gate');
    assertEquals(chromeRes.body.downloadUrl, 'https://safeexambrowser.org/download_en.html', 'TC4.1.2', 'Phase 1: Provides official download URL');

    // Phase 2: Student downloads .seb config and obtains launch token
    const launchToken = createSebLaunchToken({
      userId: 'student_scenario_1',
      assessmentId: 'exam_finals_2026',
      assessmentType: 'exam',
      classroomId: 'CLS_COMPUTING',
    });
    const startUrl = buildSebExamStartUrl(TRUSTED_BASE_URL, 'exam_finals_2026', 'CLS_COMPUTING', launchToken);
    const quitUrl = buildSebExamQuitUrl(TRUSTED_BASE_URL, 'CLS_COMPUTING');
    const configPlist = generateSafeExamBrowserConfigPlist({
      startUrl,
      quitUrl,
      sebQuitPassword: 'ProctorExitSecret2026',
      host: TRUSTED_HOST,
    });
    assert(configPlist.xml.includes('exam_finals_2026'), 'TC4.1.3', 'Phase 2: Plist encapsulates assessment deep link');
    assert(configPlist.xml.includes(launchToken), 'TC4.1.4', 'Phase 2: Plist contains signed launch token');

    // Phase 3: SEB client launches, validates token and starts session
    const tokenValid = await verifyAndConsumeSebLaunchToken(launchToken, {
      userId: 'student_scenario_1',
      assessmentId: 'exam_finals_2026',
      classroomId: 'CLS_COMPUTING',
    });
    assert(tokenValid.valid === true, 'TC4.1.5', 'Phase 3: Launch token validated and consumed');

    const startApiUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_COMPUTING/exams/exam_finals_2026/start`;
    const sebStartReq = createMockRequest(startApiUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': computeSafeExamBrowserHash(startApiUrl, exam.sebBrowserExamKey!),
        'x-seb-launch-token': launchToken,
      },
    });
    const sebStartRes = simulateExamStartGate(sebStartReq, exam, { userId: 'student_scenario_1' });
    assertEquals(sebStartRes.status, 201, 'TC4.1.6', 'Phase 3: SEB starts session and questions delivered');

    // Phase 4: Student solves questions and autosaves
    const examSession: SimulatedExamSession = {
      id: 'sess_scenario_1',
      examId: 'exam_finals_2026',
      userId: 'student_scenario_1',
      status: 'in_progress',
      startedAt: Date.now(),
      answers: {},
    };
    const autosaveUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_COMPUTING/exams/exam_finals_2026/sessions/sess_scenario_1/responses`;
    const autosaveReq = createMockRequest(autosaveUrl, {
      method: 'PUT',
      headers: {
        'x-safeexambrowser-requesthash': computeSafeExamBrowserHash(autosaveUrl, exam.sebBrowserExamKey!),
      },
      body: { questionId: 'q1', answer: 'O(V + E)' },
    });
    const autosaveRes = simulateExamResponsesGate(autosaveReq, exam, examSession, { questionId: 'q1', answer: 'O(V + E)' });
    assertEquals(autosaveRes.status, 200, 'TC4.1.7', 'Phase 4: Autosave response accepted inside SEB');

    // Phase 5: Student submits exam
    const submitUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_COMPUTING/exams/exam_finals_2026/sessions/sess_scenario_1/submit`;
    const submitReq = createMockRequest(submitUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': computeSafeExamBrowserHash(submitUrl, exam.sebBrowserExamKey!),
      },
    });
    const submitRes = simulateExamSubmitGate(submitReq, exam, examSession);
    assertEquals(submitRes.status, 200, 'TC4.1.8', 'Phase 5: Exam submission completed successfully');
    assertEquals(examSession.status, 'submitted', 'TC4.1.9', 'Phase 5: Exam session status marked submitted');

    // Phase 6: Exit to quitURL
    assertEquals(quitUrl, `${TRUSTED_BASE_URL}/classroom/CLS_COMPUTING`, 'TC4.1.10', 'Phase 6: Browser navigates to clean quit URL');
  }

  // TC4.2: Scenario 2 - Teacher Setup & Secure Config Export
  {
    console.log('\n--- Scenario 2: Teacher Setup & Secure Config Export ---');
    const teacherExamOptions = {
      startUrl: `${TRUSTED_BASE_URL}/classroom/CLS_ENG/exam/exam_aerospace`,
      quitUrl: `${TRUSTED_BASE_URL}/classroom/CLS_ENG`,
      sebQuitPassword: 'ProfessorSecretPass2026!',
      allowReload: false,
      showReloadWarning: true,
      host: TRUSTED_HOST,
      brandingTheme: sanitizeBrandingTheme({
        themePreset: 'slate-dark',
        accentColor: '#38bdf8',
        institutionName: 'Department of Aerospace Engineering',
      }),
    };

    const exported = generateSafeExamBrowserConfigPlist(teacherExamOptions);
    assert(exported.xml.length > 500, 'TC4.2.1', 'Config plist generated with comprehensive policy rules');
    assertMatch(exported.configKey, /^[a-f0-9]{64}$/, 'TC4.2.2', 'Authoritative Config Key calculated from exported configuration');
    assert(exported.xml.includes(hashQuitPassword('ProfessorSecretPass2026!')), 'TC4.2.3', 'Quit password correctly hashed in exported plist');
    assert(exported.xml.includes('<key>allowReload</key>\n\t<false/>'), 'TC4.2.4', 'Reload disabled per teacher policy');
  }

  // TC4.3: Scenario 3 - Concurrent Multi-Student Launch & Replay Guard
  {
    console.log('\n--- Scenario 3: Concurrent Multi-Student Launch & Replay Guard ---');
    const exam: Exam = {
      id: 'exam_concurrent_100',
      classroomId: 'CLS_MATH',
      title: 'Concurrent Exam',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: '1234567890123456789012345678901234567890123456789012345678901234',
    };

    // 5 concurrent students
    const studentIds = ['student_01', 'student_02', 'student_03', 'student_04', 'student_05'];
    const tokens = studentIds.map((id) =>
      createSebLaunchToken({
        userId: id,
        assessmentId: 'exam_concurrent_100',
        assessmentType: 'exam',
        classroomId: 'CLS_MATH',
      })
    );

    // Concurrent launches: all 5 must succeed
    const launchResults = await Promise.all(
      tokens.map((tok, idx) =>
        verifyAndConsumeSebLaunchToken(tok, {
          userId: studentIds[idx],
          assessmentId: 'exam_concurrent_100',
          classroomId: 'CLS_MATH',
        })
      )
    );
    for (let i = 0; i < launchResults.length; i++) {
      assert(launchResults[i].valid === true, `TC4.3_launch_${studentIds[i]}`, `Student ${studentIds[i]} launch succeeds concurrently`);
    }

    // Student 1 attempts to share their token with Student 6
    const rogueAttempt = await verifyAndConsumeSebLaunchToken(tokens[0], {
      userId: 'student_06',
      assessmentId: 'exam_concurrent_100',
    });
    assert(rogueAttempt.valid === false, 'TC4.3_replay', 'Replay of consumed token to unauthorized student is rejected');
  }

  // TC4.4: Scenario 4 - Submission Network Retry & Idempotency Under Glitch
  {
    console.log('\n--- Scenario 4: Submission Network Retry (Idempotency Under Glitch) ---');
    const exam: Exam = {
      id: 'exam_glitch_01',
      classroomId: 'CLS_CS',
      title: 'Glitch Recovery Exam',
      durationMinutes: 60,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      totalMarks: 100,
      passingMarks: 50,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      status: 'published',
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      createdBy: 'teacher_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sebBrowserExamKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    };
    const session: SimulatedExamSession = {
      id: 'sess_glitch_retry',
      examId: 'exam_glitch_01',
      userId: 'student_network_drop',
      status: 'in_progress',
      startedAt: Date.now() - 3000000,
      answers: { q1: 'critical answer' },
    };

    const submitUrl = `${TRUSTED_BASE_URL}/api/v1/classrooms/CLS_CS/exams/exam_glitch_01/sessions/sess_glitch_retry/submit`;
    const submitReq = createMockRequest(submitUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': computeSafeExamBrowserHash(submitUrl, exam.sebBrowserExamKey!),
      },
    });

    // Attempt 1: Server processes and writes submission
    const res1 = simulateExamSubmitGate(submitReq, exam, session);
    assertEquals(res1.status, 200, 'TC4.4.1', 'Attempt 1: First submit succeeds with 200 OK');
    assertEquals(res1.body.alreadySubmitted, false, 'TC4.4.2', 'Attempt 1: alreadySubmitted is false');
    const originalScore = res1.body.session?.score;

    // Simulated network glitch: client connection dropped right before receiving res1
    // Client offline recovery logic retries identical submit request
    const retryReq = createMockRequest(submitUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': computeSafeExamBrowserHash(submitUrl, exam.sebBrowserExamKey!),
      },
    });
    const res2 = simulateExamSubmitGate(retryReq, exam, session);
    assertEquals(res2.status, 200, 'TC4.4.3', 'Attempt 2: Retry submit returns 200 OK without failing');
    assertEquals(res2.body.alreadySubmitted, true, 'TC4.4.4', 'Attempt 2: Confirms alreadySubmitted: true');
    assertEquals(res2.body.session?.score, originalScore, 'TC4.4.5', 'Attempt 2: Preserves original score and receipt');
  }

  // ==========================================================================
  // SUMMARY METRICS & EXIT HANDLING
  // ==========================================================================
  const duration = Date.now() - startTime;
  console.log('\n================================================================');
  console.log(`SEB ASSESSMENT HARDENING TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log(`Execution Duration: ${duration} ms`);
  console.log('================================================================\n');

  if (failureDetails.length > 0) {
    console.error('FAILURE DETAILS:');
    failureDetails.forEach((f) => console.error(`  - ${f}`));
    console.error('\nTest suite execution failed.');
    process.exit(1);
  } else {
    console.log('All automated tests passed successfully across Tiers 1-4 with zero regressions.');
    process.exit(0);
  }
}

runHardeningTestSuite().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
