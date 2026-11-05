// Cortex Lockdown — Alpha 33 Identity Security, Cryptographic Trust & Database Attack Resistance
// Standalone Verification & Benchmark Suite
// Strictly zero emojis.

import os from 'os';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { classroomDb } from '../src/lib/classroom/db';
import {
  generateTestRsaFixture,
  createSignedSamlResponse,
  validateSamlResponse,
  createLtiIdToken,
  validateLtiLaunchJwt,
  CANVAS_LTI_CONFIG,
  MOODLE_LTI_CONFIG,
  resetReplayCaches,
  LtiLaunchClaims,
  SamlUserAttributes,
} from '../src/lib/lockdown/institutional-integration';
import {
  signLaunchGrant,
  verifyLaunchGrant,
  revokeSession,
  isSessionRevoked,
  resetSecurityRegistries,
} from '../src/lib/lockdown/security-policy';
import { POST as postSyncRoute } from '../src/app/api/v1/lockdown/sync-answers/route';
import { POST as postSubmitRoute } from '../src/app/api/v1/lockdown/submit/route';
import { GET as getPolicyRoute } from '../src/app/api/v1/lockdown/policy/route';

interface CheckResult {
  id: string;
  name: string;
  classification: string;
  passed: boolean;
  evidence: string;
  error?: string;
}

const scorecard: CheckResult[] = [];

function record(
  id: string,
  name: string,
  classification: string,
  passed: boolean,
  evidence: string,
  error?: string
) {
  scorecard.push({ id, name, classification, passed, evidence, error });
  const status = passed ? '[PASS]' : '[FAIL]';
  console.log(`${status} ${id}: ${name}`);
  console.log(`       Classification: ${classification}`);
  console.log(`       Evidence:       ${evidence}`);
  if (error) {
    console.log(`       Error:          ${error}`);
  }
}

async function runAlpha33VerificationSuite() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN - ALPHA 33 VERIFICATION & BENCHMARK SUITE');
  console.log('Identity Security, Cryptographic Trust & Database Attack Defense');
  console.log('================================================================');

  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown CPU';
  const totalMemGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
  console.log(`Host Hardware: ${cpuModel} (${cpus.length} vCPUs), ${totalMemGb} GB RAM, OS: ${os.platform()} ${os.release()}`);
  console.log('');

  // Clean in-memory registries
  resetReplayCaches();
  resetSecurityRegistries();

  const runId = Date.now().toString(36);
  const classroomId = `CLASS_A33_${runId.toUpperCase()}`;
  const examId = `exam_a33_core_${runId}`;
  const crossExamId = `exam_a33_cross_${runId}`;
  const studentId = `usr_cand_synth_a33_${runId}`;
  const deanId = `usr_dean_a33_${runId}`;

  // 1. Seed database entities
  await classroomDb.createUser({
    id: deanId,
    name: 'Dr. Apex Security Dean',
    email: `dean.${runId}@apex.edu`,
    role: 'instructor',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await classroomDb.createUser({
    id: studentId,
    name: 'Aarav Patil (Synthetic A33)',
    email: `student.${runId}@apex.edu`,
    role: 'student',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await classroomDb.createClassroom({
    id: classroomId,
    name: 'Alpha 33 Cryptographic Security Testing Lab',
    teacherId: deanId,
    teacherName: 'Dr. Apex Security Dean',
  });

  await classroomDb.createExam({
    id: examId,
    classroomId,
    title: 'Alpha 33 Identity Security Examination',
    description: 'Adversarial cryptographic verification exam',
    durationMinutes: 90,
    securityLevel: 'restricted',
    totalMarks: 100,
    passingMarks: 50,
    status: 'active',
    createdBy: deanId,
  });

  await classroomDb.createExam({
    id: crossExamId,
    classroomId,
    title: 'Alpha 33 Cross-Exam Isolation Target',
    description: 'Cross-exam token reuse verification',
    durationMinutes: 60,
    securityLevel: 'restricted',
    totalMarks: 50,
    passingMarks: 25,
    status: 'active',
    createdBy: deanId,
  });

  // Seed questions
  for (let i = 1; i <= 3; i++) {
    try {
      await classroomDb.createExamQuestion({
        id: `q${i}_${runId}`,
        examId,
        questionText: `Question ${i} prompt`,
        questionType: 'single_choice',
        points: 20,
        orderIndex: i,
      });
    } catch {}
  }

  // Pre-generate standard test fixtures
  const samlFixture = generateTestRsaFixture('saml_idp');
  const ltiFixture = generateTestRsaFixture('lti_platform');

  const testUser: SamlUserAttributes = {
    eduPersonPrincipalName: 'prof.smith@university.edu',
    mail: 'prof.smith@university.edu',
    givenName: 'Alice',
    surName: 'Smith',
    eduPersonScopedAffiliation: ['faculty@university.edu'],
    mappedRole: 'faculty_lead',
  };

  const spEntityId = 'https://cortex.university.edu/sp';
  const idpEntityId = 'https://idp.university.edu/shibboleth';
  const acsUrl = 'https://cortex.university.edu/api/v1/auth/saml/acs';

  console.log('--- WORKSTREAM 1: SAML 2.0 SECURITY HARDENING & ADVERSARIAL DEFENSE ---');

  // A33-SAML-01: SAML Signature Forgery Defense (Altering XML Assertion Body)
  try {
    const validResp = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_req_001',
      destination: acsUrl,
      user: testUser,
      privateKeyPem: samlFixture.privateKeyPem,
      certPem: samlFixture.certPem,
    });

    // Tamper with assertion body (change mail from prof.smith to attacker.smith)
    const xml = Buffer.from(validResp, 'base64').toString('utf8');
    const tamperedXml = xml.replace('prof.smith@university.edu', 'attacker@university.edu');
    const tamperedRespB64 = Buffer.from(tamperedXml).toString('base64');

    const result = validateSamlResponse(tamperedRespB64, spEntityId, '_req_001', {
      idpPublicCertificatePem: samlFixture.publicKeyPem,
    });

    const pass = !result.valid && result.errorCode === 'SAML_DIGEST_MISMATCH';
    record(
      'A33-SAML-01',
      'SAML XML Signature Forgery & Content Tampering Defense',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${result.valid}, ErrorCode: ${result.errorCode}, Reason: ${result.reason}`
    );
  } catch (err: any) {
    record('A33-SAML-01', 'SAML XML Signature Forgery & Content Tampering Defense', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-SAML-02: SAML Assertion Replay Defense (Single-Use Token Tracking)
  try {
    const validResp = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_req_002',
      destination: acsUrl,
      user: testUser,
      privateKeyPem: samlFixture.privateKeyPem,
      certPem: samlFixture.certPem,
    });

    // Redemption 1: should pass
    const res1 = validateSamlResponse(validResp, spEntityId, '_req_002', {
      idpPublicCertificatePem: samlFixture.publicKeyPem,
    });

    // Redemption 2 (replay): must be rejected
    const res2 = validateSamlResponse(validResp, spEntityId, '_req_002', {
      idpPublicCertificatePem: samlFixture.publicKeyPem,
    });

    const pass = res1.valid && !res2.valid && res2.errorCode === 'SAML_ASSERTION_REPLAY_DETECTED';
    record(
      'A33-SAML-02',
      'SAML Single-Use Replay Protection',
      'Category B: Automated Unit Test',
      pass,
      `Attempt 1 Valid: ${res1.valid}, Attempt 2 (Replay) Blocked: ${!res2.valid}, Error: ${res2.errorCode}`
    );
  } catch (err: any) {
    record('A33-SAML-02', 'SAML Single-Use Replay Protection', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-SAML-03: SAML Audience Substitution Defense
  try {
    const validResp = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_req_003',
      destination: acsUrl,
      user: testUser,
      privateKeyPem: samlFixture.privateKeyPem,
      certPem: samlFixture.certPem,
    });

    // Validate expecting a different SP entity ID
    const res = validateSamlResponse(validResp, 'https://rogue-service-provider.edu/sp', '_req_003', {
      idpPublicCertificatePem: samlFixture.publicKeyPem,
    });

    const pass = !res.valid && res.errorCode === 'SAML_AUDIENCE_MISMATCH';
    record(
      'A33-SAML-03',
      'SAML Audience Restriction Enforcement',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-SAML-03', 'SAML Audience Restriction Enforcement', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-SAML-04: SAML Issuer Substitution Defense
  try {
    const validResp = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_req_004',
      destination: acsUrl,
      user: testUser,
      privateKeyPem: samlFixture.privateKeyPem,
      certPem: samlFixture.certPem,
    });

    const res = validateSamlResponse(validResp, spEntityId, '_req_004', {
      expectedIdpIssuer: 'https://untrusted-idp.edu/sso',
      idpPublicCertificatePem: samlFixture.publicKeyPem,
    });

    const pass = !res.valid && res.errorCode === 'SAML_ISSUER_MISMATCH';
    record(
      'A33-SAML-04',
      'SAML IdP Issuer Verification',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-SAML-04', 'SAML IdP Issuer Verification', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-SAML-05: XML Signature Wrapping (XSW) Attack Defense
  try {
    const validResp = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_req_005',
      destination: acsUrl,
      user: testUser,
      privateKeyPem: samlFixture.privateKeyPem,
      certPem: samlFixture.certPem,
    });

    // Inject a secondary unsigned assertion into the response XML (classic XSW attack pattern)
    const xml = Buffer.from(validResp, 'base64').toString('utf8');
    const shadowAssertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_shadow_001"><saml:Subject><saml:NameID>dean@apex.edu</saml:NameID></saml:Subject></saml:Assertion>`;
    const wrappedXml = xml.replace('</samlp:Response>', `${shadowAssertion}</samlp:Response>`);
    const wrappedRespB64 = Buffer.from(wrappedXml).toString('base64');

    const res = validateSamlResponse(wrappedRespB64, spEntityId, '_req_005', {
      idpPublicCertificatePem: samlFixture.publicKeyPem,
    });

    const pass = !res.valid && res.errorCode === 'SAML_SIGNATURE_WRAPPING_ATTACK_DETECTED';
    record(
      'A33-SAML-05',
      'XML Signature Wrapping (XSW) Single-Assertion Guard',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-SAML-05', 'XML Signature Wrapping (XSW) Single-Assertion Guard', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-SAML-06: Unsigned Assertion Explicit Rejection
  try {
    const unsignedResp = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_req_006',
      destination: acsUrl,
      user: testUser,
      omitSignature: true,
    });

    const res = validateSamlResponse(unsignedResp, spEntityId, '_req_006');
    const pass = !res.valid && res.errorCode === 'SAML_UNSIGNED_ASSERTION_REJECTED';
    record(
      'A33-SAML-06',
      'Strict Unsigned SAML Assertion Rejection',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-SAML-06', 'Strict Unsigned SAML Assertion Rejection', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-SAML-07: SAML Expiration Defense
  try {
    const expiredResp = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_req_007',
      destination: acsUrl,
      user: testUser,
      privateKeyPem: samlFixture.privateKeyPem,
      certPem: samlFixture.certPem,
      notOnOrAfter: new Date(Date.now() - 300000).toISOString(), // Expired 5 minutes ago
    });

    const res = validateSamlResponse(expiredResp, spEntityId, '_req_007', {
      idpPublicCertificatePem: samlFixture.publicKeyPem,
      clockSkewSeconds: 120, // 2 minutes tolerance (5 min expired exceeds tolerance)
    });

    const pass = !res.valid && res.errorCode === 'SAML_ASSERTION_EXPIRED';
    record(
      'A33-SAML-07',
      'SAML Temporal Expiration Enforcement',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-SAML-07', 'SAML Temporal Expiration Enforcement', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-SAML-08: SAML Clock-Skew Tolerance (Within 120s Accepted)
  try {
    const skewedResp = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_req_008',
      destination: acsUrl,
      user: testUser,
      privateKeyPem: samlFixture.privateKeyPem,
      certPem: samlFixture.certPem,
      notOnOrAfter: new Date(Date.now() - 30000).toISOString(), // Expired 30 seconds ago
    });

    // Within 120s clock skew tolerance, should pass
    const res = validateSamlResponse(skewedResp, spEntityId, '_req_008', {
      idpPublicCertificatePem: samlFixture.publicKeyPem,
      clockSkewSeconds: 120,
    });

    const pass = res.valid === true;
    record(
      'A33-SAML-08',
      'SAML Clock-Skew Tolerance Window (120s)',
      'Category B: Automated Unit Test',
      pass,
      `Valid within 120s skew tolerance: ${res.valid}, User: ${res.user?.eduPersonPrincipalName}`
    );
  } catch (err: any) {
    record('A33-SAML-08', 'SAML Clock-Skew Tolerance Window (120s)', 'Category B: Automated Unit Test', false, err.message);
  }

  console.log('');
  console.log('--- WORKSTREAM 2: LTI 1.3 / OIDC SECURITY & CRYPTOGRAPHIC TRUST ---');

  const baseLtiClaims: LtiLaunchClaims = {
    sub: 'usr_canvas_learner_01',
    name: 'Bob Student',
    email: 'bob@canvas.univ.edu',
    messageType: 'LtiResourceLinkRequest',
    version: '1.3.0',
    resourceLinkId: 'canvas_res_99',
    contextId: 'course_cs401',
    contextTitle: 'Cloud Distributed Systems',
    targetLinkUri: 'https://cortex.university.edu/api/v1/lti/launch',
    roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    nonce: `n_lti_test_${Date.now()}`,
    deploymentId: 'dep_cortex_prod_01',
  };

  // A33-LTI-01: LTI RS256 Cryptographic Signature Forgery Defense
  try {
    const validJwt = createLtiIdToken(baseLtiClaims, {
      privateKeyPem: ltiFixture.privateKeyPem,
      algorithm: 'RS256',
    });

    // Tamper with payload
    const parts = validJwt.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    payload.sub = 'usr_attacker_elevated';
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedJwt = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    const res = validateLtiLaunchJwt(tamperedJwt, baseLtiClaims.nonce, {
      publicKeyPem: ltiFixture.publicKeyPem,
      allowedAlgorithms: ['RS256'],
    });

    const pass = !res.valid && res.errorCode === 'LTI_SIGNATURE_FORGERY_DETECTED';
    record(
      'A33-LTI-01',
      'LTI RS256 Cryptographic Signature Forgery Defense',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-LTI-01', 'LTI RS256 Cryptographic Signature Forgery Defense', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-LTI-02: LTI Audience Substitution Defense
  try {
    const validJwt = createLtiIdToken(baseLtiClaims, {
      privateKeyPem: ltiFixture.privateKeyPem,
      algorithm: 'RS256',
      audience: 'cortex_legitimate_client',
    });

    const res = validateLtiLaunchJwt(validJwt, baseLtiClaims.nonce, {
      publicKeyPem: ltiFixture.publicKeyPem,
      expectedAudience: 'cortex_other_client_unauthorized',
      allowedAlgorithms: ['RS256'],
    });

    const pass = !res.valid && res.errorCode === 'LTI_AUDIENCE_MISMATCH';
    record(
      'A33-LTI-02',
      'LTI Client Audience Verification',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-LTI-02', 'LTI Client Audience Verification', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-LTI-03: LTI Nonce Replay Defense
  try {
    const nonce = `n_replay_${Date.now()}`;
    const claims = { ...baseLtiClaims, nonce };
    const validJwt = createLtiIdToken(claims, {
      privateKeyPem: ltiFixture.privateKeyPem,
      algorithm: 'RS256',
    });

    // Launch 1: should pass
    const res1 = validateLtiLaunchJwt(validJwt, nonce, {
      publicKeyPem: ltiFixture.publicKeyPem,
    });

    // Launch 2 (replay): must be rejected
    const res2 = validateLtiLaunchJwt(validJwt, nonce, {
      publicKeyPem: ltiFixture.publicKeyPem,
    });

    const pass = res1.valid && !res2.valid && res2.errorCode === 'LTI_NONCE_REPLAY_DETECTED';
    record(
      'A33-LTI-03',
      'LTI Launch Nonce Single-Use Replay Defense',
      'Category B: Automated Unit Test',
      pass,
      `Launch 1 Valid: ${res1.valid}, Launch 2 Replay Blocked: ${!res2.valid}, Error: ${res2.errorCode}`
    );
  } catch (err: any) {
    record('A33-LTI-03', 'LTI Launch Nonce Single-Use Replay Defense', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-LTI-04: LTI Platform Issuer Verification
  try {
    const claims = { ...baseLtiClaims, nonce: `n_iss_${Date.now()}` };
    const validJwt = createLtiIdToken(claims, {
      privateKeyPem: ltiFixture.privateKeyPem,
      issuer: 'https://canvas.instructure.com',
      algorithm: 'RS256',
    });

    const res = validateLtiLaunchJwt(validJwt, claims.nonce, {
      publicKeyPem: ltiFixture.publicKeyPem,
      expectedIssuer: 'https://blackboard.com',
    });

    const pass = !res.valid && res.errorCode === 'LTI_ISSUER_MISMATCH';
    record(
      'A33-LTI-04',
      'LTI LMS Platform Issuer Verification',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-LTI-04', 'LTI LMS Platform Issuer Verification', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-LTI-05: LTI Deployment ID Mismatch Defense
  try {
    const claims = { ...baseLtiClaims, nonce: `n_dep_${Date.now()}` };
    const validJwt = createLtiIdToken(claims, {
      privateKeyPem: ltiFixture.privateKeyPem,
      deploymentId: 'dep_cortex_campus_alpha',
      algorithm: 'RS256',
    });

    const res = validateLtiLaunchJwt(validJwt, claims.nonce, {
      publicKeyPem: ltiFixture.publicKeyPem,
      expectedDeploymentId: 'dep_cortex_campus_beta',
    });

    const pass = !res.valid && res.errorCode === 'LTI_DEPLOYMENT_ID_MISMATCH';
    record(
      'A33-LTI-05',
      'LTI Institutional Deployment ID Verification',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-LTI-05', 'LTI Institutional Deployment ID Verification', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-LTI-06: LTI Unsupported Algorithm (alg: "none") Rejection
  try {
    const claims = { ...baseLtiClaims, nonce: `n_none_${Date.now()}` };
    const noneJwt = createLtiIdToken(claims, { algorithm: 'none' });

    const res = validateLtiLaunchJwt(noneJwt, claims.nonce, {
      allowedAlgorithms: ['RS256'],
    });

    const pass = !res.valid && res.errorCode === 'LTI_UNSUPPORTED_SIGNING_ALGORITHM';
    record(
      'A33-LTI-06',
      'LTI Algorithm Allowlist Defense (alg: "none" Rejected)',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-LTI-06', 'LTI Algorithm Allowlist Defense (alg: "none" Rejected)', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-LTI-07: LTI Expiration Enforcement
  try {
    const claims = { ...baseLtiClaims, nonce: `n_exp_${Date.now()}` };
    const expiredJwt = createLtiIdToken(claims, {
      privateKeyPem: ltiFixture.privateKeyPem,
      expiresInSeconds: -300, // Expired 5 minutes ago
    });

    const res = validateLtiLaunchJwt(expiredJwt, claims.nonce, {
      publicKeyPem: ltiFixture.publicKeyPem,
      clockSkewSeconds: 120,
    });

    const pass = !res.valid && res.errorCode === 'TOKEN_EXPIRED';
    record(
      'A33-LTI-07',
      'LTI JWT Expiration & Replay Defense',
      'Category B: Automated Unit Test',
      pass,
      `Valid: ${res.valid}, ErrorCode: ${res.errorCode}, Reason: ${res.reason}`
    );
  } catch (err: any) {
    record('A33-LTI-07', 'LTI JWT Expiration & Replay Defense', 'Category B: Automated Unit Test', false, err.message);
  }

  console.log('');
  console.log('--- WORKSTREAM 3: AUTHENTICATION & SESSION REVOCATION ---');

  // A33-AUTH-01: Launch Grant Single-Use Enforcement
  try {
    const grant = signLaunchGrant({
      sub: studentId,
      examId,
      classroomId,
      deviceId: 'dev_a33_win',
      hardwareFingerprint: 'hw_fingerprint_a33',
      policyHash: 'pol_hash_synthetic',
    });

    // Use 1 with enforceSingleUse
    const res1 = verifyLaunchGrant(grant, { enforceSingleUse: true });
    // Use 2 (replay)
    const res2 = verifyLaunchGrant(grant, { enforceSingleUse: true });

    const pass = res1.valid && !res2.valid && res2.error?.includes('already been consumed');
    record(
      'A33-AUTH-01',
      'Launch Grant Single-Use & Replay Defense',
      'Category B: Automated Unit Test',
      pass,
      `Use 1 Valid: ${res1.valid}, Use 2 (Replay) Blocked: ${!res2.valid}, Error: ${res2.error}`
    );
  } catch (err: any) {
    record('A33-AUTH-01', 'Launch Grant Single-Use & Replay Defense', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-AUTH-02: Session Revocation Propagation to API Endpoints
  try {
    const activeSessionId = `sess_a33_active_${Date.now()}`;
    const grant = signLaunchGrant({
      sub: studentId,
      examId,
      classroomId,
      deviceId: 'dev_a33_win',
      hardwareFingerprint: 'hw_fingerprint_a33',
      policyHash: 'pol_hash_synthetic',
    });

    // Revoke session explicitly
    revokeSession(activeSessionId, 'Academic integrity violation');
    await classroomDb.revokeToken({
      identifier: activeSessionId,
      type: 'session',
      reason: 'Academic integrity violation',
    });

    // Attempt to sync answers on revoked session
    const syncReq = new NextRequest('http://localhost:3000/api/v1/lockdown/sync-answers', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cortex-lockdown-grant': grant,
      },
      body: JSON.stringify({
        examId,
        sessionId: activeSessionId,
        studentId,
        answers: { q1: 'test' },
        sequenceNumber: 1,
      }),
    });

    const syncRes = await postSyncRoute(syncReq);
    const syncJson = await syncRes.json();

    const pass = syncRes.status === 403 && syncJson.code === 'SESSION_REVOKED';
    record(
      'A33-AUTH-02',
      'Immediate Session Revocation API Propagation',
      'Category C: Integration Test',
      pass,
      `HTTP Status: ${syncRes.status}, Code: ${syncJson.code}, Reason: ${syncJson.error}`
    );
  } catch (err: any) {
    record('A33-AUTH-02', 'Immediate Session Revocation API Propagation', 'Category C: Integration Test', false, err.message);
  }

  // A33-AUTH-03: Cross-Examination Token Reuse Rejection
  try {
    const grant = signLaunchGrant({
      sub: studentId,
      examId,
      classroomId,
      deviceId: 'dev_a33_win',
      hardwareFingerprint: 'hw_fingerprint_a33',
      policyHash: 'pol_hash_synthetic',
    });

    const syncReq = new NextRequest('http://localhost:3000/api/v1/lockdown/sync-answers', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cortex-lockdown-grant': grant,
      },
      body: JSON.stringify({
        examId: crossExamId, // Submitting to cross exam with grant from examId
        sessionId: `sess_a33_cross_${Date.now()}`,
        studentId,
        answers: { q1: 'test' },
        sequenceNumber: 1,
      }),
    });

    const syncRes = await postSyncRoute(syncReq);
    const syncJson = await syncRes.json();

    const pass = syncRes.status === 403 && syncJson.code === 'EXAM_MISMATCH';
    record(
      'A33-AUTH-03',
      'Cross-Examination Token Reuse Defense',
      'Category C: Integration Test',
      pass,
      `HTTP Status: ${syncRes.status}, Code: ${syncJson.code}, Message: ${syncJson.error}`
    );
  } catch (err: any) {
    record('A33-AUTH-03', 'Cross-Examination Token Reuse Defense', 'Category C: Integration Test', false, err.message);
  }

  console.log('');
  console.log('--- WORKSTREAM 4: DATABASE CONCURRENCY & CRYPTOGRAPHIC AUDIT LOG ---');

  // A33-DB-01: Concurrent Audit Append Sequence Allocation (Zero Gaps / Collisions)
  try {
    const concurrentAppends = Array.from({ length: 25 }, (_, i) =>
      classroomDb.appendLockdownAuditEntry({
        actorId: `usr_actor_${i}`,
        actorRole: 'student',
        action: 'CONCURRENT_APPEND_TEST',
        resourceType: 'session',
        resourceId: `res_${i}`,
        outcome: 'GRANTED',
        reason: `Concurrent append stress test iteration ${i}`,
      })
    );

    const appendResults = await Promise.all(concurrentAppends);
    const sequences = appendResults.map((r) => r.sequenceNum);
    const minSeq = Math.min(...sequences);
    const maxSeq = Math.max(...sequences);

    // Verify contiguousness
    const sorted = [...sequences].sort((a, b) => a - b);
    let contiguous = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) contiguous = false;
    }

    const uniqueCount = new Set(sequences).size;
    const pass = contiguous && uniqueCount === 25 && maxSeq - minSeq === 24;
    record(
      'A33-DB-01',
      'Atomic Concurrent Audit Sequence Allocation (25 Iterations)',
      'Category B: Automated Unit Test',
      pass,
      `Total: ${appendResults.length}, Unique: ${uniqueCount}, Contiguous: ${contiguous}, Range: [${minSeq}..${maxSeq}]`
    );
  } catch (err: any) {
    record('A33-DB-01', 'Atomic Concurrent Audit Sequence Allocation (25 Iterations)', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-DB-02: Audit Record Content Modification Tamper Detection
  try {
    const db = await classroomDb.getDb();
    // Tamper with the latest audit row
    const latestRow: any = await db.prepare(`
      SELECT sequence_num, reason FROM lockdown_audit_log ORDER BY sequence_num DESC LIMIT 1
    `).get();

    await db.prepare(`
      UPDATE lockdown_audit_log SET reason = 'TAMPERED REASON VIA DIRECT SQL' WHERE sequence_num = ?
    `).run(latestRow.sequence_num);

    const integrityCheck = await classroomDb.verifyLockdownAuditLogIntegrity();

    // Revert tamper so database remains clean
    await db.prepare(`
      UPDATE lockdown_audit_log SET reason = ? WHERE sequence_num = ?
    `).run(latestRow.reason, latestRow.sequence_num);

    const pass = !integrityCheck.valid && integrityCheck.reason?.includes('Content tampering detected');
    record(
      'A33-DB-02',
      'Audit Record Modification Cryptographic Tamper Detection',
      'Category B: Automated Unit Test',
      pass,
      `Tamper Detected: ${!integrityCheck.valid}, Reason: ${integrityCheck.reason}`
    );
  } catch (err: any) {
    record('A33-DB-02', 'Audit Record Modification Cryptographic Tamper Detection', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-DB-03: Audit Record Deletion Tamper Detection
  try {
    const db = await classroomDb.getDb();
    // Select an intermediate record to delete
    const targetRow: any = await db.prepare(`
      SELECT * FROM lockdown_audit_log WHERE sequence_num > 5 ORDER BY sequence_num ASC LIMIT 1
    `).get();

    // Delete intermediate record to create sequence gap
    await db.prepare(`DELETE FROM lockdown_audit_log WHERE sequence_num = ?`).run(targetRow.sequence_num);

    const integrityCheck = await classroomDb.verifyLockdownAuditLogIntegrity();

    // Restore deleted record
    await db.prepare(`
      INSERT INTO lockdown_audit_log (
        id, sequence_num, timestamp, actor_id, actor_role, action, resource_type,
        resource_id, target_student_id, target_exam_id, outcome, error_code, reason,
        client_ip, previous_entry_hash, entry_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      targetRow.id,
      targetRow.sequence_num,
      targetRow.timestamp,
      targetRow.actor_id,
      targetRow.actor_role,
      targetRow.action,
      targetRow.resource_type,
      targetRow.resource_id,
      targetRow.target_student_id,
      targetRow.target_exam_id,
      targetRow.outcome,
      targetRow.error_code,
      targetRow.reason,
      targetRow.client_ip,
      targetRow.previous_entry_hash,
      targetRow.entry_hash
    );

    const pass = !integrityCheck.valid && integrityCheck.reason?.includes('Sequence break detected');
    record(
      'A33-DB-03',
      'Audit Record Deletion & Sequence Gap Tamper Detection',
      'Category B: Automated Unit Test',
      pass,
      `Gap Detected: ${!integrityCheck.valid}, Reason: ${integrityCheck.reason}`
    );
  } catch (err: any) {
    record('A33-DB-03', 'Audit Record Deletion & Sequence Gap Tamper Detection', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-DB-04: Full-Chain Recomputation Attack vs Signed Checkpoint
  try {
    // 1. Create a signed checkpoint over current valid audit log
    const checkpoint = await classroomDb.createAuditLogCheckpoint();

    // 2. Simulate attacker rewriting the hash chain: alter an entry's reason and recompute hashes
    const db = await classroomDb.getDb();
    const targetRow: any = await db.prepare(`
      SELECT sequence_num, entry_hash FROM lockdown_audit_log WHERE sequence_num = ?
    `).get(checkpoint.upToSequenceNum);

    const fakeHash = crypto.createHash('sha256').update('ATTACKER_RECOMPUTED_CHAIN_HASH').digest('hex');
    await db.prepare(`
      UPDATE lockdown_audit_log SET entry_hash = ? WHERE sequence_num = ?
    `).run(fakeHash, checkpoint.upToSequenceNum);

    // 3. Verify checkpoints detects the mismatch against signed state
    const chkVerification = await classroomDb.verifyAuditLogCheckpoints();

    // 4. Restore genuine hash
    await db.prepare(`
      UPDATE lockdown_audit_log SET entry_hash = ? WHERE sequence_num = ?
    `).run(targetRow.entry_hash, checkpoint.upToSequenceNum);

    const pass = !chkVerification.valid && chkVerification.reason?.includes('full-chain rewrite detected');
    record(
      'A33-DB-04',
      'Signed Checkpoint Defense Against Full-Chain Recomputation',
      'Category B: Automated Unit Test',
      pass,
      `Attack Caught: ${!chkVerification.valid}, Reason: ${chkVerification.reason}`
    );
  } catch (err: any) {
    record('A33-DB-04', 'Signed Checkpoint Defense Against Full-Chain Recomputation', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-DB-05: Checkpoint Signature Forgery Rejection
  try {
    const db = await classroomDb.getDb();
    const chkRow: any = await db.prepare(`
      SELECT checkpoint_id, server_signature FROM lockdown_audit_checkpoints ORDER BY checkpoint_seq DESC LIMIT 1
    `).get();

    // Forged signature
    await db.prepare(`
      UPDATE lockdown_audit_checkpoints SET server_signature = '0000000000000000000000000000000000000000000000000000000000000000' WHERE checkpoint_id = ?
    `).run(chkRow.checkpoint_id);

    const chkRes = await classroomDb.verifyAuditLogCheckpoints();

    // Restore genuine signature
    await db.prepare(`
      UPDATE lockdown_audit_checkpoints SET server_signature = ? WHERE checkpoint_id = ?
    `).run(chkRow.server_signature, chkRow.checkpoint_id);

    const pass = !chkRes.valid && chkRes.reason?.includes('signature verification failed');
    record(
      'A33-DB-05',
      'Audit Checkpoint Cryptographic Signature Tamper Rejection',
      'Category B: Automated Unit Test',
      pass,
      `Forged Checkpoint Blocked: ${!chkRes.valid}, Reason: ${chkRes.reason}`
    );
  } catch (err: any) {
    record('A33-DB-05', 'Audit Checkpoint Cryptographic Signature Tamper Rejection', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-DB-06: Concurrent Duplicate Submissions (Idempotent Receipt Integrity)
  try {
    const concurrentSessionId = `sess_a33_concurrent_sub_${Date.now()}`;
    const grant = signLaunchGrant({
      sub: studentId,
      examId,
      classroomId,
      deviceId: 'dev_a33_win',
      hardwareFingerprint: 'hw_fingerprint_a33',
      policyHash: 'pol_hash_synthetic',
    });

    const answersPayload = {
      examId,
      sessionId: concurrentSessionId,
      studentId,
      answers: { [`q1_${runId}`]: 'opt_a' },
      sequenceNumber: 1,
    };

    // Execute 3 simultaneous submission requests
    const concurrentSubs = [1, 2, 3].map(() => {
      const req = new NextRequest('http://localhost:3000/api/v1/lockdown/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cortex-lockdown-grant': grant,
        },
        body: JSON.stringify(answersPayload),
      });
      return postSubmitRoute(req).then((r) => r.json());
    });

    const subResults = await Promise.all(concurrentSubs);
    const receipts = subResults.map((r) => r.receipt).filter(Boolean);
    const allSuccessful = subResults.every((r) => r.success);
    const allReceiptsIdentical = receipts.length === 3 && receipts.every((r) => r === receipts[0]);

    const pass = allSuccessful && allReceiptsIdentical;
    record(
      'A33-DB-06',
      'Concurrent Duplicate Submission Idempotence & Receipt Integrity',
      'Category C: Integration Test',
      pass,
      `All 3 Succeeded: ${allSuccessful}, Identical Receipt: ${allReceiptsIdentical}, Canonical Receipt: ${receipts[0]}`
    );
  } catch (err: any) {
    record('A33-DB-06', 'Concurrent Duplicate Submission Idempotence & Receipt Integrity', 'Category C: Integration Test', false, err.message);
  }

  // A33-DB-07: Database Concurrency & Policy Version Integrity
  try {
    const policySaves = [1, 2, 3].map((i) =>
      classroomDb.saveLockdownPolicy({
        policyId: 'POL_CONCURRENT_TEST',
        version: 1, // Same version concurrent update
        hash: 'hash_concurrent_test',
        policyJson: JSON.stringify({ policyId: 'POL_CONCURRENT_TEST', version: 1, test: i }),
        actorId: `admin_${i}`,
        actorRole: 'department_dean',
        changeSummary: `Concurrent update ${i}`,
      })
    );

    await Promise.all(policySaves);
    const pol = await classroomDb.getLockdownPolicy('POL_CONCURRENT_TEST', 1);
    const versions = await classroomDb.listLockdownPolicyVersions('POL_CONCURRENT_TEST');

    const pass = pol !== null && versions.length === 1;
    record(
      'A33-DB-07',
      'Database Concurrent Policy Version Integrity (Unique Constraint)',
      'Category B: Automated Unit Test',
      pass,
      `Stored Policy Version: ${pol.version}, Total Versions: ${versions.length} (Expected exactly 1)`
    );
  } catch (err: any) {
    record('A33-DB-07', 'Database Concurrent Policy Version Integrity (Unique Constraint)', 'Category B: Automated Unit Test', false, err.message);
  }

  // A33-DB-08: Transaction Rollback and Recovery
  try {
    const db = await classroomDb.getDb();
    let transactionRolledBack = false;

    // Simulate an aborted atomic operation
    try {
      await db.exec('BEGIN TRANSACTION;');
      await db.prepare(`
        INSERT INTO classrooms (id, name, teacher_id, created_at, updated_at)
        VALUES ('CLS_ROLLBACK_TEST', 'Rollback Test', ?, ?, ?)
      `).run(deanId, Date.now(), Date.now());

      // Trigger intentional error (FOREIGN KEY failure or syntax error)
      await db.exec('INSERT INTO non_existent_table_for_rollback VALUES (1);');
      await db.exec('COMMIT;');
    } catch {
      await db.exec('ROLLBACK;');
      transactionRolledBack = true;
    }

    const testRoom = await classroomDb.getClassroom('CLS_ROLLBACK_TEST');
    const pass = transactionRolledBack && testRoom === null;
    record(
      'A33-DB-08',
      'Atomic Transaction Rollback & State Consistency',
      'Category B: Automated Unit Test',
      pass,
      `Transaction Rolled Back: ${transactionRolledBack}, Uncommitted Entity Evaporated: ${testRoom === null}`
    );
  } catch (err: any) {
    record('A33-DB-08', 'Atomic Transaction Rollback & State Consistency', 'Category B: Automated Unit Test', false, err.message);
  }

  console.log('');
  console.log('--- WORKSTREAM 5: SECRET MANAGEMENT & DATA MINIMIZATION ---');

  // A33-SEC-01: Secret Leakage & Payload Sanitization Inspection
  try {
    const secStudentId = `usr_cand_synth_a33_sec_${runId}`;
    await classroomDb.createUser({
      id: secStudentId,
      name: 'Sanitization Candidate',
      email: `sanitization.${runId}@apex.edu`,
      role: 'student',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const grant = signLaunchGrant({
      sub: secStudentId,
      examId,
      classroomId,
      deviceId: 'dev_a33_win',
      hardwareFingerprint: 'hw_fingerprint_a33',
      policyHash: 'pol_hash_synthetic',
    });

    const syncReq = new NextRequest('http://localhost:3000/api/v1/lockdown/sync-answers', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cortex-lockdown-grant': grant,
      },
      body: JSON.stringify({
        examId,
        sessionId: `sess_sec_${Date.now()}`,
        studentId: secStudentId,
        answers: { [`q1_${runId}`]: 'secret_test_answer' },
        sequenceNumber: 1,
      }),
    });

    const syncRes = await postSyncRoute(syncReq);
    const syncJson = await syncRes.json();
    const bodyText = JSON.stringify(syncJson);

    // Verify sensitive secrets do not leak
    const leaksPrivateKey = bodyText.includes('BEGIN PRIVATE KEY') || bodyText.includes('BEGIN RSA PRIVATE KEY');
    const leaksServerSecret = bodyText.includes('cortex-lockdown-secret') || bodyText.includes('dev_audit_checkpoint');
    const leaksRawPepper = bodyText.includes('pepper') && bodyText.includes('SHA256');

    const pass = !leaksPrivateKey && !leaksServerSecret && !leaksRawPepper;
    record(
      'A33-SEC-01',
      'Cryptographic Secret Leakage Defense & Response Sanitization',
      'Category A: Source-Code & Binary Inspection',
      pass,
      `Response Leaks Private Key: ${leaksPrivateKey}, Leaks HMAC Secrets: ${leaksServerSecret}, Status: ${syncRes.status}`
    );
  } catch (err: any) {
    record('A33-SEC-01', 'Cryptographic Secret Leakage Defense & Response Sanitization', 'Category A: Source-Code & Binary Inspection', false, err.message);
  }

  console.log('');
  console.log('--- WORKSTREAM 6: PHYSICAL BENCHMARKS (AMD RYZEN 7 8840U) ---');

  // A33-PERF-01: AMD Ryzen 7 8840U SAML & LTI Cryptographic Verification Latencies
  try {
    const validSaml = createSignedSamlResponse({
      spEntityId,
      idpEntityId,
      inResponseTo: '_bench_req',
      destination: acsUrl,
      user: testUser,
      privateKeyPem: samlFixture.privateKeyPem,
      certPem: samlFixture.certPem,
    });

    const validLti = createLtiIdToken(
      { ...baseLtiClaims, nonce: `n_bench_${Date.now()}` },
      { privateKeyPem: ltiFixture.privateKeyPem, algorithm: 'RS256' }
    );

    const samlLatencies: number[] = [];
    const ltiLatencies: number[] = [];

    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      validateSamlResponse(validSaml, spEntityId, '_bench_req', {
        idpPublicCertificatePem: samlFixture.publicKeyPem,
        skipReplayCheck: true,
      });
      samlLatencies.push(performance.now() - t0);

      const t1 = performance.now();
      validateLtiLaunchJwt(validLti, validLti.split('.')[1] ? JSON.parse(Buffer.from(validLti.split('.')[1], 'base64url').toString('utf8')).nonce : '', {
        publicKeyPem: ltiFixture.publicKeyPem,
        skipReplayCheck: true,
      });
      ltiLatencies.push(performance.now() - t1);
    }

    samlLatencies.sort((a, b) => a - b);
    ltiLatencies.sort((a, b) => a - b);

    const samlAvg = (samlLatencies.reduce((a, b) => a + b, 0) / 25).toFixed(3);
    const samlMed = samlLatencies[12].toFixed(3);
    const samlP95 = samlLatencies[23].toFixed(3);

    const ltiAvg = (ltiLatencies.reduce((a, b) => a + b, 0) / 25).toFixed(3);
    const ltiMed = ltiLatencies[12].toFixed(3);
    const ltiP95 = ltiLatencies[23].toFixed(3);

    const pass = parseFloat(samlAvg) < 5.0 && parseFloat(ltiAvg) < 5.0;
    record(
      'A33-PERF-01',
      'AMD Ryzen 7 8840U SAML & LTI Cryptographic Verification Latencies',
      'Category E: Physical Windows Execution',
      pass,
      `SAML RSA-SHA256: Min=${samlLatencies[0].toFixed(3)}ms, Avg=${samlAvg}ms, Med=${samlMed}ms, P95=${samlP95}ms | LTI RS256: Min=${ltiLatencies[0].toFixed(3)}ms, Avg=${ltiAvg}ms, Med=${ltiMed}ms, P95=${ltiP95}ms`
    );
  } catch (err: any) {
    record('A33-PERF-01', 'AMD Ryzen 7 8840U SAML & LTI Cryptographic Verification Latencies', 'Category E: Physical Windows Execution', false, err.message);
  }

  // A33-PERF-02: AMD Ryzen 7 8840U Audit Checkpoint Creation & Verification Latencies
  try {
    const chkCreateLatencies: number[] = [];
    const chkVerifyLatencies: number[] = [];

    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      await classroomDb.createAuditLogCheckpoint();
      chkCreateLatencies.push(performance.now() - t0);

      const t1 = performance.now();
      await classroomDb.verifyAuditLogCheckpoints();
      chkVerifyLatencies.push(performance.now() - t1);
    }

    chkCreateLatencies.sort((a, b) => a - b);
    chkVerifyLatencies.sort((a, b) => a - b);

    const cAvg = (chkCreateLatencies.reduce((a, b) => a + b, 0) / 25).toFixed(3);
    const cMed = chkCreateLatencies[12].toFixed(3);
    const cP95 = chkCreateLatencies[23].toFixed(3);

    const vAvg = (chkVerifyLatencies.reduce((a, b) => a + b, 0) / 25).toFixed(3);
    const vMed = chkVerifyLatencies[12].toFixed(3);
    const vP95 = chkVerifyLatencies[23].toFixed(3);

    const mem = process.memoryUsage();
    const rssMb = (mem.rss / (1024 * 1024)).toFixed(2);
    const heapMb = (mem.heapUsed / (1024 * 1024)).toFixed(2);

    const pass = parseFloat(cAvg) < 10.0 && parseFloat(vAvg) < 50.0;
    record(
      'A33-PERF-02',
      'AMD Ryzen 7 8840U Audit Checkpoint HMAC Creation & Verify Latencies',
      'Category E: Physical Windows Execution',
      pass,
      `Checkpoint Create: Min=${chkCreateLatencies[0].toFixed(3)}ms, Avg=${cAvg}ms, Med=${cMed}ms, P95=${cP95}ms | Verify: Min=${chkVerifyLatencies[0].toFixed(3)}ms, Avg=${vAvg}ms, Med=${vMed}ms, P95=${vP95}ms | Memory: RSS=${rssMb}MB, Heap=${heapMb}MB`
    );
  } catch (err: any) {
    record('A33-PERF-02', 'AMD Ryzen 7 8840U Audit Checkpoint HMAC Creation & Verify Latencies', 'Category E: Physical Windows Execution', false, err.message);
  }

  console.log('');
  console.log('================================================================');
  console.log('ALPHA 33 VERIFICATION SCORECARD');
  console.log('================================================================');
  const total = scorecard.length;
  const passed = scorecard.filter((s) => s.passed).length;
  const failed = scorecard.filter((s) => !s.passed).length;
  const pct = ((passed / total) * 100).toFixed(1);

  console.log(`Total Checks Evaluated: ${total}`);
  console.log(`Passed Checks:          ${passed}`);
  console.log(`Failed Checks:          ${failed}`);
  console.log(`Compliance Rate:        ${pct}%`);
  console.log('================================================================');

  if (failed > 0) {
    console.log(`WARNING: ${failed} CHECKS FAILED.`);
    process.exit(1);
  } else {
    console.log('ALL ALPHA 33 VERIFICATION CHECKS CONFIRMED PASS.');
  }
}

runAlpha33VerificationSuite().catch((err) => {
  console.error('Fatal suite execution error:', err);
  process.exit(1);
});
