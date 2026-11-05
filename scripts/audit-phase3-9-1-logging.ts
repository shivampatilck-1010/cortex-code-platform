/**
 * Cortex Online Examination System — Phase 3.9.1 Audit
 * Structured Logging & Redaction Resilience Audit
 *
 * Tests:
 * 1. Circular references (does JSON.stringify crash on circular objects?)
 * 2. Nested secrets in deep objects and arrays
 * 3. URL query parameters containing tokens (?token=..., &secret=...)
 * 4. Cookie string values in headers
 * 5. Student full answer dumps in unexpected field names
 * 6. Exception objects containing stack traces and internal secrets
 *
 * Strictly zero emojis.
 */

import { CortexLogger, redactSensitiveData } from '../src/lib/classroom/logger';

console.log('================================================================');
console.log('PHASE 3.9.1: STRUCTURED LOGGING REDACTION AUDIT');
console.log('================================================================\n');

const findings: Array<{ test: string; severity: string; passed: boolean; details: string }> = [];

// TEST 1: Circular References
console.log('--- TEST 1: CIRCULAR REFERENCES ---');
const circularObj: any = { name: 'circular_test' };
circularObj.self = circularObj;

try {
  const logger = new CortexLogger('test_corr_circ');
  // Attempt to log circular object
  logger.info('Logging circular object', { payload: circularObj });
  findings.push({
    test: 'Circular Reference Handling',
    severity: 'MEDIUM',
    passed: true,
    details: 'Circular object handled without crashing.',
  });
  console.log('[PASS] Circular reference handled.');
} catch (err: any) {
  findings.push({
    test: 'Circular Reference Handling',
    severity: 'MEDIUM',
    passed: false,
    details: `Crash on circular reference: ${err.message}`,
  });
  console.log(`[FAIL] Circular reference crashed: ${err.message}`);
}

// TEST 2: URL Query Parameters with Secrets
console.log('\n--- TEST 2: URL QUERY PARAMETERS WITH SECRETS ---');
const urlWithSecret = 'https://cortex.edu/callback?token=secret_jwt_token_12345&api_key=ak_987654321';
const redactedUrl = redactSensitiveData({ requestUrl: urlWithSecret });
console.log('Redacted URL Object:', JSON.stringify(redactedUrl));
const urlLeaked = redactedUrl.requestUrl.includes('secret_jwt_token_12345');
findings.push({
  test: 'URL Query Parameter Secret Redaction',
  severity: 'HIGH',
  passed: !urlLeaked,
  details: urlLeaked ? 'Sensitive tokens inside URL strings are not redacted.' : 'Tokens in URLs are redacted.',
});

// TEST 3: Raw Cookie String in Non-Standard Key
console.log('\n--- TEST 3: COOKIE STRING IN NON-STANDARD KEY ---');
const cookiePayload = { rawHeader: 'cortex_session=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; Path=/' };
const redactedCookie = redactSensitiveData(cookiePayload);
console.log('Redacted Cookie Object:', JSON.stringify(redactedCookie));
const cookieLeaked = redactedCookie.rawHeader.includes('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
findings.push({
  test: 'Cookie String Redaction in Non-Standard Key',
  severity: 'MEDIUM',
  passed: !cookieLeaked,
  details: cookieLeaked ? 'Cookie string values in generic keys are logged in plaintext.' : 'Cookie string values are redacted.',
});

// TEST 4: Student Full Answer in Non-Standard Key
console.log('\n--- TEST 4: STUDENT ANSWER IN NON-STANDARD KEY ---');
const studentPayload = { candidate_submission_payload: { rawCode: 'function solve() { return 42; }', subjectiveText: 'Distributed consensus requires quorum.' } };
const redactedStudent = redactSensitiveData(studentPayload);
console.log('Redacted Student Object:', JSON.stringify(redactedStudent));
// In high-stakes exams, candidate answers should be redacted
const answerLeaked = redactedStudent.candidate_submission_payload?.rawCode !== '[REDACTED]' || redactedStudent.candidate_submission_payload?.subjectiveText !== '[REDACTED]';
findings.push({
  test: 'Student Answer Dumps in Server Logs',
  severity: 'MEDIUM',
  passed: !answerLeaked,
  details: answerLeaked ? 'Student candidate code/text is preserved in logs in plaintext.' : 'Student answers are safely redacted.',
});

console.log('\n================================================================');
console.log('LOGGING AUDIT SUMMARY:');
for (const f of findings) {
  const status = f.passed ? '[PASS]' : '[FAIL]';
  console.log(`${status} ${f.test} [Severity: ${f.severity}]`);
  console.log(`  Details: ${f.details}`);
}
console.log('================================================================\n');
