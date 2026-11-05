import { classroomDb } from '@/lib/classroom/db';
// Cortex Lockdown — Server-Authoritative Security Policy & Cryptographic Grants
// Implements HMAC-SHA256 signed policy tokens, launch grants, and device attestation.
// Strictly zero emojis.

import crypto from 'crypto';

export interface LockdownSecurityPolicy {
  requireCamera: boolean;
  requireMicrophone: boolean;
  recordVideo: boolean;
  recordAudio: boolean;
  continuousMonitoring: boolean;
  facePresenceDetection: boolean;
  multiFaceDetection: boolean;
  audioAnomalyDetection: boolean;
  blockClipboard: boolean;
  blockAppSwitching: boolean;
  blockScreenCapture: boolean;
  allowSingleDisplayOnly: boolean;
  prohibitedProcesses: string[];
}

export const DEFAULT_LOCKDOWN_POLICY: LockdownSecurityPolicy = {
  requireCamera: true,
  requireMicrophone: true,
  recordVideo: true,
  recordAudio: true,
  continuousMonitoring: true,
  facePresenceDetection: true,
  multiFaceDetection: true,
  audioAnomalyDetection: true,
  blockClipboard: true,
  blockAppSwitching: true,
  blockScreenCapture: true,
  allowSingleDisplayOnly: true,
  prohibitedProcesses: [
    'obs64', 'obs32', 'obs', 'discord', 'teamviewer', 'anydesk',
    'chrome', 'firefox', 'msedge', 'brave', 'opera',
    'telegram', 'whatsapp', 'slack', 'skype', 'teams', 'zoom',
    'wireshark', 'fiddler', 'cheatengine', 'x64dbg'
  ]
};

const LOCKDOWN_SECRET = process.env.LOCKDOWN_POLICY_SECRET || 'cortex_lockdown_security_key_2026_prod_hmac';

/**
 * Computes a SHA-256 hash of a security policy to detect any tampering.
 */

/**
 * Server-only cryptographic pepper for recovery authorization HMAC-SHA256 generation.
 * Stored exclusively in the backend secret-management environment.
 * NEVER exposed to client, logs, persistent databases, or source maps.
 * Fails closed if missing in non-test production environments.
 */
export function getServerPepper(): string {
  const pepper = process.env.LOCKDOWN_SERVER_PEPPER || process.env.LOCKDOWN_POLICY_SECRET;
  if (!pepper || pepper.trim().length === 0) {
    if (process.env.NODE_ENV === 'production' || process.env.LOCKDOWN_FAIL_CLOSED_TEST === 'true' || process.env.LOCKDOWN_SERVER_PEPPER === '') {
      throw new Error('CRITICAL: Server cryptographic pepper is not configured. Recovery authorization failed closed.');
    }
    return 'cortex_srv_pepper_2026_sec_h99f2a7b';
  }
  return pepper.trim();
}

/**
 * Calculates a hardened HMAC-SHA256 digest of an emergency recovery OTP using a server-only pepper
 * and a canonical message representation binding salt, challenge, authorization ID, and OTP.
 * Construction: HMAC-SHA256(SERVER_PEPPER, canonicalMessage)
 * canonicalMessage: salt:CHALLENGE:authId:otp
 */
export function computeRecoveryOtpHash(params: {
  salt: string;
  challenge: string;
  authorizationId: string;
  otp: string;
}): string {
  const pepper = getServerPepper();
  const canonical = `${params.salt.trim()}:${params.challenge.trim().toUpperCase()}:${params.authorizationId.trim()}:${params.otp.trim()}`;
  return crypto.createHmac('sha256', pepper).update(canonical).digest('hex');
}

/**
 * Computes deterministic canonical SHA-256 digest of candidate answers.
 * Recursively sorts all keys at every object depth to guarantee determinism
 * regardless of key insertion order or formatting differences.
 */
export function canonicalAnswerDigest(answers: Record<string, any>): string {
  function sortValue(val: any): any {
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(sortValue);
    const sorted: Record<string, any> = {};
    for (const key of Object.keys(val).sort()) {
      sorted[key] = sortValue(val[key]);
    }
    return sorted;
  }
  const canonicalJson = JSON.stringify(sortValue(answers || {}));
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

/**
 * Generates a server-authoritative submission receipt bound to the server pepper,
 * candidate identity, exam ID, session ID, submission timestamp, and canonical answer digest.
 * Format: CORTEX-SUB-[16-HEX]
 *
 * Security Note:
 * This HMAC-SHA256 receipt provides cryptographic data integrity and server origin
 * authentication using the high-entropy backend server pepper. Because HMAC relies on a
 * symmetric server secret, it authenticates the server's authoritative confirmation but
 * is not an asymmetric digital signature providing legal non-repudiation against the server itself.
 */
export function generateSubmissionReceipt(params: {
  examId: string;
  studentId: string;
  sessionId: string;
  submittedAt: number;
  answerDigest: string;
}): string {
  const pepper = getServerPepper();
  const canonical = `${params.examId.trim()}:${params.studentId.trim()}:${params.sessionId.trim()}:${params.submittedAt}:${params.answerDigest.trim()}`;
  const receiptHmac = crypto
    .createHmac('sha256', pepper)
    .update(canonical)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
  return `CORTEX-SUB-${receiptHmac}`;
}

/**
 * Independently verifies that a submission receipt matches the server pepper,
 * candidate identity, exam ID, session ID, timestamp, and answer digest.
 * Utilizes constant-time string comparison to prevent timing side-channels.
 */
export function verifySubmissionReceipt(params: {
  receipt: string;
  examId: string;
  studentId: string;
  sessionId: string;
  submittedAt: number;
  answerDigest: string;
}): boolean {
  if (!params.receipt || typeof params.receipt !== 'string' || !params.receipt.startsWith('CORTEX-SUB-')) {
    return false;
  }
  const expected = generateSubmissionReceipt(params);
  try {
    return crypto.timingSafeEqual(Buffer.from(params.receipt, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch (_) {
    return false;
  }
}

export function hashPolicy(policy: LockdownSecurityPolicy): string {
  const normalized = JSON.stringify(policy, Object.keys(policy).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex').toLowerCase();
}

/**
 * Signs a launch authorization grant token.
 */
export function signLaunchGrant(payload: {
  sub: string;
  examId: string;
  classroomId: string;
  deviceId: string;
  hardwareFingerprint: string;
  policyHash: string;
  ttlSeconds?: number;
}): string {
  const ttl = payload.ttlSeconds || 120; // 120 seconds default validity
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttl,
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', LOCKDOWN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

// In-memory revocation registries for launch grants, user sessions, and credentials
const _revokedTokensRegistry = new Map<string, { revokedAt: number; reason: string }>();
const _consumedLaunchGrants = new Set<string>();
const _revokedSessionsRegistry = new Map<string, { revokedAt: number; reason: string }>();

export function revokeToken(identifier: string, reason: string = 'Administrative revocation'): void {
  _revokedTokensRegistry.set(identifier, { revokedAt: Date.now(), reason });
}

export function isTokenRevoked(identifier: string): boolean {
  return _revokedTokensRegistry.has(identifier);
}

export function markLaunchGrantConsumed(nonce: string): void {
  _consumedLaunchGrants.add(nonce);
}

export function isLaunchGrantConsumed(nonce: string): boolean {
  return _consumedLaunchGrants.has(nonce);
}

export function revokeSession(sessionId: string, reason: string = 'Session explicitly terminated or revoked'): void {
  _revokedSessionsRegistry.set(sessionId, { revokedAt: Date.now(), reason });
  try {
    classroomDb.revokeSession({ sessionId, reason }).catch(() => {});
  } catch (_) {}
}

export async function revokeSessionAsync(
  sessionId: string,
  reason: string = 'Session explicitly terminated or revoked',
  examId?: string,
  userId?: string
): Promise<void> {
  _revokedSessionsRegistry.set(sessionId, { revokedAt: Date.now(), reason });
  await classroomDb.revokeSession({ sessionId, reason, examId, userId });
}

export function isSessionRevoked(sessionId: string): boolean {
  return _revokedSessionsRegistry.has(sessionId);
}

export async function isSessionRevokedAsync(sessionId: string): Promise<boolean> {
  if (_revokedSessionsRegistry.has(sessionId)) return true;
  const inDb = await classroomDb.isSessionRevoked(sessionId);
  if (inDb) {
    _revokedSessionsRegistry.set(sessionId, { revokedAt: Date.now(), reason: 'Revoked in persistent database' });
    return true;
  }
  return false;
}

export function resetSecurityRegistries(): void {
  _revokedTokensRegistry.clear();
  _consumedLaunchGrants.clear();
  _revokedSessionsRegistry.clear();
}

/**
 * Verifies a launch grant token with constant-time HMAC comparison, expiration,
 * revocation check, and optional single-use enforcement.
 */
export function verifyLaunchGrant(
  token: string,
  options?: { enforceSingleUse?: boolean }
): {
  valid: boolean;
  claims?: any;
  error?: string;
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Malformed token structure' };

    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', LOCKDOWN_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Invalid cryptographic signature' };
    }

    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);

    if (claims.exp && claims.exp < nowSec) {
      return { valid: false, error: 'Token has expired' };
    }

    if (claims.nonce && isTokenRevoked(claims.nonce)) {
      return { valid: false, error: 'Token has been revoked' };
    }

    if (claims.sub && isTokenRevoked(claims.sub)) {
      return { valid: false, error: 'User session has been revoked' };
    }

    if (options?.enforceSingleUse && claims.nonce) {
      if (isLaunchGrantConsumed(claims.nonce)) {
        return { valid: false, error: 'Launch grant has already been consumed (replay rejected)' };
      }
      markLaunchGrantConsumed(claims.nonce);
    }

    return { valid: true, claims };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Verification exception' };
  }
}

/**
 * Creates a unique device trust token.
 */
export function signDeviceTrustToken(deviceId: string, userId: string, fingerprint: string): string {
  const payload = {
    sub: userId,
    deviceId,
    fingerprint,
    iat: Date.now(),
    iss: 'cortex-lockdown-attestation'
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', LOCKDOWN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * Generates an auditable, challenge-specific proctor emergency exit OTP.
 * Eliminates static client-side passwords.
 */
export function generateEmergencyExitCode(examId: string, challenge: string): string {
  const normExam = (examId || 'general').trim().toLowerCase();
  const normChal = (challenge || '0000').trim().toUpperCase();
  const hmac = crypto
    .createHmac('sha256', LOCKDOWN_SECRET)
    .update(`EMERGENCY_EXIT:${normExam}:${normChal}`)
    .digest('hex');
  const codeNum = (parseInt(hmac.substring(0, 8), 16) % 900000) + 100000;
  return codeNum.toString();
}

/**
 * Validates a proctor emergency exit code against a given exam and challenge.
 */
export function verifyEmergencyExitCode(examId: string, challenge: string, inputCode: string): boolean {
  if (!inputCode || inputCode.trim().length !== 6) return false;
  const expected = generateEmergencyExitCode(examId, challenge);
  return inputCode.trim() === expected;
}

/**
 * Server-Authoritative Emergency Recovery Authorization Model (Alpha 8)
 *
 * Enforces:
 * - Single-use token redemption (burn-on-use to prevent replay).
 * - Cryptographic expiration (short-lived TTL).
 * - Multidimensional binding to examId, candidateId, deviceId, and sessionId.
 * - Rate limiting on both proctor issuance and candidate redemption attempts.
 * - Zero secrets or HMAC keys embedded in the client binary.
 */
export interface EmergencyRecoveryAuthorization {
  id: string;
  examId: string;
  candidateId: string;
  deviceId?: string;
  sessionId?: string;
  challenge: string;
  code?: string; // Only returned on issuance, never persisted in storage
  codeHash: string; // Protected HMAC-SHA256 representation
  codeSalt: string; // Random 16-byte cryptographic salt
  reason: string;
  issuedBy: string;
  issuedAt: number;
  expiresAt: number;
  used: boolean;
  redeemedAt?: number;
  attempts: number;
  maxAttempts: number;
}

// In-memory store for issued emergency recovery authorizations
const recoveryAuthorizations: Map<string, EmergencyRecoveryAuthorization> = new Map();

// Rate limiting trackers (timestamps in ms)
const proctorIssuanceLog: Map<string, number[]> = new Map();
const candidateRedemptionLog: Map<string, number[]> = new Map();

export function resetEmergencyRecoveryAuthorizations(): void {
  recoveryAuthorizations.clear();
  proctorIssuanceLog.clear();
  candidateRedemptionLog.clear();
}

export function getEmergencyRecoveryKey(examId: string, challenge: string): string {
  const normExam = (examId || 'general').trim().toLowerCase();
  const normChal = (challenge || '0000').trim().toUpperCase();
  return `${normExam}:${normChal}`;
}

/**
 * Issues a short-lived, single-use emergency recovery authorization.
 */
export function issueEmergencyRecoveryAuthorization(params: {
  examId: string;
  candidateId: string;
  challenge: string;
  deviceId?: string;
  sessionId?: string;
  reason: string;
  issuedBy: string;
  ttlSeconds?: number;
}): { success: boolean; authorization?: EmergencyRecoveryAuthorization; error?: string } {
  const now = Date.now();
  const issuedBy = params.issuedBy || 'unknown_proctor';

  // Proctor rate-limiting: max 10 code generations per 10 minutes per proctor
  const proctorHistory = (proctorIssuanceLog.get(issuedBy) || []).filter(t => now - t < 10 * 60 * 1000);
  if (proctorHistory.length >= 10) {
    return { success: false, error: 'Rate limit exceeded: Maximum 10 emergency recovery codes per 10 minutes' };
  }
  proctorHistory.push(now);
  proctorIssuanceLog.set(issuedBy, proctorHistory);

  const ttl = typeof params.ttlSeconds === 'number' ? params.ttlSeconds : 180; // 3 minutes default
  const key = getEmergencyRecoveryKey(params.examId, params.challenge);

  // Generate high-entropy 6-digit numeric OTP
  const randomBytes = crypto.randomBytes(4);
  const codeNum = (randomBytes.readUInt32BE(0) % 900000) + 100000;
  const code = codeNum.toString();

  // Cryptographic salt and peppered HMAC-SHA256: plaintext OTP is NEVER stored in persistent storage
  const authId = `recov_${now}_${crypto.randomBytes(4).toString('hex')}`;
  const codeSalt = crypto.randomBytes(16).toString('hex');
  const codeHash = computeRecoveryOtpHash({
    salt: codeSalt,
    challenge: params.challenge,
    authorizationId: authId,
    otp: code,
  });

  const authRecord: EmergencyRecoveryAuthorization = {
    id: authId,
    examId: (params.examId || 'general').trim().toLowerCase(),
    candidateId: params.candidateId.trim(),
    deviceId: params.deviceId ? params.deviceId.trim() : undefined,
    sessionId: params.sessionId ? params.sessionId.trim() : undefined,
    challenge: params.challenge.trim().toUpperCase(),
    code, // Return to proctor only
    codeHash,
    codeSalt,
    reason: params.reason ? params.reason.trim() : 'Emergency proctor intervention',
    issuedBy,
    issuedAt: now,
    expiresAt: now + ttl * 1000,
    used: false,
    attempts: 0,
    maxAttempts: 3,
  };

  // Memory store holds sanitized record WITHOUT plaintext code
  const sanitizedRecord: EmergencyRecoveryAuthorization = {
    ...authRecord,
    code: undefined,
  };
  recoveryAuthorizations.set(key, sanitizedRecord);

  // Durable database persistence
  try {
    classroomDb.createLockdownEmergencyAuthorization({
      id: authRecord.id,
      challenge: authRecord.challenge,
      examId: authRecord.examId,
      candidateId: authRecord.candidateId,
      deviceId: authRecord.deviceId,
      sessionId: authRecord.sessionId,
      codeHash: authRecord.codeHash,
      codeSalt: authRecord.codeSalt,
      issuedBy: authRecord.issuedBy,
      issuedAt: authRecord.issuedAt,
      expiresAt: authRecord.expiresAt,
      reason: authRecord.reason,
    }).catch(() => {});
  } catch (e) {}

  return { success: true, authorization: authRecord };
}

/**
 * Redeems an emergency recovery authorization.
 * Burns the authorization on first valid use to prevent replay attacks.
 */
export function redeemEmergencyRecoveryAuthorization(params: {
  examId: string;
  challenge: string;
  code: string;
  candidateId?: string;
  deviceId?: string;
  sessionId?: string;
}): {
  authorized: boolean;
  reason?: string;
  authorization?: EmergencyRecoveryAuthorization;
} {
  const now = Date.now();
  const key = getEmergencyRecoveryKey(params.examId, params.challenge);

  // Redemption rate limiting: max 5 redemption attempts per minute for a challenge
  const attemptHistory = (candidateRedemptionLog.get(key) || []).filter(t => now - t < 60 * 1000);
  if (attemptHistory.length >= 5) {
    return { authorized: false, reason: 'Redemption rate limit exceeded: Please wait 60 seconds before retrying' };
  }
  attemptHistory.push(now);
  candidateRedemptionLog.set(key, attemptHistory);

  const record = recoveryAuthorizations.get(key);
  if (!record) {
    return { authorized: false, reason: 'No active recovery authorization found for this examination challenge' };
  }

  // 1. Replay prevention check
  if (record.used) {
    return { authorized: false, reason: 'Recovery authorization has already been redeemed (replay rejected)' };
  }

  // 2. Expiration check
  if (now > record.expiresAt) {
    return { authorized: false, reason: 'Recovery authorization code has expired' };
  }

  // 3. Max failed attempts check
  if (record.attempts >= record.maxAttempts) {
    record.used = true; // Invalidate permanently
    return { authorized: false, reason: 'Maximum redemption attempts exceeded. Authorization invalidated.' };
  }

  // 4. Candidate binding check (if supplied)
  if (params.candidateId && record.candidateId && record.candidateId !== params.candidateId.trim()) {
    return { authorized: false, reason: 'Candidate identity mismatch for this authorization' };
  }

  // 5. Device binding check (if supplied)
  if (params.deviceId && record.deviceId && record.deviceId !== params.deviceId.trim()) {
    return { authorized: false, reason: 'Device hardware identifier mismatch for this authorization' };
  }

  // 6. Session binding check (if supplied)
  if (params.sessionId && record.sessionId && record.sessionId !== params.sessionId.trim()) {
    return { authorized: false, reason: 'Examination session mismatch for this authorization' };
  }

  // 7. Verify OTP code using server pepper and constant-time timingSafeEqual on canonical hash
  const cleanCode = (params.code || '').trim();
  const expectedHash = computeRecoveryOtpHash({
    salt: record.codeSalt,
    challenge: record.challenge,
    authorizationId: record.id,
    otp: cleanCode,
  });

  let hashesMatch = false;
  try {
    hashesMatch = crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(record.codeHash, 'hex')
    );
  } catch (e) {
    hashesMatch = false;
  }

  if (!hashesMatch) {
    record.attempts++;
    try {
      classroomDb.atomicIncrementLockdownFailedAttempts(params.challenge, now).catch(() => {});
    } catch (e) {}

    if (record.attempts >= record.maxAttempts) {
      record.used = true; // Burn on failure limit
      return { authorized: false, reason: 'Invalid authorization code. Maximum attempts reached. Authorization burned.' };
    }
    const remaining = record.maxAttempts - record.attempts;
    return { authorized: false, reason: `Invalid authorization code. ${remaining} attempt(s) remaining.` };
  }

  // 8. Successful redemption: BURN ON USE
  record.used = true;
  record.redeemedAt = now;

  try {
    classroomDb.atomicRedeemLockdownEmergencyAuthorization({
      challenge: params.challenge,
      examId: params.examId,
      candidateId: record.candidateId,
      now,
    }).catch(() => {});
  } catch (e) {}

  return {
    authorized: true,
    authorization: record,
  };
}

/**
 * Asynchronous, durable, database-backed atomic emergency recovery redemption (Alpha 9).
 * Enforces exactly one winner via atomic conditional SQL update:
 * WHERE used = 0 AND expires_at > now AND failed_attempts < max_attempts
 * If two simultaneous requests race, exactly one succeeds (changes === 1); the other fails (changes === 0).
 */
export async function atomicRedeemEmergencyRecoveryAuthorizationAsync(params: {
  examId: string;
  challenge: string;
  code: string;
  candidateId?: string;
  deviceId?: string;
  sessionId?: string;
}): Promise<{
  authorized: boolean;
  reason?: string;
  authorization?: any;
}> {
  const now = Date.now();
  const normChal = (params.challenge || '').trim().toUpperCase();
  const normExam = (params.examId || 'general').trim().toLowerCase();

  // 1. Distributed rate limiting check on challenge
  const candKey = `rate:challenge:${normExam}:${normChal}`;
  const rateCheck = await classroomDb.checkDistributedRateLimit({
    key: candKey,
    limit: 5,
    windowSeconds: 60,
    now,
  });

  if (!rateCheck.allowed) {
    return {
      authorized: false,
      reason: `Redemption rate limit exceeded: Please wait ${rateCheck.resetInSeconds} seconds before retrying`,
    };
  }

  // 2. Fetch record from durable database
  const record = await classroomDb.getLockdownEmergencyAuthorization(normChal);
  if (!record) {
    return {
      authorized: false,
      reason: 'No active recovery authorization found for this examination challenge',
    };
  }

  // 3. Replay prevention check
  if (record.used === 1) {
    return {
      authorized: false,
      reason: 'Recovery authorization has already been redeemed (replay rejected)',
    };
  }

  // 4. Expiration check
  if (now > record.expires_at) {
    return {
      authorized: false,
      reason: 'Recovery authorization code has expired',
    };
  }

  // 5. Failed attempts limit check
  if (record.failed_attempts >= record.max_attempts) {
    return {
      authorized: false,
      reason: 'Maximum redemption attempts exceeded. Authorization invalidated.',
    };
  }

  // 6. Multidimensional identity & scope bindings
  if (params.candidateId && record.candidate_id && record.candidate_id !== params.candidateId.trim()) {
    return {
      authorized: false,
      reason: 'Candidate identity mismatch for this authorization',
    };
  }

  if (params.deviceId && record.device_id && record.device_id !== params.deviceId.trim()) {
    return {
      authorized: false,
      reason: 'Device hardware identifier mismatch for this authorization',
    };
  }

  if (params.sessionId && record.session_id && record.session_id !== params.sessionId.trim()) {
    return {
      authorized: false,
      reason: 'Examination session mismatch for this authorization',
    };
  }

  // 7. Constant-time timingSafeEqual hash comparison using server-only pepper
  const cleanCode = (params.code || '').trim();
  const expectedHash = computeRecoveryOtpHash({
    salt: record.code_salt,
    challenge: record.challenge,
    authorizationId: record.id,
    otp: cleanCode,
  });

  let hashesMatch = false;
  try {
    hashesMatch = crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(record.code_hash, 'hex')
    );
  } catch (e) {
    hashesMatch = false;
  }

  if (!hashesMatch) {
    const incRes = await classroomDb.atomicIncrementLockdownFailedAttempts(normChal, now);
    if (incRes.burned) {
      return {
        authorized: false,
        reason: 'Invalid authorization code. Maximum attempts reached. Authorization burned.',
      };
    }
    const remaining = record.max_attempts - incRes.failedAttempts;
    return {
      authorized: false,
      reason: `Invalid authorization code. ${remaining} attempt(s) remaining.`,
    };
  }

  // 8. ATOMIC CONDITIONAL SQL UPDATE (Single Winner Guarantee)
  const redeemResult = await classroomDb.atomicRedeemLockdownEmergencyAuthorization({
    challenge: normChal,
    examId: normExam,
    candidateId: record.candidate_id,
    now,
  });

  if (!redeemResult.success) {
    // Another concurrent request beat this one to the atomic update!
    return {
      authorized: false,
      reason: 'Recovery authorization has already been redeemed (replay rejected)',
    };
  }

  // Update in-memory record too for sync consistency
  const inMemoryKey = getEmergencyRecoveryKey(normExam, normChal);
  const memRecord = recoveryAuthorizations.get(inMemoryKey);
  if (memRecord) {
    memRecord.used = true;
    memRecord.redeemedAt = now;
  }

  return {
    authorized: true,
    authorization: {
      id: record.id,
      examId: record.exam_id,
      candidateId: record.candidate_id,
      deviceId: record.device_id,
      sessionId: record.session_id,
      challenge: record.challenge,
      issuedBy: record.issued_by,
      issuedAt: record.issued_at,
      expiresAt: record.expires_at,
      used: true,
      redeemedAt: now,
      reason: record.reason,
    },
  };
}
