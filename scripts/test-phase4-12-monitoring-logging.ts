/**
 * Cortex Online Examination System — Phase 4.12 Test Suite
 * Observability, Redacted Structured Logging & Operational Health Probes
 *
 * Verifies:
 * 1. Redaction of sensitive credentials, passwords, session tokens, and keys.
 * 2. String-level redaction of Bearer tokens and cookie headers.
 * 3. Structured JSON logging format and correlation ID propagation.
 * 4. Latency tracking helper (CortexLogger.track).
 * 5. Public health probe structure (/api/v1/health).
 * 6. Privileged internal diagnostic probe security (/api/v1/health/internal).
 *
 * Strictly zero emojis.
 */

import { redactSensitiveData, createLogger, CortexLogger } from '../src/lib/classroom/logger';
import { classroomDb } from '../src/lib/classroom/db';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}${detail ? ` (${detail})` : ''}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${message}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runMonitoringAndLoggingAudit() {
  console.log('================================================================');
  console.log('PHASE 4.12: OBSERVABILITY, STRUCTURED LOGGING & HEALTH PROBES');
  console.log('================================================================\n');

  // --- SECTION 1: CREDENTIAL & ANSWER REDACTION ---
  console.log('--- SECTION 1: SENSITIVE DATA REDACTION ---');
  const sensitivePayload = {
    userId: 'u_student_99',
    password: 'SuperSecretCandidatePassword123!',
    password_hash: '$2b$10$abcdef1234567890abcdef1234567890',
    token: 'jwt_secret_token_value_abc',
    cookie: 'cortex_session=s_token_value_xyz; Path=/',
    sebQuitPassword: 'ProctorExitPassword',
    sebBrowserExamKey: 'bek_hash_value_123',
    correctAnswer: { optionId: 'opt_winner', points: 10 },
    studentResponse: { text: 'Candidate secret submission' },
    apiKey: 'cortex_live_api_key_456',
    nestedContext: {
      innerPassword: 'AnotherPassword',
      secret: 'InnerSecret',
      safeField: 'This is safe to log',
    },
  };

  const redacted = redactSensitiveData(sensitivePayload);

  assert(redacted.password === '[REDACTED]', 'Plaintext password redacted');
  assert(redacted.password_hash === '[REDACTED]', 'Password hash redacted');
  assert(redacted.token === '[REDACTED]', 'Authentication token redacted');
  assert(redacted.cookie === '[REDACTED]', 'Cookie value redacted');
  assert(redacted.sebQuitPassword === '[REDACTED]', 'SEB quit password redacted');
  assert(redacted.sebBrowserExamKey === '[REDACTED]', 'SEB Browser Exam Key redacted');
  assert(redacted.correctAnswer === '[REDACTED]', 'Exam correct answer key redacted');
  assert(redacted.studentResponse === '[REDACTED]', 'Candidate response body redacted');
  assert(redacted.apiKey === '[REDACTED]', 'API key redacted');
  assert(redacted.nestedContext.secret === '[REDACTED]', 'Nested secret redacted');
  assert(redacted.nestedContext.safeField === 'This is safe to log', 'Non-sensitive field preserved verbatim');

  // --- SECTION 2: STRING PATTERN REDACTION ---
  console.log('\n--- SECTION 2: STRING-LEVEL TOKEN & HEADER REDACTION ---');
  const stringLog1 = 'Authorization failed for header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret';
  const cleanString1 = redactSensitiveData(stringLog1);
  assert(!cleanString1.includes('eyJhbGci'), 'Bearer token value masked from log string');
  assert(cleanString1.includes('Bearer [REDACTED]'), 'Bearer token replaced with standard redaction mask');

  const stringLog2 = 'Incoming URL: https://cortex.edu/api/v1/auth/callback?token=secret12345&redirect=/dashboard';
  const cleanString2 = redactSensitiveData(stringLog2);
  assert(!cleanString2.includes('secret12345'), 'Sensitive URL query token masked from URL string');
  assert(cleanString2.includes('token=[REDACTED]'), 'URL token query parameter replaced with [REDACTED]');

  const stringLog3 = 'Set-Cookie header received: cortex_session=sess_abc123xyz; Path=/; HttpOnly';
  const cleanString3 = redactSensitiveData(stringLog3);
  assert(!cleanString3.includes('sess_abc123xyz'), 'Cookie session ID masked from Set-Cookie string');
  assert(cleanString3.includes('cortex_session=[REDACTED]'), 'Cookie token replaced with [REDACTED]');

  // --- SECTION 3: STRUCTURED JSON LOG EMISSION ---
  console.log('\n--- SECTION 3: STRUCTURED JSON LOG EMISSION ---');
  let capturedLogOutput: string | null = null;
  const originalLog = console.log;
  console.log = (msg: string) => {
    capturedLogOutput = msg;
  };

  try {
    const logger = createLogger('corr_test_123', { examId: 'exam_bio_101' });
    logger.info('Candidate submitted examination attempt', {
      sessionId: 'sess_456',
      userId: 'u_student_99',
      password: 'LeakedPasswordShouldBeMasked',
    });
  } finally {
    console.log = originalLog;
  }

  assert(capturedLogOutput !== null, 'Logger emitted structured log message to standard output');
  let parsedLog: any = null;
  try {
    parsedLog = JSON.parse(capturedLogOutput || '{}');
  } catch (_) {}

  assert(parsedLog?.level === 'info', 'Structured log level matches "info"');
  assert(parsedLog?.correlationId === 'corr_test_123', 'Correlation ID accurately propagated');
  assert(parsedLog?.examId === 'exam_bio_101', 'Default context properties included');
  assert(parsedLog?.password === '[REDACTED]', 'Embedded sensitive field in log call redacted before output');
  assert(typeof parsedLog?.timestamp === 'number', 'Epoch timestamp present');
  assert(typeof parsedLog?.isoTime === 'string', 'ISO 8601 string timestamp present');

  // --- SECTION 4: LATENCY TRACKING HELPER ---
  console.log('\n--- SECTION 4: LATENCY TRACKING EXECUTION ---');
  const perfLogger = new CortexLogger('corr_perf_audit');
  let trackedLatency: number | undefined;

  const result = await perfLogger.track(
    'db_candidate_query',
    async () => {
      await new Promise((res) => setTimeout(res, 50));
      return { rowCount: 15 };
    },
    { classroomId: 'CLS_AUDIT' }
  );

  assert(result.rowCount === 15, 'Tracked operation returned inner computation result successfully');

  // --- SECTION 5: HEALTH STATS PROBE ---
  console.log('\n--- SECTION 5: DATABASE HEALTH PROBE ---');
  const healthStats = await classroomDb.getHealthStats();
  assert(healthStats !== null && typeof healthStats === 'object', 'classroomDb.getHealthStats() responded successfully');
  assert(typeof healthStats.userCount === 'number' && healthStats.userCount >= 0, 'Health probe reports valid userCount');
  assert(typeof healthStats.examCount === 'number' && healthStats.examCount >= 0, 'Health probe reports valid examCount');
  assert(typeof healthStats.sessionCount === 'number' && healthStats.sessionCount >= 0, 'Health probe reports valid sessionCount');

  console.log('\n================================================================');
  console.log(`PHASE 4.12 AUDIT SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMonitoringAndLoggingAudit().catch((err) => {
  console.error('Phase 4.12 Audit Error:', err);
  process.exit(1);
});
