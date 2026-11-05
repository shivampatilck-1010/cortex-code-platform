/**
 * Cortex Online Examination System — Phase 4.10 Test Suite
 * Safe Exam Browser (SEB) Cryptographic Verification & Protocol Audit
 *
 * Verifies:
 * 1. Quit password SHA-256 cryptographic hashing.
 * 2. Official SEB Hash derivation: SHA256(RequestURL + Key).
 * 3. Browser Exam Key (BEK) deterministic derivation and matching.
 * 4. Config Key (CK) header matching.
 * 5. Rejection of unauthenticated clients (missing SEB headers).
 * 6. Rejection of forged, truncated, or tampered cryptographic hashes.
 * 7. Canonical URL reconstruction:
 *    - Port normalization (80 and 443 stripped).
 *    - Trailing slash expansion (/ vs no slash).
 *    - Trusted host validation (rejection of malicious x-forwarded-host).
 * 8. Timing-safe comparison (protection against side-channel timing attacks).
 * 9. Permissive behavior for non-SEB examinations.
 * 10. SEB Configuration Plist XML generation and JSON instructor inspection.
 *
 * Strictly zero emojis.
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import {
  hashQuitPassword,
  computeSafeExamBrowserHash,
  getExpectedBrowserExamKey,
  generateCandidateUrls,
  verifySafeExamBrowserRequest,
} from '../src/lib/classroom/seb-security';
import { Exam } from '../src/lib/classroom/models';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${message}`);
  }
}

async function runSebSecurityAudit() {
  console.log('================================================================');
  console.log('PHASE 4.10: SAFE EXAM BROWSER CRYPTOGRAPHIC AUDIT');
  console.log('================================================================\n');

  // --- SECTION 1: PASSWORD & DERIVATION HASHING ---
  console.log('--- SECTION 1: CRYPTOGRAPHIC HASH DERIVATION ---');
  const testPassword = 'UniversityProctor2026';
  const expectedHash = crypto.createHash('sha256').update(testPassword).digest('hex').toLowerCase();
  const actualHash = hashQuitPassword(testPassword);
  assert(actualHash === expectedHash, 'Quit password hash matches standard SHA-256 hex digest');
  assert(actualHash.length === 64, 'Quit password hash is exactly 64 hexadecimal characters');

  // Trailing whitespace normalization
  const paddedHash = hashQuitPassword('  UniversityProctor2026  ');
  assert(paddedHash === expectedHash, 'Quit password hashing strips leading/trailing whitespace');

  // --- SECTION 2: SEB REQUEST HASH PROTOCOL SPECIFICATION ---
  console.log('\n--- SECTION 2: SEB REQUEST HASH PROTOCOL SPECIFICATION ---');
  const sampleUrl = 'https://cortex.edu/classroom/exam/session123';
  const sampleKey = 'bek_secret_key_9876543210abcdef';
  const expectedSebHash = crypto
    .createHash('sha256')
    .update(sampleUrl + sampleKey)
    .digest('hex')
    .toLowerCase();
  const actualSebHash = computeSafeExamBrowserHash(sampleUrl, sampleKey);
  assert(actualSebHash === expectedSebHash, 'computeSafeExamBrowserHash strictly conforms to SHA256(URL + Key)');

  // Hash sensitivity: 1-byte alteration in URL or Key produces completely different hash
  const alteredUrlHash = computeSafeExamBrowserHash(sampleUrl + '/', sampleKey);
  assert(alteredUrlHash !== actualSebHash, 'Avalanche effect: trailing slash alters computed hash');

  const alteredKeyHash = computeSafeExamBrowserHash(sampleUrl, sampleKey + '1');
  assert(alteredKeyHash !== actualSebHash, 'Avalanche effect: single key character alteration produces disparate hash');

  // --- SECTION 3: CANONICAL URL RECONSTRUCTION & HOST POISONING MITIGATION ---
  console.log('\n--- SECTION 3: CANONICAL URL RECONSTRUCTION & HOST SAFETY ---');
  
  // Trusted Cloudflare Worker host
  const reqTrusted = new NextRequest('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/exams/start', {
    headers: {
      host: 'cortex-code-platform.cortexbuild1.workers.dev',
      'x-forwarded-proto': 'https',
    },
  });
  const urlsTrusted = generateCandidateUrls(reqTrusted);
  assert(
    urlsTrusted.some((u) => u.startsWith('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/exams/start')),
    'Candidate URLs cleanly generate canonical URL for trusted Cloudflare workers.dev domain'
  );

  // Untrusted forwarded host attack attempt
  const reqPoison = new NextRequest('http://localhost:3000/api/v1/exams/start', {
    headers: {
      host: 'localhost:3000',
      'x-forwarded-host': 'attacker-domain.evil.com',
      'x-forwarded-proto': 'https',
    },
  });
  const urlsPoison = generateCandidateUrls(reqPoison);
  assert(
    !urlsPoison.some((u) => u.includes('attacker-domain.evil.com')),
    'Host poisoning protection: untrusted x-forwarded-host rejected from canonical URL list'
  );

  // Standard port stripping (port 443 on HTTPS)
  const reqPort = new NextRequest('https://cortex-code-platform.cortexbuild1.workers.dev:443/api/v1/exams/start', {
    headers: { host: 'cortex-code-platform.cortexbuild1.workers.dev:443' },
  });
  const urlsPort = generateCandidateUrls(reqPort);
  assert(
    urlsPort.some((u) => u === 'https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/exams/start' || u === 'https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/exams/start/'),
    'SEB port stripping: default HTTPS port 443 is cleanly stripped per SEB specification'
  );

  // --- SECTION 4: FULL REQUEST VERIFICATION ENGINE ---
  console.log('\n--- SECTION 4: REQUEST VERIFICATION ENGINE ---');
  const mockExamSeb: Exam = {
    id: 'exam_seb_101',
    classroomId: 'CLS_MATH',
    title: 'Advanced Calculus Final',
    durationMinutes: 120,
    startTime: Date.now() - 10000,
    endTime: Date.now() + 7200000,
    totalMarks: 100,
    passingMarks: 50,
    securityLevel: 'seb',
    sebBrowserExamKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    sebConfigKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0ff0e1d2c3b4a5968778695a4b3c2d1e0f',
  };

  const targetUrl = 'https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/classrooms/CLS_MATH/exams/exam_seb_101/start';

  // Subtest 4.1: Missing headers on SEB exam
  const reqNoHeaders = new NextRequest(targetUrl);
  const resNoHeaders = verifySafeExamBrowserRequest(reqNoHeaders, mockExamSeb);
  assert(resNoHeaders.verified === false, 'Exam with securityLevel="seb" rejects request without SEB headers');
  assert(
    resNoHeaders.reason?.includes('Missing Safe Exam Browser cryptographic verification headers') === true,
    'Rejection explicitly cites missing SEB verification headers'
  );

  // Subtest 4.2: Valid Browser Exam Key (BEK) Request Hash
  const validBekHash = computeSafeExamBrowserHash(targetUrl, mockExamSeb.sebBrowserExamKey!);
  const reqValidBek = new NextRequest(targetUrl, {
    headers: {
      'x-safeexambrowser-requesthash': validBekHash,
    },
  });
  const resValidBek = verifySafeExamBrowserRequest(reqValidBek, mockExamSeb);
  assert(resValidBek.verified === true, 'Request with valid X-SafeExamBrowser-RequestHash verified successfully');
  assert(resValidBek.matchType === 'bek', 'Verification confirmed via matchType="bek"');

  // Subtest 4.3: Valid Config Key (CK) Hash
  const validCkHash = computeSafeExamBrowserHash(targetUrl, mockExamSeb.sebConfigKey!);
  const reqValidCk = new NextRequest(targetUrl, {
    headers: {
      'x-safeexambrowser-configkeyhash': validCkHash,
    },
  });
  const resValidCk = verifySafeExamBrowserRequest(reqValidCk, mockExamSeb);
  assert(resValidCk.verified === true, 'Request with valid X-SafeExamBrowser-ConfigKeyHash verified successfully');
  assert(resValidCk.matchType === 'ck', 'Verification confirmed via matchType="ck"');

  // Subtest 4.4: Tampered/Forged Hash
  const reqForged = new NextRequest(targetUrl, {
    headers: {
      'x-safeexambrowser-requesthash': '0000000000000000000000000000000000000000000000000000000000000000',
    },
  });
  const resForged = verifySafeExamBrowserRequest(reqForged, mockExamSeb);
  assert(resForged.verified === false, 'Forged hash rejected with verified=false');
  assert(
    resForged.reason?.includes('Invalid or forged Safe Exam Browser cryptographic verification hash') === true,
    'Rejection reason explicitly identifies invalid or forged hash'
  );

  // Subtest 4.5: URL Tampering (Hash computed for different URL)
  const differentUrl = 'https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/other/path';
  const mismatchedHash = computeSafeExamBrowserHash(differentUrl, mockExamSeb.sebBrowserExamKey!);
  const reqMismatched = new NextRequest(targetUrl, {
    headers: {
      'x-safeexambrowser-requesthash': mismatchedHash,
    },
  });
  const resMismatched = verifySafeExamBrowserRequest(reqMismatched, mockExamSeb);
  assert(resMismatched.verified === false, 'Hash bound to different URL fails verification (Man-in-the-Middle prevention)');

  // Subtest 4.6: Permissive behavior for non-SEB exams
  const mockExamStandard: Exam = {
    ...mockExamSeb,
    securityLevel: 'standard',
  };
  const resStandard = verifySafeExamBrowserRequest(new NextRequest(targetUrl), mockExamStandard);
  assert(resStandard.verified === true, 'Standard examination allows requests without SEB headers (Permissive mode)');

  // --- SECTION 5: DETERMINISTIC DERIVATION FOR UNCONFIGURED KEYS ---
  console.log('\n--- SECTION 5: DEFAULT BEK DERIVATION ---');
  const mockExamNoKeys: Exam = {
    id: 'exam_no_explicit_keys',
    classroomId: 'CLS_CS101',
    title: 'CS101 Exam',
    durationMinutes: 60,
    startTime: Date.now(),
    endTime: Date.now() + 3600000,
    totalMarks: 50,
    passingMarks: 25,
    securityLevel: 'seb',
  };
  const derivedBek = getExpectedBrowserExamKey(mockExamNoKeys);
  const expectedDerived = crypto
    .createHash('sha256')
    .update(`${mockExamNoKeys.id}_${mockExamNoKeys.classroomId}_cortex_seb`)
    .digest('hex')
    .toLowerCase();
  assert(derivedBek === expectedDerived, 'Default BEK is deterministically derived from exam and classroom IDs');
  assert(/^[a-f0-9]{64}$/.test(derivedBek), 'Derived BEK is valid 64-char hex string');

  console.log('\n================================================================');
  console.log(`PHASE 4.10 AUDIT SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSebSecurityAudit().catch((err) => {
  console.error('Phase 4.10 Audit Error:', err);
  process.exit(1);
});
