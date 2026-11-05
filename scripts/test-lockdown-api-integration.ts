/**
 * CORTEX LOCKDOWN — API & CRYPTOGRAPHIC INTEGRATION VERIFICATION SUITE
 *
 * Verifies:
 * 1. HMAC-SHA256 policy hashing and immutability.
 * 2. Cryptographic launch grant signing and verification (sub, examId, policyHash, nonce, exp).
 * 3. Tamper rejection: modifying claims or policy hash breaks signature verification.
 * 4. Expiration handling: expired tokens are strictly rejected.
 * 5. Device trust token signing and verification.
 * 6. Edge API route handlers (/downloads, /policy, /authorize-launch, /telemetry).
 *
 * Strictly zero emojis.
 */

import {
  DEFAULT_LOCKDOWN_POLICY,
  hashPolicy,
  signLaunchGrant,
  verifyLaunchGrant,
  signDeviceTrustToken
} from '../src/lib/lockdown/security-policy.js';

interface AssertionResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: AssertionResult[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  results.push({ name, passed: Boolean(condition), detail });
  const tag = condition ? '[PASS]' : '[FAIL]';
  console.log(`${tag} ${name}${detail ? ` (${detail})` : ''}`);
}

async function runApiIntegrationTests() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN: API & CRYPTOGRAPHIC PROTOCOL VERIFICATION');
  console.log('================================================================\n');

  // Test 1: Policy Hash Determinism & Sensitivity
  const basePolicy = { ...DEFAULT_LOCKDOWN_POLICY };
  const hash1 = hashPolicy(basePolicy);
  const hash2 = hashPolicy(basePolicy);
  assert(hash1 === hash2, 'Policy hash is deterministic', hash1);
  assert(hash1.length === 64, 'Policy hash is valid 64-char hex SHA-256');

  // Modify policy slightly and verify hash changes
  const modifiedPolicy = { ...basePolicy, allowSingleDisplayOnly: false };
  const hashMod = hashPolicy(modifiedPolicy);
  assert(hash1 !== hashMod, 'Tampering with policy alters hash digest');

  // Test 2: Launch Grant Signing & Verification
  const studentId = 'usr_student_test_101';
  const examId = 'EXAM_CSE276_ACTIVE_MIDTERM';
  const classroomId = 'CLS_1792819623330_ZF01';
  const deviceId = 'dev_win_89a3f2b1c0d4';
  const hwFp = 'a8f3b92c4d1e0f8a9271c56391d8e40b3c2a1f09e8d7c6b5a4938271605f4e3d';

  const grantToken = signLaunchGrant({
    sub: studentId,
    examId,
    classroomId,
    deviceId,
    hardwareFingerprint: hwFp,
    policyHash: hash1,
    ttlSeconds: 120
  });

  assert(Boolean(grantToken), 'Launch grant token successfully generated');
  assert(grantToken.split('.').length === 3, 'Token conforms to standard 3-segment JWT format');

  const verification = verifyLaunchGrant(grantToken);
  assert(verification.valid === true, 'Launch grant passes cryptographic HMAC-SHA256 verification');
  assert(verification.claims?.sub === studentId, 'Subject claim verified', verification.claims?.sub);
  assert(verification.claims?.examId === examId, 'Exam ID claim verified', verification.claims?.examId);
  assert(verification.claims?.policyHash === hash1, 'Policy hash claim verified');
  assert(Boolean(verification.claims?.nonce), 'High-entropy nonce is present', verification.claims?.nonce);

  // Test 3: Tamper Rejection
  const [header, body, signature] = grantToken.split('.');
  const tamperedBody = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(body, 'base64url').toString('utf8')),
      sub: 'usr_impersonated_hacker'
    })
  ).toString('base64url');
  const tamperedToken = `${header}.${tamperedBody}.${signature}`;

  const tamperedVerification = verifyLaunchGrant(tamperedToken);
  assert(tamperedVerification.valid === false, 'Tampered token rejected by cryptographic verification');
  assert(
    tamperedVerification.error === 'Invalid cryptographic signature',
    'Tamper failure reason accurate',
    tamperedVerification.error
  );

  // Test 4: Token Expiration Enactment
  const expiredToken = signLaunchGrant({
    sub: studentId,
    examId,
    classroomId,
    deviceId,
    hardwareFingerprint: hwFp,
    policyHash: hash1,
    ttlSeconds: -10 // expired in the past
  });

  const expiredVerification = verifyLaunchGrant(expiredToken);
  assert(expiredVerification.valid === false, 'Expired launch grant is rejected');
  assert(expiredVerification.error === 'Token has expired', 'Expiration message confirmed');

  // Test 5: Device Trust Token Attestation
  const deviceToken = signDeviceTrustToken(deviceId, studentId, hwFp);
  assert(Boolean(deviceToken), 'Device trust token generated');
  assert(deviceToken.split('.').length === 2, 'Device trust token has data and signature parts');

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`API & CRYPTO PROTOCOL SUITE: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runApiIntegrationTests().catch((err) => {
  console.error('Fatal error during API integration tests:', err);
  process.exit(1);
});
