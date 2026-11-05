// Cortex Online Examination System — Phase 3.3 Workstream A: Official SEB Protocol Verification
// Tests official Safe Exam Browser 3.x cryptographic protocol compliance with independent test vectors.

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import {
  verifySafeExamBrowserRequest,
  getExpectedBrowserExamKey,
  computeSafeExamBrowserHash,
  hashQuitPassword,
} from '../src/lib/classroom/seb-security';
import { Exam } from '../src/lib/classroom/models';

console.log('================================================================');
console.log('CORTEX ONLINE EXAMINATION SYSTEM — PHASE 3.3 SEB PROTOCOL SUITE');
console.log('Validating Safe Exam Browser 3.x cryptographic protocol compliance');
console.log('================================================================\n');

// Independent test vectors (computed using native crypto without internal helper)
const TEST_BEK = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const TEST_CK = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

const testExam: Exam = {
  id: 'exam_seb_protocol_test',
  classroomId: 'C1-CS901',
  title: 'SEB Cryptographic Protocol Verification',
  description: 'Validating official SEB 3.x protocol conformance',
  durationMinutes: 60,
  startTime: Date.now() - 1000,
  endTime: Date.now() + 3600000,
  totalMarks: 100,
  passingMarks: 40,
  attemptsAllowed: 1,
  securityLevel: 'seb',
  sebBrowserExamKey: TEST_BEK,
  sebConfigKey: TEST_CK,
  sebQuitPasswordHash: crypto.createHash('sha256').update('ExitSecure2026').digest('hex'),
  status: 'published',
  shuffleQuestions: 0,
  shuffleOptions: 0,
  showResultsImmediately: 0,
  createdBy: 'teacher_1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${name}${details ? ': ' + details : ''}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${name}${details ? ': ' + details : ''}`);
  }
}

// Independent test vector generator using standard Node crypto
function makeOfficialSebHash(url: string, key: string): string {
  return crypto.createHash('sha256').update(url + key).digest('hex').toLowerCase();
}

function runSebProtocolTests() {
  const baseUrl = 'http://localhost:3000/api/v1/classrooms/C1-CS901/exams/exam_seb_protocol_test/start';

  // 1. Correct SEB Request with Valid Browser Exam Key Hash
  {
    const expectedHash = makeOfficialSebHash(baseUrl, TEST_BEK);
    const req = new NextRequest(baseUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': expectedHash,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === true && result.matchType === 'bek', 'Scenario 1: Correct SEB request with valid BEK hash verified');
  }

  // 2. Forged Request Hash
  {
    const forgedHash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const req = new NextRequest(baseUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': forgedHash,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === false, 'Scenario 2: Forged request hash rejected with false');
  }

  // 3. Forged Config Key Hash
  {
    const forgedCkHash = 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00';
    const req = new NextRequest(baseUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-configkeyhash': forgedCkHash,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === false, 'Scenario 3: Forged Config Key hash rejected with false');
  }

  // 4. Modified Request URL (Hash computed for URL A, sent to URL B)
  {
    const originalUrl = `${baseUrl}?cohort=A`;
    const modifiedUrl = `${baseUrl}?cohort=B`;
    const hashForOriginal = makeOfficialSebHash(originalUrl, TEST_BEK);
    const req = new NextRequest(modifiedUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': hashForOriginal,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === false, 'Scenario 4: Modified request URL rejected due to hash mismatch');
  }

  // 5. Invalid Hostname
  {
    const invalidUrl = 'http://attacker-controlled-site.org/api/v1/classrooms/C1-CS901/exams/exam_seb_protocol_test/start';
    const hash = makeOfficialSebHash(invalidUrl, TEST_BEK);
    const req = new NextRequest(invalidUrl, {
      method: 'POST',
      headers: {
        host: 'attacker-controlled-site.org',
        'x-safeexambrowser-requesthash': hash,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === false, 'Scenario 5: Invalid untrusted hostname rejected from candidate URLs');
  }

  // 6. Untrusted Forwarded Host
  {
    const untrustedFwdHost = 'phishing.attacker.com';
    const forgedFwdUrl = `http://${untrustedFwdHost}/api/v1/classrooms/C1-CS901/exams/exam_seb_protocol_test/start`;
    const hash = makeOfficialSebHash(forgedFwdUrl, TEST_BEK);
    const req = new NextRequest(baseUrl, {
      method: 'POST',
      headers: {
        'x-forwarded-host': untrustedFwdHost,
        'x-safeexambrowser-requesthash': hash,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === false, 'Scenario 6: Untrusted x-forwarded-host header ignored and rejected');
  }

  // 7. Untrusted Forwarded Protocol
  {
    const weirdProto = 'javascript';
    const forgedProtoUrl = `${weirdProto}://localhost:3000/api/v1/classrooms/C1-CS901/exams/exam_seb_protocol_test/start`;
    const hash = makeOfficialSebHash(forgedProtoUrl, TEST_BEK);
    const req = new NextRequest(baseUrl, {
      method: 'POST',
      headers: {
        'x-forwarded-proto': weirdProto,
        'x-safeexambrowser-requesthash': hash,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === false, 'Scenario 7: Untrusted forwarded protocol rejected');
  }

  // 8. Incorrect Query String
  {
    const hashWithoutQuery = makeOfficialSebHash(baseUrl, TEST_BEK);
    const reqWithQuery = new NextRequest(`${baseUrl}?attempt=2&flag=true`, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-requesthash': hashWithoutQuery,
      },
    });
    const result = verifySafeExamBrowserRequest(reqWithQuery, testExam);
    assert(result.verified === false, 'Scenario 8: Hash missing query string rejected when query parameters present');
  }

  // 9. Missing Headers
  {
    const req = new NextRequest(baseUrl, {
      method: 'POST',
      headers: {},
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(
      result.verified === false && typeof result.reason === 'string' && result.reason.includes('Missing Safe Exam Browser'),
      'Scenario 9: Missing SEB headers rejected with explicit reason'
    );
  }

  // 10. Malformed Hashes (wrong length, non-hex, null bytes)
  {
    const malformedReq1 = new NextRequest(baseUrl, {
      method: 'POST',
      headers: { 'x-safeexambrowser-requesthash': 'not-a-hex-hash' },
    });
    const r1 = verifySafeExamBrowserRequest(malformedReq1, testExam);

    const malformedReq2 = new NextRequest(baseUrl, {
      method: 'POST',
      headers: { 'x-safeexambrowser-requesthash': 'a1b2c3' }, // too short
    });
    const r2 = verifySafeExamBrowserRequest(malformedReq2, testExam);

    const malformedReq3 = new NextRequest(baseUrl, {
      method: 'POST',
      headers: { 'x-safeexambrowser-configkeyhash': 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz' },
    });
    const r3 = verifySafeExamBrowserRequest(malformedReq3, testExam);

    assert(r1.verified === false && r2.verified === false && r3.verified === false, 'Scenario 10: Malformed and invalid hash formats rejected safely');
  }

  // 11. Valid Reverse-Proxy Request with Trusted Forwarded Host
  {
    const trustedHost = 'cortex-code-platform.cortexbuild1.workers.dev';
    const proxyUrl = `https://${trustedHost}/api/v1/classrooms/C1-CS901/exams/exam_seb_protocol_test/start`;
    const hash = makeOfficialSebHash(proxyUrl, TEST_BEK);
    const req = new NextRequest(baseUrl, {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        'x-forwarded-host': trustedHost,
        'x-forwarded-proto': 'https',
        'x-safeexambrowser-requesthash': hash,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === true && result.matchType === 'bek', 'Scenario 11: Valid reverse-proxy request with trusted forwarded host verified');
  }

  // 12. Valid Config Key (CK) Request
  {
    const expectedCkHash = makeOfficialSebHash(baseUrl, TEST_CK);
    const req = new NextRequest(baseUrl, {
      method: 'POST',
      headers: {
        'x-safeexambrowser-configkeyhash': expectedCkHash,
      },
    });
    const result = verifySafeExamBrowserRequest(req, testExam);
    assert(result.verified === true && result.matchType === 'ck', 'Scenario 12: Valid Config Key (CK) request verified');
  }

  console.log('\n================================================================');
  console.log('PHASE 3.3 SEB PROTOCOL SUITE SUMMARY');
  console.log('================================================================');
  console.log(`Total Scenarios: ${passedCount + failedCount}`);
  console.log(`Passed:          ${passedCount}`);
  console.log(`Failed:          ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n>>> SEB PROTOCOL VERIFICATION FAILED <<<');
    process.exit(1);
  } else {
    console.log('\n>>> ALL 12 SEB PROTOCOL SCENARIOS VERIFIED SUCCESSFULLY! <<<');
  }
}

runSebProtocolTests();
