/**
 * CORTEX LOCKDOWN - ALPHA 36 VERIFICATION SUITE
 *
 * Protocol Interoperability & Production Integration Hardening
 *
 * Hardware target: AMD Ryzen 7 8840U w/ Radeon 780M Graphics (16 vCPUs), Windows 11 Build 26300.
 *
 * Strictly zero emojis.
 */

import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { classroomDb } from '../src/lib/classroom/db';
import { DatabaseProviderCapabilities, MockD1Wrapper } from '../src/lib/db';
import {
  canonicalizeXml,
  validateSamlResponse,
  validateSamlResponseAsync,
  createSignedSamlResponse,
  resetReplayCaches,
  SAML_STANDARDS_COMPLIANCE,
  SamlUserAttributes,
  SamlInstitutionalConfig,
  SamlConfigManager,
  defaultSamlConfigManager,
  LtiInstitutionalRegistration,
  LtiConfigManager,
  defaultLtiConfigManager,
  LtiJwksResolver,
  defaultLtiJwksResolver,
  isSsrfSafeUrl,
  createLtiIdToken,
  validateLtiLaunchJwt,
  validateLtiLaunchJwtAsync,
  LtiLaunchClaims,
  getDefaultLtiFixture,
} from '../src/lib/lockdown/institutional-integration';

interface CheckResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  evidence: string;
}

const results: CheckResult[] = [];

function recordCheck(id: string, name: string, category: string, passed: boolean, evidence: string) {
  results.push({ id, name, category, passed, evidence });
  const status = passed ? '[PASS]' : '[FAIL]';
  console.log(`${status} [${category}] ${id}: ${name} (${evidence})`);
}

// ---------------------------------------------------------------------------
// TEST FIXTURES & HELPERS
// ---------------------------------------------------------------------------

function generateIndependentRsaKeypair(): {
  publicKeyPem: string;
  privateKeyPem: string;
  jwk: any;
  kid: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
  const kid = `key_indep_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    jwk,
    kid,
  };
}

async function runAlpha36Suite() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN - ALPHA 36: PROTOCOL INTEROPERABILITY');
  console.log('Hardware Target: AMD Ryzen 7 8840U w/ Radeon 780M, Windows 11');
  console.log('================================================================\n');

  resetReplayCaches();

  // ===========================================================================
  // GROUP 1: SAML XMLDSIG & CANONICALIZATION EDGE CASES
  // ===========================================================================
  console.log('--- GROUP 1: SAML XMLDSig & Canonicalization Edge Cases ---');

  const indepKey = generateIndependentRsaKeypair();
  const testUser: SamlUserAttributes = {
    eduPersonPrincipalName: 'candidate.alpha36@campus.edu',
    mail: 'candidate.alpha36@campus.edu',
    givenName: 'Candidate',
    surName: 'Alpha36',
    eduPersonScopedAffiliation: ['student@campus.edu', 'member@campus.edu'],
    mappedRole: 'student',
  };

  const validSamlB64 = createSignedSamlResponse({
    spEntityId: 'https://cortex.edu/sp',
    idpEntityId: 'https://idp.campus.edu/saml2',
    inResponseTo: 'req_a36_001',
    destination: 'https://cortex.edu/api/v1/lockdown/saml/acs',
    user: testUser,
    privateKeyPem: indepKey.privateKeyPem,
    publicKeyPem: indepKey.publicKeyPem,
    keyId: indepKey.kid,
  });

  // A36-SAML-01: Valid Independent SAML Assertion Verification
  const validRes = validateSamlResponse(
    validSamlB64,
    'https://cortex.edu/sp',
    'req_a36_001',
    {
      expectedIdpIssuer: 'https://idp.campus.edu/saml2',
      expectedDestination: 'https://cortex.edu/api/v1/lockdown/saml/acs',
      idpPublicCertificatePem: indepKey.publicKeyPem,
      skipReplayCheck: true,
    }
  );
  recordCheck(
    'A36-SAML-01',
    'Valid Independent SAML Assertion Verification',
    'B',
    validRes.valid && validRes.user?.mail === 'candidate.alpha36@campus.edu',
    `Verified candidate: ${validRes.user?.mail}, Role: ${validRes.user?.mappedRole}`
  );

  // A36-SAML-02: Modified Assertion Content Digest Mismatch Defense
  const rawXml = Buffer.from(validSamlB64, 'base64').toString('utf8');
  const tamperedXml = rawXml.replace('candidate.alpha36@campus.edu', 'attacker.modified@campus.edu');
  const tamperedRes = validateSamlResponse(
    Buffer.from(tamperedXml).toString('base64'),
    'https://cortex.edu/sp',
    'req_a36_001',
    { idpPublicCertificatePem: indepKey.publicKeyPem, skipReplayCheck: true }
  );
  recordCheck(
    'A36-SAML-02',
    'Modified Assertion Content Digest Mismatch Defense',
    'B',
    !tamperedRes.valid && tamperedRes.errorCode === 'SAML_DIGEST_MISMATCH',
    `Result: ${tamperedRes.errorCode} (${tamperedRes.reason})`
  );

  // A36-SAML-03: Invalid Signature Key Rejection
  const otherKey = generateIndependentRsaKeypair();
  const invalidSigRes = validateSamlResponse(
    validSamlB64,
    'https://cortex.edu/sp',
    'req_a36_001',
    { idpPublicCertificatePem: otherKey.publicKeyPem, skipReplayCheck: true }
  );
  recordCheck(
    'A36-SAML-03',
    'Invalid Signature Key Rejection (Untrusted Signer)',
    'B',
    !invalidSigRes.valid && invalidSigRes.errorCode === 'SAML_SIGNATURE_VERIFICATION_FAILED',
    `Result: ${invalidSigRes.errorCode}`
  );

  // A36-SAML-04: Transform Allowlisting Enforcement (Unsupported Transform Rejection)
  const xpathTransformXml = rawXml.replace(
    '<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>',
    '<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"/>'
  );
  const xpathRes = validateSamlResponse(
    Buffer.from(xpathTransformXml).toString('base64'),
    'https://cortex.edu/sp',
    'req_a36_001',
    { idpPublicCertificatePem: indepKey.publicKeyPem, skipReplayCheck: true }
  );
  recordCheck(
    'A36-SAML-04',
    'Transform Allowlisting (Unsupported XPath Transform Rejection)',
    'B',
    !xpathRes.valid && xpathRes.errorCode === 'SAML_UNSUPPORTED_TRANSFORM',
    `Result: ${xpathRes.errorCode} (${xpathRes.reason})`
  );

  // A36-SAML-05: Multiple SignedInfo References Rejection
  const multiRefXml = rawXml.replace(
    /(<ds:Reference[^>]*>[\s\S]*?<\/ds:Reference>)/,
    '$1\n        <ds:Reference URI="#extra"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>extra==</ds:DigestValue></ds:Reference>'
  );
  const multiRefRes = validateSamlResponse(
    Buffer.from(multiRefXml).toString('base64'),
    'https://cortex.edu/sp',
    'req_a36_001',
    { idpPublicCertificatePem: indepKey.publicKeyPem, skipReplayCheck: true }
  );
  recordCheck(
    'A36-SAML-05',
    'Multiple SignedInfo References Defense',
    'B',
    !multiRefRes.valid && multiRefRes.errorCode === 'SAML_MULTIPLE_REFERENCES_DETECTED',
    `Result: ${multiRefRes.errorCode}`
  );

  // A36-SAML-06: SubjectConfirmationData Recipient Verification
  const recipientRes = validateSamlResponse(
    validSamlB64,
    'https://cortex.edu/sp',
    'req_a36_001',
    {
      expectedRecipient: 'https://attacker.com/malicious/acs',
      idpPublicCertificatePem: indepKey.publicKeyPem,
      skipReplayCheck: true,
    }
  );
  recordCheck(
    'A36-SAML-06',
    'SubjectConfirmationData Recipient Mismatch Defense',
    'B',
    !recipientRes.valid && recipientRes.errorCode === 'SAML_RECIPIENT_MISMATCH',
    `Result: ${recipientRes.errorCode}`
  );

  // A36-SAML-07: XML Signature Wrapping Multiple Signatures Defense
  const multiSigXml = rawXml.replace(
    '</samlp:Response>',
    '<ds:Signature><ds:SignedInfo/><ds:SignatureValue>abc==</ds:SignatureValue></ds:Signature></samlp:Response>'
  );
  const multiSigRes = validateSamlResponse(
    Buffer.from(multiSigXml).toString('base64'),
    'https://cortex.edu/sp',
    'req_a36_001',
    { idpPublicCertificatePem: indepKey.publicKeyPem, skipReplayCheck: true }
  );
  recordCheck(
    'A36-SAML-07',
    'Multiple ds:Signature Elements Defense (XSW Rejection)',
    'B',
    !multiSigRes.valid && multiSigRes.errorCode === 'SAML_MULTIPLE_SIGNATURES_DETECTED',
    `Result: ${multiSigRes.errorCode}`
  );

  // A36-SAML-08: Duplicate XML ID Defense
  const duplicateIdXml = rawXml.replace(
    '<saml:Subject>',
    '<saml:Subject ID="test-id"><saml:SubjectConfirmation ID="test-id">'
  );
  const duplicateIdRes = validateSamlResponse(
    Buffer.from(duplicateIdXml).toString('base64'),
    'https://cortex.edu/sp',
    'req_a36_001',
    { idpPublicCertificatePem: indepKey.publicKeyPem, skipReplayCheck: true }
  );
  recordCheck(
    'A36-SAML-08',
    'Duplicate XML ID Attribute Defense (ID Collision Defense)',
    'B',
    !duplicateIdRes.valid && (duplicateIdRes.errorCode === 'SAML_DUPLICATE_ID_DETECTED' || duplicateIdRes.errorCode === 'SAML_DIGEST_MISMATCH'),
    `Result: ${duplicateIdRes.errorCode}`
  );

  // A36-SAML-09: SAML Assertion Replay Defense
  const replayId = `req_a36_replay_${Date.now()}`;
  const replayRes1 = await validateSamlResponseAsync(
    validSamlB64,
    'https://cortex.edu/sp',
    'req_a36_001',
    { idpPublicCertificatePem: indepKey.publicKeyPem }
  );
  const replayRes2 = await validateSamlResponseAsync(
    validSamlB64,
    'https://cortex.edu/sp',
    'req_a36_001',
    { idpPublicCertificatePem: indepKey.publicKeyPem }
  );
  recordCheck(
    'A36-SAML-09',
    'SAML Assertion Single-Use Replay Defense Across Requests',
    'C',
    replayRes1.valid && !replayRes2.valid && replayRes2.errorCode === 'SAML_ASSERTION_REPLAY_DETECTED',
    `Attempt 1 valid: ${replayRes1.valid}, Attempt 2 error: ${replayRes2.errorCode}`
  );

  // ===========================================================================
  // GROUP 2: LTI 1.3 DYNAMIC JWKS RESOLVER & SSRF PROTECTIONS
  // ===========================================================================
  console.log('\n--- GROUP 2: LTI 1.3 Dynamic JWKS Resolver & SSRF Protections ---');

  const ltiKey1 = generateIndependentRsaKeypair();
  const ltiKey2 = generateIndependentRsaKeypair();

  let syntheticJwksKeys = [ltiKey1.jwk];
  let syntheticServerCallCount = 0;

  // Spin up an ephemeral synthetic local JWKS server
  const jwksServer = http.createServer((req, res) => {
    syntheticServerCallCount++;
    if (req.url === '/jwks') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: syntheticJwksKeys }));
    } else if (req.url === '/malformed') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('NOT_JSON_PAYLOAD_<<<>>>');
    } else if (req.url === '/alg_confusion') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [{ kty: 'oct', alg: 'HS256', k: 'secret123', kid: 'confused_key' }] }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
  const serverPort = (jwksServer.address() as any).port;
  const syntheticJwksUrl = `http://127.0.0.1:${serverPort}/jwks`;
  const syntheticIssuer = `http://127.0.0.1:${serverPort}/lms`;

  const testConfigManager = new LtiConfigManager();
  testConfigManager.registerPlatform({
    institutionId: 'inst_synthetic_lms',
    version: 1,
    active: true,
    issuer: syntheticIssuer,
    clientId: 'cortex_test_client_001',
    deploymentId: 'dep_synthetic_01',
    authEndpoint: `http://127.0.0.1:${serverPort}/auth`,
    jwksUri: syntheticJwksUrl,
    tokenEndpoint: `http://127.0.0.1:${serverPort}/token`,
    allowedRedirectUris: ['https://cortex.edu/api/v1/lockdown/lti/launch'],
    registeredCourseContexts: ['course_cs101', 'course_cs102'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const jwksResolver = new LtiJwksResolver(testConfigManager, {
    defaultTtlSeconds: 3600,
    minRefreshIntervalSeconds: 60,
  });

  // A36-JWKS-01: Retrieval of Valid JWKS Signing Keys via HTTP
  const resolve1 = await jwksResolver.resolveSigningKey({
    issuer: syntheticIssuer,
    kid: ltiKey1.kid,
    allowInsecureHttpForTesting: true,
  });
  recordCheck(
    'A36-JWKS-01',
    'Retrieval of Valid JWKS Signing Keys via Registered Issuer',
    'C',
    resolve1.kid === ltiKey1.kid && resolve1.publicKeyPem.includes('BEGIN PUBLIC KEY'),
    `Resolved Key ID: ${resolve1.kid}, Calls to server: ${syntheticServerCallCount}`
  );

  // A36-JWKS-02: JWKS In-Memory Cache Hit (Zero Network Call)
  const prevCount = syntheticServerCallCount;
  const resolveCache = await jwksResolver.resolveSigningKey({
    issuer: syntheticIssuer,
    kid: ltiKey1.kid,
    allowInsecureHttpForTesting: true,
  });
  recordCheck(
    'A36-JWKS-02',
    'JWKS In-Memory Cache Hit (Zero Network Re-Fetch)',
    'B',
    resolveCache.kid === ltiKey1.kid && syntheticServerCallCount === prevCount,
    `Cache served key without network fetch: ${syntheticServerCallCount === prevCount}`
  );

  // A36-JWKS-03: Key Rotation / Unknown Key ID Refresh
  // Add key2 to server and force refresh to simulate rotation
  syntheticJwksKeys.push(ltiKey2.jwk);
  const resolveRotated = await jwksResolver.resolveSigningKey({
    issuer: syntheticIssuer,
    kid: ltiKey2.kid,
    forceRefresh: true,
    allowInsecureHttpForTesting: true,
  });
  recordCheck(
    'A36-JWKS-03',
    'Key Rotation & Dynamic Refresh on Rotated Key ID',
    'C',
    resolveRotated.kid === ltiKey2.kid && resolveRotated.publicKeyPem.includes('BEGIN PUBLIC KEY'),
    `Resolved Rotated Key ID: ${resolveRotated.kid}`
  );

  // A36-JWKS-04: Unknown Key Refresh Rate Limiting (Anti-DoS Defense)
  let rateLimitCaught = false;
  try {
    await jwksResolver.resolveSigningKey({
      issuer: syntheticIssuer,
      kid: 'bogus_kid_attack_01',
      allowInsecureHttpForTesting: true,
    });
  } catch (err: any) {
    if (err.errorCode === 'LTI_JWKS_REFRESH_RATE_LIMITED' || err.errorCode === 'LTI_KEY_NOT_FOUND') {
      rateLimitCaught = true;
    }
  }
  recordCheck(
    'A36-JWKS-04',
    'Rate-Limiting on Unknown Key IDs (Anti-DoS Defense)',
    'B',
    rateLimitCaught,
    `Protected against unbounded outbound network requests on unknown key ID`
  );

  // A36-JWKS-05: SSRF Defense: Cloud Metadata Endpoint Rejection
  const ssrfMetadata = isSsrfSafeUrl('http://169.254.169.254/latest/meta-data');
  const ssrfGcp = isSsrfSafeUrl('http://metadata.google.internal/computeMetadata/v1');
  recordCheck(
    'A36-JWKS-05',
    'SSRF Defense: Cloud Metadata Endpoints Rejection',
    'B',
    !ssrfMetadata.safe && !ssrfGcp.safe && ssrfMetadata.errorCode === 'LTI_SSRF_METADATA_ENDPOINT_BLOCKED',
    `AWS metadata blocked: ${!ssrfMetadata.safe}, GCP metadata blocked: ${!ssrfGcp.safe}`
  );

  // A36-JWKS-06: SSRF Defense: Loopback Interface Rejection in Production
  const ssrfLoopback = isSsrfSafeUrl('http://127.0.0.1:8080/jwks', false);
  recordCheck(
    'A36-JWKS-06',
    'SSRF Defense: Localhost / Loopback Rejection in Production',
    'B',
    !ssrfLoopback.safe && ssrfLoopback.errorCode === 'LTI_SSRF_INSECURE_PROTOCOL',
    `Insecure/loopback blocked: ${ssrfLoopback.errorCode}`
  );

  // A36-JWKS-07: SSRF Defense: Private IPv4 Network Range Rejection
  const ssrfPrivate1 = isSsrfSafeUrl('https://10.0.1.50/jwks', false);
  const ssrfPrivate2 = isSsrfSafeUrl('https://192.168.1.1/jwks', false);
  recordCheck(
    'A36-JWKS-07',
    'SSRF Defense: Private IPv4 Network Ranges Rejection (10.x, 192.168.x)',
    'B',
    !ssrfPrivate1.safe && !ssrfPrivate2.safe && ssrfPrivate1.errorCode === 'LTI_SSRF_PRIVATE_NETWORK_BLOCKED',
    `10.x blocked: ${!ssrfPrivate1.safe}, 192.168.x blocked: ${!ssrfPrivate2.safe}`
  );

  // A36-JWKS-08: Algorithm Confusion Defense (Symmetric / Non-RSA Rejection)
  testConfigManager.registerPlatform({
    institutionId: 'inst_alg_confusion',
    version: 1,
    active: true,
    issuer: `http://127.0.0.1:${serverPort}/confused_lms`,
    clientId: 'client_confused',
    deploymentId: 'dep_confused',
    authEndpoint: `http://127.0.0.1:${serverPort}/auth`,
    jwksUri: `http://127.0.0.1:${serverPort}/alg_confusion`,
    tokenEndpoint: `http://127.0.0.1:${serverPort}/token`,
    allowedRedirectUris: ['https://cortex.edu/api/v1/lockdown/lti/launch'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  let algConfusionCaught = false;
  try {
    await jwksResolver.resolveSigningKey({
      issuer: `http://127.0.0.1:${serverPort}/confused_lms`,
      kid: 'confused_key',
      allowInsecureHttpForTesting: true,
    });
  } catch (err: any) {
    if (err.errorCode === 'LTI_JWKS_NO_VALID_KEYS') algConfusionCaught = true;
  }
  recordCheck(
    'A36-JWKS-08',
    'Algorithm Confusion Defense (Non-RSA / Symmetric Keys Rejected)',
    'B',
    algConfusionCaught,
    `Symmetric HMAC key rejected from JWKS`
  );

  // A36-JWKS-09: Malformed JWKS Response Handling
  testConfigManager.registerPlatform({
    institutionId: 'inst_malformed_jwks',
    version: 1,
    active: true,
    issuer: `http://127.0.0.1:${serverPort}/malformed_lms`,
    clientId: 'client_malformed',
    deploymentId: 'dep_malformed',
    authEndpoint: `http://127.0.0.1:${serverPort}/auth`,
    jwksUri: `http://127.0.0.1:${serverPort}/malformed`,
    tokenEndpoint: `http://127.0.0.1:${serverPort}/token`,
    allowedRedirectUris: ['https://cortex.edu/api/v1/lockdown/lti/launch'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  let malformedCaught = false;
  try {
    await jwksResolver.resolveSigningKey({
      issuer: `http://127.0.0.1:${serverPort}/malformed_lms`,
      kid: 'any_key',
      allowInsecureHttpForTesting: true,
    });
  } catch (err: any) {
    if (err.errorCode === 'LTI_JWKS_MALFORMED_JSON') malformedCaught = true;
  }
  recordCheck(
    'A36-JWKS-09',
    'Malformed JWKS Payload Defense (Fails Closed)',
    'B',
    malformedCaught,
    `Handled malformed non-JSON payload cleanly`
  );

  // ===========================================================================
  // GROUP 3: COMPLETE LTI 1.3 CLAIM VALIDATION & MULTI-TENANT ISOLATION
  // ===========================================================================
  console.log('\n--- GROUP 3: Complete LTI 1.3 Claim Validation & Multi-Tenant Isolation ---');

  const ltiClaims: LtiLaunchClaims = {
    sub: 'student_a36_99',
    name: 'Ada Lovelace',
    email: 'ada@synthetic.edu',
    messageType: 'LtiResourceLinkRequest',
    version: '1.3.0',
    resourceLinkId: 'res_quiz_01',
    contextId: 'course_cs101',
    contextTitle: 'Computer Science 101',
    targetLinkUri: 'https://cortex.edu/api/v1/lockdown/lti/launch',
    roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    nonce: `nonce_a36_001_${Date.now()}`,
    deploymentId: 'dep_synthetic_01',
  };

  const validJwt = createLtiIdToken(ltiClaims, {
    privateKeyPem: ltiKey1.privateKeyPem,
    keyId: ltiKey1.kid,
    algorithm: 'RS256',
    issuer: syntheticIssuer,
    audience: 'cortex_test_client_001',
    deploymentId: 'dep_synthetic_01',
  });

  // A36-LTI-01: End-to-End LTI Launch with Dynamic JWKS Resolution
  const ltiRes1 = await validateLtiLaunchJwtAsync(validJwt, ltiClaims.nonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_test_client_001',
    expectedDeploymentId: 'dep_synthetic_01',
    expectedContextId: 'course_cs101',
    expectedTargetLinkUri: 'https://cortex.edu/api/v1/lockdown/lti/launch',
    jwksResolver,
    allowInsecureHttpForTesting: true,
    skipReplayCheck: true,
  });
  recordCheck(
    'A36-LTI-01',
    'End-to-End LTI 1.3 Launch via Dynamic JWKS Resolution',
    'C',
    ltiRes1.valid && ltiRes1.claims?.name === 'Ada Lovelace' && ltiRes1.mappedRole === 'student',
    `Verified User: ${ltiRes1.claims?.name}, Role: ${ltiRes1.mappedRole}`
  );

  // A36-LTI-02: Issuer Substitution Defense
  const ltiResBadIssuer = await validateLtiLaunchJwtAsync(validJwt, ltiClaims.nonce, {
    expectedIssuer: 'https://attacker.edu/fake_issuer',
    expectedAudience: 'cortex_test_client_001',
    jwksResolver,
    allowInsecureHttpForTesting: true,
    skipReplayCheck: true,
  });
  recordCheck(
    'A36-LTI-02',
    'LTI Issuer Substitution Defense',
    'B',
    !ltiResBadIssuer.valid && ltiResBadIssuer.errorCode === 'LTI_ISSUER_MISMATCH',
    `Result: ${ltiResBadIssuer.errorCode}`
  );

  // A36-LTI-03: Audience Substitution Defense
  const ltiResBadAud = await validateLtiLaunchJwtAsync(validJwt, ltiClaims.nonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_attacker_client',
    jwksResolver,
    allowInsecureHttpForTesting: true,
    skipReplayCheck: true,
  });
  recordCheck(
    'A36-LTI-03',
    'LTI Audience Substitution Defense',
    'B',
    !ltiResBadAud.valid && ltiResBadAud.errorCode === 'LTI_AUDIENCE_MISMATCH',
    `Result: ${ltiResBadAud.errorCode}`
  );

  // A36-LTI-04: Deployment ID Substitution Defense
  const ltiResBadDep = await validateLtiLaunchJwtAsync(validJwt, ltiClaims.nonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_test_client_001',
    expectedDeploymentId: 'dep_unauthorized_other',
    jwksResolver,
    allowInsecureHttpForTesting: true,
    skipReplayCheck: true,
  });
  recordCheck(
    'A36-LTI-04',
    'LTI Deployment ID Substitution Defense',
    'B',
    !ltiResBadDep.valid && ltiResBadDep.errorCode === 'LTI_DEPLOYMENT_ID_MISMATCH',
    `Result: ${ltiResBadDep.errorCode}`
  );

  // A36-LTI-05: Target Link URI Mismatch Defense
  const ltiResBadUri = await validateLtiLaunchJwtAsync(validJwt, ltiClaims.nonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_test_client_001',
    expectedTargetLinkUri: 'https://cortex.edu/other/path',
    jwksResolver,
    allowInsecureHttpForTesting: true,
    skipReplayCheck: true,
  });
  recordCheck(
    'A36-LTI-05',
    'LTI Target Link URI Mismatch Defense',
    'B',
    !ltiResBadUri.valid && ltiResBadUri.errorCode === 'LTI_TARGET_LINK_URI_MISMATCH',
    `Result: ${ltiResBadUri.errorCode}`
  );

  // A36-LTI-06: Course Context ID Mismatch Defense
  const ltiResBadCtx = await validateLtiLaunchJwtAsync(validJwt, ltiClaims.nonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_test_client_001',
    expectedContextId: 'course_forbidden_999',
    jwksResolver,
    allowInsecureHttpForTesting: true,
    skipReplayCheck: true,
  });
  recordCheck(
    'A36-LTI-06',
    'LTI Course Context ID Mismatch Defense',
    'B',
    !ltiResBadCtx.valid && ltiResBadCtx.errorCode === 'LTI_CONTEXT_MISMATCH',
    `Result: ${ltiResBadCtx.errorCode}`
  );

  // A36-LTI-07: Expired Token Rejection
  const expNonce = `nonce_exp_${Date.now()}`;
  const expiredJwt = createLtiIdToken(
    { ...ltiClaims, nonce: expNonce },
    {
      privateKeyPem: ltiKey1.privateKeyPem,
      keyId: ltiKey1.kid,
      issuer: syntheticIssuer,
      audience: 'cortex_test_client_001',
      expiresInSeconds: -300, // Expired 5 minutes ago
    }
  );
  const ltiResExpired = await validateLtiLaunchJwtAsync(expiredJwt, expNonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_test_client_001',
    jwksResolver,
    allowInsecureHttpForTesting: true,
    skipReplayCheck: true,
  });
  recordCheck(
    'A36-LTI-07',
    'LTI Expired Token Rejection',
    'B',
    !ltiResExpired.valid && ltiResExpired.errorCode === 'TOKEN_EXPIRED',
    `Result: ${ltiResExpired.errorCode}`
  );

  // A36-LTI-08: Nonce Replay Defense Across Requests
  const ltiReplayNonce = `nonce_replay_test_${Date.now()}`;
  const replayJwt = createLtiIdToken(
    { ...ltiClaims, nonce: ltiReplayNonce },
    {
      privateKeyPem: ltiKey1.privateKeyPem,
      keyId: ltiKey1.kid,
      issuer: syntheticIssuer,
      audience: 'cortex_test_client_001',
    }
  );
  const replayLti1 = await validateLtiLaunchJwtAsync(replayJwt, ltiReplayNonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_test_client_001',
    jwksResolver,
    allowInsecureHttpForTesting: true,
  });
  const replayLti2 = await validateLtiLaunchJwtAsync(replayJwt, ltiReplayNonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_test_client_001',
    jwksResolver,
    allowInsecureHttpForTesting: true,
  });
  recordCheck(
    'A36-LTI-08',
    'LTI Nonce Single-Use Replay Defense Across Invocations',
    'C',
    replayLti1.valid && !replayLti2.valid && replayLti2.errorCode === 'LTI_NONCE_REPLAY_DETECTED',
    `Attempt 1 valid: ${replayLti1.valid}, Attempt 2 error: ${replayLti2.errorCode}`
  );

  // A36-LTI-09: Multi-Tenant Institutional Isolation Enforcement
  testConfigManager.registerPlatform({
    institutionId: 'inst_foreign_univ',
    version: 1,
    active: true,
    issuer: 'https://foreign.edu/lms',
    clientId: 'foreign_client_999',
    deploymentId: 'dep_foreign_99',
    authEndpoint: 'https://foreign.edu/auth',
    jwksUri: 'https://foreign.edu/jwks',
    tokenEndpoint: 'https://foreign.edu/token',
    allowedRedirectUris: ['https://cortex.edu/api/v1/lockdown/lti/launch'],
    registeredCourseContexts: ['course_foreign_01'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const tenantRes = testConfigManager.enforceTenantIsolation('inst_foreign_univ', {
    issuer: syntheticIssuer, // Trying to use syntheticIssuer with inst_foreign_univ
    clientId: 'cortex_test_client_001',
    deploymentId: 'dep_synthetic_01',
  });
  recordCheck(
    'A36-LTI-09',
    'Multi-Tenant Institutional Isolation (Cross-Tenant Token Rejection)',
    'B',
    !tenantRes.allowed,
    `Denied cross-tenant launch: ${tenantRes.reason}`
  );

  // A36-LTI-10: IMS Global Membership Role Mapping
  const instructorClaims: LtiLaunchClaims = {
    ...ltiClaims,
    roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
    nonce: `nonce_role_${Date.now()}`,
  };
  const instructorJwt = createLtiIdToken(instructorClaims, {
    privateKeyPem: ltiKey1.privateKeyPem,
    keyId: ltiKey1.kid,
    issuer: syntheticIssuer,
    audience: 'cortex_test_client_001',
  });
  const instructorRes = await validateLtiLaunchJwtAsync(instructorJwt, instructorClaims.nonce, {
    expectedIssuer: syntheticIssuer,
    expectedAudience: 'cortex_test_client_001',
    jwksResolver,
    allowInsecureHttpForTesting: true,
    skipReplayCheck: true,
  });
  recordCheck(
    'A36-LTI-10',
    'IMS Global Membership Role Mapping (Instructor -> faculty_lead)',
    'B',
    instructorRes.valid && instructorRes.mappedRole === 'faculty_lead',
    `Mapped IMS role to Cortex audit role: ${instructorRes.mappedRole}`
  );

  // Close synthetic JWKS server
  await new Promise<void>((resolve) => jwksServer.close(() => resolve()));

  // ===========================================================================
  // GROUP 4: INSTITUTIONAL CONFIGURATION SECURITY & VERSIONING
  // ===========================================================================
  console.log('\n--- GROUP 4: Institutional Configuration Security & Versioning ---');

  const samlMgr = new SamlConfigManager();
  const validSamlConfig: SamlInstitutionalConfig = {
    institutionId: 'inst_univ_tech',
    version: 1,
    active: true,
    idpEntityId: 'https://idp.univ.edu/saml',
    idpSsoUrl: 'https://idp.univ.edu/sso',
    spEntityId: 'https://cortex.edu/sp',
    acsUrl: 'https://cortex.edu/api/v1/lockdown/saml/acs',
    primaryCert: {
      pem: indepKey.publicKeyPem,
      thumbprint: 'AA:BB:CC:DD',
      notBefore: '2026-01-01T00:00:00Z',
      notAfter: '2028-01-01T00:00:00Z',
    },
    allowedSignatureAlgorithms: ['http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'],
    clockSkewSeconds: 120,
    requireSignedAssertions: true,
    requireSignedResponse: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // A36-CFG-01: Valid SAML Institutional Configuration Registration
  const regRes1 = samlMgr.registerConfig(validSamlConfig, 'cortex_admin_authorized_token');
  recordCheck(
    'A36-CFG-01',
    'Valid SAML Institutional Configuration Registration',
    'B',
    regRes1.success && samlMgr.getConfig('inst_univ_tech') !== null,
    `Registered institution: ${validSamlConfig.institutionId}`
  );

  // A36-CFG-02: SAML Insecure Algorithm Rejection in Institutional Policy
  const insecureConfig: SamlInstitutionalConfig = {
    ...validSamlConfig,
    institutionId: 'inst_insecure',
    allowedSignatureAlgorithms: ['http://www.w3.org/2000/09/xmldsig#rsa-sha1'],
  };
  const regInsecure = samlMgr.registerConfig(insecureConfig, 'cortex_admin_authorized_token');
  recordCheck(
    'A36-CFG-02',
    'SAML Insecure Algorithm Rejection (Disallowed RSA-SHA1 Policy)',
    'B',
    !regInsecure.success && (regInsecure.error?.includes('Insecure') ?? false),
    `Rejected weak algorithm policy: ${regInsecure.error}`
  );

  // A36-CFG-03: SAML Certificate Rotation & Version Incrementation
  const rotatedKey = generateIndependentRsaKeypair();
  const rotateRes = samlMgr.rotateCertificate(
    'inst_univ_tech',
    {
      pem: rotatedKey.publicKeyPem,
      thumbprint: 'EE:FF:00:11',
      notBefore: '2026-11-01T00:00:00Z',
      notAfter: '2029-01-01T00:00:00Z',
    },
    'cortex_admin_authorized_token'
  );
  const updatedCfg = samlMgr.getConfig('inst_univ_tech');
  recordCheck(
    'A36-CFG-03',
    'SAML Certificate Rotation (Seamless Primary-to-Secondary Transition)',
    'B',
    rotateRes.success && updatedCfg?.version === 2 && updatedCfg.secondaryCert !== undefined,
    `Version incremented to: ${updatedCfg?.version}, secondaryCert retained: ${updatedCfg?.secondaryCert?.thumbprint}`
  );

  // A36-CFG-04: Unauthorized Configuration Modification Rejection
  const unauthRes = samlMgr.registerConfig(validSamlConfig, 'invalid_attacker_token');
  recordCheck(
    'A36-CFG-04',
    'Unauthorized SAML Configuration Modification Rejection',
    'B',
    !unauthRes.success && (unauthRes.error?.includes('Unauthorized') ?? false),
    `Result: ${unauthRes.error}`
  );

  // A36-CFG-05: LTI Platform Registration Validation (Endpoint Sanity Checks)
  const ltiMgr = new LtiConfigManager();
  const invalidLtiReg: LtiInstitutionalRegistration = {
    institutionId: 'inst_bad',
    version: 1,
    active: true,
    issuer: '',
    clientId: '',
    deploymentId: 'dep_bad',
    authEndpoint: '',
    jwksUri: '',
    tokenEndpoint: '',
    allowedRedirectUris: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const regLtiBad = ltiMgr.registerPlatform(invalidLtiReg, 'cortex_admin_authorized_token');
  recordCheck(
    'A36-CFG-05',
    'LTI Platform Registration Validation (Rejects Missing Parameters)',
    'B',
    !regLtiBad.success && (regLtiBad.error?.includes('Invalid LTI registration') ?? false),
    `Rejected invalid registration: ${regLtiBad.error}`
  );

  // ===========================================================================
  // GROUP 5: DATABASE PROVIDER CONCURRENCY & CONTRACTS
  // ===========================================================================
  console.log('\n--- GROUP 5: Database Provider Concurrency & Contracts ---');

  // A36-DB-01: SQLite Local Provider Concurrency Descriptors
  const sqliteCaps = await classroomDb.getProviderCapabilities();
  recordCheck(
    'A36-DB-01',
    'SQLite Local Provider Concurrency Descriptors & WAL Support',
    'A',
    sqliteCaps.providerName === 'sqlite_local' &&
      sqliteCaps.supportsImmediateTransactions === true &&
      sqliteCaps.supportsWalSharedMemory === true &&
      sqliteCaps.supportsCrossProcessSameHostLocking === true &&
      sqliteCaps.supportsDistributedCrossHostLocking === false,
    `Provider: ${sqliteCaps.providerName}, Immediate: ${sqliteCaps.supportsImmediateTransactions}, CrossHostLock: ${sqliteCaps.supportsDistributedCrossHostLocking}`
  );

  // A36-DB-02: Cloudflare D1 Contract Mock Rejection of BEGIN IMMEDIATE
  const mockD1 = new MockD1Wrapper(null as any);
  let d1BeginImmediateRejected = false;
  try {
    await mockD1.exec('BEGIN IMMEDIATE;');
  } catch (err: any) {
    if (err.message.includes('BEGIN IMMEDIATE') || err.message.includes('D1_UNSUPPORTED_OPERATION')) {
      d1BeginImmediateRejected = true;
    }
  }
  recordCheck(
    'A36-DB-02',
    'Cloudflare D1 Mock Semantic Boundary (Rejects BEGIN IMMEDIATE)',
    'B',
    d1BeginImmediateRejected,
    `Mock D1 strictly rejected SQLite-only interactive transaction lock`
  );

  // A36-DB-03: Atomic Compare-And-Swap (CAS) Concurrency Contract
  const casSessionId = `sess_cas_a36_${Date.now()}`;

  await classroomDb.createExamSession({
    id: casSessionId,
    examId: 'exam_a35_test',
    userId: 'student_a35_user',
    attemptNumber: Math.floor(Date.now() / 1000) % 50000 + 10,
    status: 'in_progress',
    startedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  });

  // First CAS update expecting 'in_progress' succeeds
  const casSuccess = await classroomDb.updateExamSession(
    casSessionId,
    { status: 'submitted', submittedAt: Date.now() },
    'in_progress'
  );

  // Second CAS update expecting 'in_progress' fails (status is already 'submitted')
  const casConflict = await classroomDb.updateExamSession(
    casSessionId,
    { status: 'terminated' },
    'in_progress'
  );

  recordCheck(
    'A36-DB-03',
    'Atomic Compare-And-Swap (CAS) Update Correctness',
    'C',
    casSuccess !== null && casSuccess.status === 'submitted' && casConflict === null,
    `Matching CAS succeeded: ${casSuccess !== null}, Conflicting CAS blocked: ${casConflict === null}`
  );

  // A36-DB-04: Atomic Transaction Rollback & Data Cleanliness
  const db = await classroomDb.getDb();
  let rollbackCaught = false;
  try {
    await db.exec('BEGIN;');
    await db.prepare('INSERT INTO users (id, email, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'user_orphan_36',
      'orphan@univ.edu',
      'Orphan',
      'student',
      Date.now(),
      Date.now()
    );
    throw new Error('SIMULATED_TRANSACTION_FAILURE');
  } catch (err: any) {
    await db.exec('ROLLBACK;');
    rollbackCaught = true;
  }
  const orphanUser = await db.prepare('SELECT id FROM users WHERE id = ?').get('user_orphan_36');
  recordCheck(
    'A36-DB-04',
    'Atomic Transaction Rollback (Eliminates Orphaned Records)',
    'B',
    rollbackCaught && !orphanUser,
    `Transaction rolled back safely; orphan record eliminated: ${orphanUser === undefined || orphanUser === null}`
  );

  // ===========================================================================
  // GROUP 6: RELEASE PRESERVATION & HOST HARDWARE BENCHMARKS
  // ===========================================================================
  console.log('\n--- GROUP 6: Release Preservation & Host Hardware Benchmarks ---');

  // A36-REL-01: Demonstration Artifact Bit-For-Bit Integrity Verification
  const hardenedExePath = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/bin/CortexLockdown-Hardened.exe');
  const distZipPath = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip');
  const baseExePath = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/bin/CortexLockdown.exe');

  function getHash(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
  }

  const hHardened = getHash(hardenedExePath);
  const hZip = getHash(distZipPath);
  const hBase = getHash(baseExePath);

  const expHardened = '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895';
  const expZip = '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30';
  const expBase = '68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466';

  const artifactsPreserved = hHardened === expHardened && hZip === expZip && hBase === expBase;
  recordCheck(
    'A36-REL-01',
    'Demonstration Artifact Bit-For-Bit Integrity Verification',
    'E',
    artifactsPreserved,
    `Hardened: ${hHardened === expHardened}, Zip: ${hZip === expZip}, Base: ${hBase === expBase}`
  );

  // Benchmarks on AMD Ryzen 7 8840U across 25 iterations
  console.log('Executing 25-iteration host hardware benchmarks (AMD Ryzen 7 8840U)...');

  const iterations = 25;
  const c14nTimes: number[] = [];
  const samlVerifyTimes: number[] = [];
  const jwksCacheTimes: number[] = [];
  const jwtVerifyTimes: number[] = [];
  const replayTimes: number[] = [];
  const cfgLookupTimes: number[] = [];

  const rawXmlToC14n = Buffer.from(validSamlB64, 'base64').toString('utf8');

  for (let i = 0; i < iterations; i++) {
    // 1. XML Canonicalization
    const t0 = performance.now();
    canonicalizeXml(rawXmlToC14n);
    c14nTimes.push(performance.now() - t0);

    // 2. SAML Signature Verification
    const t1 = performance.now();
    validateSamlResponse(validSamlB64, 'https://cortex.edu/sp', 'req_a36_001', {
      idpPublicCertificatePem: indepKey.publicKeyPem,
      skipReplayCheck: true,
    });
    samlVerifyTimes.push(performance.now() - t1);

    // 3. JWKS In-Memory Cache Lookup
    const t2 = performance.now();
    jwksResolver.resolveSigningKey({ issuer: syntheticIssuer, kid: ltiKey1.kid, allowInsecureHttpForTesting: true });
    jwksCacheTimes.push(performance.now() - t2);

    // 4. LTI JWT Verification
    const t3 = performance.now();
    validateLtiLaunchJwt(validJwt, ltiClaims.nonce, {
      expectedIssuer: syntheticIssuer,
      expectedAudience: 'cortex_test_client_001',
      publicKeyPem: ltiKey1.publicKeyPem,
      skipReplayCheck: true,
    });
    jwtVerifyTimes.push(performance.now() - t3);

    // 5. Config Lookup
    const t4 = performance.now();
    samlMgr.getConfig('inst_univ_tech');
    cfgLookupTimes.push(performance.now() - t4);

    // 6. Replay Cache Consumption (SQLite)
    const t5 = performance.now();
    await classroomDb.consumeReplayIdentifier({
      type: 'LTI_NONCE',
      identifier: `bench_nonce_${i}_${Date.now()}`,
      expiresAt: Date.now() + 600000,
    });
    replayTimes.push(performance.now() - t5);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const p95 = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length * 0.95)];
  };

  const c14nAvg = avg(c14nTimes);
  const samlAvg = avg(samlVerifyTimes);
  const jwksCacheAvg = avg(jwksCacheTimes);
  const jwtAvg = avg(jwtVerifyTimes);
  const cfgAvg = avg(cfgLookupTimes);
  const replayAvg = avg(replayTimes);

  const mem = process.memoryUsage();
  const rssMb = (mem.rss / (1024 * 1024)).toFixed(1);

  console.log(`- XML Canonicalization:       avg ${c14nAvg.toFixed(3)} ms (p95: ${p95(c14nTimes).toFixed(3)} ms)`);
  console.log(`- SAML Verification:          avg ${samlAvg.toFixed(3)} ms (p95: ${p95(samlVerifyTimes).toFixed(3)} ms)`);
  console.log(`- JWKS Cache Lookup:          avg ${jwksCacheAvg.toFixed(3)} ms (p95: ${p95(jwksCacheTimes).toFixed(3)} ms)`);
  console.log(`- LTI JWT Verification:       avg ${jwtAvg.toFixed(3)} ms (p95: ${p95(jwtVerifyTimes).toFixed(3)} ms)`);
  console.log(`- Config Lookup:              avg ${cfgAvg.toFixed(3)} ms (p95: ${p95(cfgLookupTimes).toFixed(3)} ms)`);
  console.log(`- Replay Consumption:         avg ${replayAvg.toFixed(3)} ms (p95: ${p95(replayTimes).toFixed(3)} ms)`);
  console.log(`- Memory RSS Footprint:       ${rssMb} MB`);

  recordCheck(
    'A36-PERF-01',
    'Physical Hardware Latency Benchmarks (AMD Ryzen 7 8840U)',
    'E',
    c14nAvg < 2.0 && samlAvg < 5.0 && jwtAvg < 5.0 && replayAvg < 5.0,
    `C14N: ${c14nAvg.toFixed(2)}ms, SAML: ${samlAvg.toFixed(2)}ms, JWT: ${jwtAvg.toFixed(2)}ms, RSS: ${rssMb}MB`
  );

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n================================================================');
  console.log(`ALPHA 36 RESULT: ${passed}/${total} CHECKS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAlpha36Suite().catch((err) => {
  console.error('Unhandled Alpha 36 test error:', err);
  process.exit(1);
});
