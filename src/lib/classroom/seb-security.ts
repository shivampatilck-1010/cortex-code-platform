// Cortex Online Examination System — Safe Exam Browser Cryptographic Verification & Secret Security
// Implements the official Safe Exam Browser (SEB) verification specification:
// X-SafeExamBrowser-RequestHash = SHA256(RequestURL + BrowserExamKey)
// X-SafeExamBrowser-ConfigKeyHash = SHA256(RequestURL + ConfigKey)

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import type { AssessmentBrandingTheme } from './models';

export interface SebVerificationResult {
  verified: boolean;
  matchType?: 'bek' | 'ck';
  reason?: string;
}

export interface SebVerificationOptions {
  clientConfigKey?: string;
  clientBrowserExamKey?: string;
  authoritative?: boolean;
}

export interface SebVerifiableAssessment {
  id: string;
  classroomId?: string;
  title?: string;
  securityLevel?: string;
  sebConfigKey?: string | null;
  sebBrowserExamKey?: string | null;
  sebQuitPassword?: string | null;
  sebQuitPasswordHash?: string | null;
  sebAllowReload?: boolean;
  sebShowReloadWarning?: boolean;
  durationMinutes?: number;
  brandingTheme?: AssessmentBrandingTheme;
}

export interface SebUrlFilterRule {
  active: boolean;
  regex: boolean;
  rule: string;
  action: 1 | 0; // 1 = allow, 0 = block
}

export interface GenerateSebConfigOptions {
  startUrl: string;
  quitUrl?: string;
  quitPasswordHash?: string | null;
  sebQuitPassword?: string | null;
  browserExamKey?: string | null;
  allowReload?: boolean;
  showReloadWarning?: boolean;
  allowPreferencesWindow?: boolean;
  urlFilterRules?: SebUrlFilterRule[];
  brandingTheme?: AssessmentBrandingTheme;
}

export interface SebLaunchTokenPayload {
  userId: string;
  assessmentId: string;
  assessmentType: 'exam' | 'assignment';
  classroomId: string;
  durationMinutes?: number;
}

export interface SebLaunchTokenClaims extends SebLaunchTokenPayload {
  jti: string; // nonce (32-character hex)
  iat: number; // Issued at (Unix timestamp in seconds)
  exp: number; // Expires at (Unix timestamp in seconds)
}

/**
 * Secret resolution for lockdown security and authoritative derivations.
 */
export function getLockdownSecret(): string {
  return (
    process.env.LOCKDOWN_POLICY_SECRET ||
    process.env.LOCKDOWN_SERVER_PEPPER ||
    process.env.SEB_LAUNCH_TOKEN_SECRET ||
    'cortex-default-lockdown-secret-seed-dev-only'
  );
}

/**
 * Secret resolution for SEB launch tokens.
 */
export function getSebLaunchTokenSecret(): string {
  return (
    process.env.SEB_LAUNCH_TOKEN_SECRET ||
    process.env.LOCKDOWN_POLICY_SECRET ||
    'cortex-default-seb-launch-token-secret-dev-only'
  );
}

/**
 * Computes the SHA-256 hash of a quit password for secure storage and SEB plist export.
 */
export function hashQuitPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex').toLowerCase();
}

/**
 * Computes an SEB-compatible SHA-256 hash for a given URL and key.
 */
export function computeSafeExamBrowserHash(url: string, key: string): string {
  return crypto.createHash('sha256').update(url + key).digest('hex').toLowerCase();
}

/**
 * Derives an authoritative Browser Exam Key using HMAC-SHA256 bound to assessment and classroom.
 */
export function deriveAuthoritativeBrowserExamKey(assessmentId: string, classroomId: string): string {
  const secret = getLockdownSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`cortex_authoritative_bek:${assessmentId}:${classroomId}`)
    .digest('hex')
    .toLowerCase();
}

/**
 * Derives or retrieves the expected Browser Exam Key for an assessment.
 * Maintains backward compatibility with legacy deterministic derivation as default.
 */
export function getExpectedBrowserExamKey(
  assessment: SebVerifiableAssessment,
  options?: { authoritative?: boolean }
): string {
  if (assessment.sebBrowserExamKey) {
    return assessment.sebBrowserExamKey;
  }
  if (options?.authoritative) {
    return deriveAuthoritativeBrowserExamKey(assessment.id, assessment.classroomId || 'default');
  }
  // Legacy deterministic fallback for backward compatibility
  return crypto
    .createHash('sha256')
    .update(`${assessment.id}_${assessment.classroomId || 'default'}_cortex_seb`)
    .digest('hex')
    .toLowerCase();
}

/**
 * Validates whether a forwarded host header is trusted and safe.
 * Rejects untrusted external hosts, path injections, or malformed hostnames.
 */
function isTrustedHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  const trimmed = host.trim();
  // Valid host format with optional port
  if (!/^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/.test(trimmed)) return false;
  const hostname = trimmed.split(':')[0].toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.workers.dev') ||
    hostname.endsWith('.cortex.dev')
  ) {
    return true;
  }
  const envTrusted = (process.env.SEB_TRUSTED_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return envTrusted.some((trusted) => hostname === trusted || hostname.endsWith(`.${trusted}`));
}

/**
 * Generates candidate canonical request URLs that may have been hashed by the client.
 * Handles protocol variations, trusted reverse-proxy headers, port normalization, and trailing slashes.
 * Untrusted forwarding headers are strictly ignored to prevent canonical URL poisoning.
 */
export function generateCandidateUrls(req: NextRequest): string[] {
  const candidates = new Set<string>();

  const pathname = req.nextUrl?.pathname || '/';
  const search = req.nextUrl?.search || '';

  // 1. Direct nextUrl href
  if (req.nextUrl?.href) {
    candidates.add(req.nextUrl.href);
  }

  // 2. Direct req.url
  if (req.url) {
    candidates.add(req.url);
  }

  // 3. Origin from nextUrl
  if (req.nextUrl?.origin) {
    candidates.add(`${req.nextUrl.origin}${pathname}${search}`);
  }

  // 4. Resolve host safely: only accept x-forwarded-host and direct host if trusted
  const rawFwdHost = req.headers.get('x-forwarded-host');
  const directHost = req.headers.get('host') || 'localhost:3000';
  let host = 'localhost:3000';
  if (rawFwdHost && isTrustedHost(rawFwdHost)) {
    host = rawFwdHost.trim();
  } else if (isTrustedHost(directHost)) {
    host = directHost.trim();
  } else if (req.nextUrl?.host && isTrustedHost(req.nextUrl.host)) {
    host = req.nextUrl.host;
  }

  // Resolve proto safely: strictly limit to http and https
  const rawProto = (req.headers.get('x-forwarded-proto') || '').toLowerCase().trim();
  const proto = rawProto === 'https' ? 'https' : 'http';

  candidates.add(`${proto}://${host}${pathname}${search}`);
  candidates.add(`http://${host}${pathname}${search}`);
  candidates.add(`https://${host}${pathname}${search}`);

  // Generate variants with port normalization and trailing slash variations
  // Enforce that only URLs with trusted hosts are included in candidate list
  const expanded = new Set<string>();
  for (const u of candidates) {
    try {
      const parsed = new URL(u);
      if (!isTrustedHost(parsed.host)) continue;

      expanded.add(parsed.toString());

      // SEB Specification: standard ports 80 (http) and 443 (https) are stripped
      if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
        parsed.port = '';
        expanded.add(parsed.toString());
      }

      if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
        parsed.pathname = parsed.pathname.slice(0, -1);
        expanded.add(parsed.toString());
      } else if (!parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname + '/';
        expanded.add(parsed.toString());
      }
    } catch (_) {}
  }

  return Array.from(expanded);
}

/**
 * Timing-safe string comparison.
 * When caseSensitive is false (default), strings are normalized to lowercase (suitable for hex digests).
 * When caseSensitive is true, strings are compared with exact case sensitivity (suitable for Base64/Base64URL tokens).
 */
export function safeTimingEqual(a: string, b: string, caseSensitive: boolean = false): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const valA = caseSensitive ? a : a.toLowerCase();
  const valB = caseSensitive ? b : b.toLowerCase();
  const bufA = Buffer.from(valA);
  const bufB = Buffer.from(valB);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates whether an incoming HTTP request is authenticated by Safe Exam Browser
 * according to the official Safe Exam Browser protocol.
 * Synchronous execution contract.
 */
export function verifySafeExamBrowserRequest(
  req: NextRequest,
  assessment: SebVerifiableAssessment,
  options?: SebVerificationOptions
): SebVerificationResult {
  const isSebRequired = assessment.securityLevel === 'seb' || (assessment.securityLevel as string) === 'seb_required';

  // If assessment does not mandate SEB, standard browsers are permitted
  if (!isSebRequired) {
    return { verified: true };
  }

  // Extract official SEB verification headers and fallback headers
  const reqHashHeader =
    req.headers.get('x-safeexambrowser-requesthash') ||
    req.headers.get('x-seb-request-hash');
  const ckHashHeader =
    req.headers.get('x-safeexambrowser-configkeyhash') ||
    req.headers.get('x-safeexambrowser-configkey') ||
    req.headers.get('x-seb-config-key-hash');

  const clientBek = options?.clientBrowserExamKey;
  const clientCk = options?.clientConfigKey;

  if (!reqHashHeader && !ckHashHeader && !clientBek && !clientCk) {
    return {
      verified: false,
      reason: 'Missing Safe Exam Browser cryptographic verification headers (X-SafeExamBrowser-RequestHash / X-SafeExamBrowser-ConfigKeyHash)',
    };
  }

  const expectedBek = getExpectedBrowserExamKey(assessment, { authoritative: options?.authoritative });
  const expectedCk = assessment.sebConfigKey ? String(assessment.sebConfigKey).trim() : null;

  const candidateUrls = generateCandidateUrls(req);

  // 1. Verify Browser Exam Key (BEK) Request Hash from HTTP header
  if (reqHashHeader && /^[a-f0-9]{64}$/i.test(reqHashHeader.trim())) {
    const clientHash = reqHashHeader.trim().toLowerCase();
    for (const url of candidateUrls) {
      const expectedHash = computeSafeExamBrowserHash(url, expectedBek);
      if (safeTimingEqual(clientHash, expectedHash)) {
        return { verified: true, matchType: 'bek' };
      }
    }
  }

  // 2. Verify Config Key (CK) Hash from HTTP header
  if (ckHashHeader && expectedCk && /^[a-f0-9]{64}$/i.test(ckHashHeader.trim())) {
    const clientHash = ckHashHeader.trim().toLowerCase();
    for (const url of candidateUrls) {
      const expectedHash = computeSafeExamBrowserHash(url, expectedCk);
      if (safeTimingEqual(clientHash, expectedHash)) {
        return { verified: true, matchType: 'ck' };
      }
    }
  }

  // 3. Verify BEK via client options (direct API key evaluation)
  if (clientBek && /^[a-f0-9]{64}$/i.test(clientBek.trim())) {
    if (safeTimingEqual(clientBek.trim().toLowerCase(), expectedBek)) {
      return { verified: true, matchType: 'bek' };
    }
  }

  // 4. Verify CK via client options (direct API key evaluation)
  if (clientCk && expectedCk && /^[a-f0-9]{64}$/i.test(clientCk.trim())) {
    if (safeTimingEqual(clientCk.trim().toLowerCase(), expectedCk)) {
      return { verified: true, matchType: 'ck' };
    }
  }

  return {
    verified: false,
    reason: 'Invalid or forged Safe Exam Browser cryptographic verification hash',
  };
}

// --- OFFICIAL SEB CONFIG KEY COMPUTATION ---

/**
 * Canonicalizes values recursively for official SEB Config Key calculation.
 * Strips originatorVersion, browserExamKey, and sebConfigKey.
 * Sorts dictionary keys alphabetically.
 */
export function canonicalizeSebValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    return val.map(canonicalizeSebValue);
  }
  if (typeof val === 'object' && !(val instanceof Date)) {
    const sortedKeys = Object.keys(val).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
      if (key === 'originatorVersion' || key === 'browserExamKey' || key === 'sebConfigKey') {
        continue;
      }
      result[key] = canonicalizeSebValue(val[key]);
    }
    return result;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return val;
}

/**
 * Computes the official Safe Exam Browser Config Key according to the SEB specification:
 * Strips metadata keys, canonicalizes JSON recursively with sorted keys, and calculates SHA-256 hex digest.
 */
export function computeOfficialSebConfigKey(configDict: Record<string, any>): string {
  const canonical = canonicalizeSebValue(configDict);
  const json = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(json, 'utf8').digest('hex').toLowerCase();
}

// --- XML PLIST GENERATION & PARSING ---

/**
 * Escapes special XML characters.
 */
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescapes special XML characters.
 */
export function unescapeXml(escaped: string): string {
  const entityMap: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  };
  return escaped.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => entityMap[entity] || _);
}

/**
 * Constructs the canonical SEB configuration dictionary from assessment options.
 */
export function buildSebConfigDictionary(options: GenerateSebConfigOptions): Record<string, any> {
  const quitHash =
    options.quitPasswordHash ||
    (options.sebQuitPassword ? hashQuitPassword(options.sebQuitPassword) : '');

  let domainRule = '*';
  try {
    const parsedUrl = new URL(options.startUrl);
    domainRule = `${parsedUrl.hostname}/*`;
  } catch (_) {}

  const defaultFilterRules: SebUrlFilterRule[] = options.urlFilterRules || [
    { active: true, regex: false, rule: domainRule, action: 1 },
    { active: true, regex: false, rule: '*', action: 0 },
  ];

  const dict: Record<string, any> = {
    originatorVersion: 'SEB_CORTEX_M1',
    startURL: options.startUrl,
    quitURL: options.quitUrl || options.startUrl,
    hashedQuitPassword: quitHash || '',
    allowQuit: !!quitHash,
    browserExamKey: options.browserExamKey || '',
    browserViewMode: 1, // Fullscreen kiosk mode
    allowPreferencesWindow: options.allowPreferencesWindow ?? false,
    allowReload: options.allowReload ?? false,
    showReloadWarning: options.showReloadWarning ?? true,
    allowSpellCheck: false,
    allowZoomInOut: false,
    enableURLFilter: true,
    urlFilterTrustedContent: true,
    URLFilterRules: defaultFilterRules.map((r) => ({
      active: r.active,
      regex: r.regex,
      rule: r.rule,
      action: r.action,
    })),
    sendBrowserExamKey: true,
    showTaskBar: false,
    allowVirtualMachine: false,
    allowScreenSharing: false,
  };

  return dict;
}

/**
 * Serializes a configuration dictionary into Apple XML Plist 1.0 format.
 */
export function serializeSebConfigPlist(dict: Record<string, any>): string {
  function serializeValue(val: any, indent: string): string {
    if (val === null || val === undefined) {
      return `${indent}<string></string>\n`;
    }
    if (typeof val === 'boolean') {
      return `${indent}<${val ? 'true' : 'false'}/>\n`;
    }
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        return `${indent}<integer>${val}</integer>\n`;
      }
      return `${indent}<real>${val}</real>\n`;
    }
    if (typeof val === 'string') {
      return `${indent}<string>${escapeXml(val)}</string>\n`;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return `${indent}<array/>\n`;
      let xml = `${indent}<array>\n`;
      for (const item of val) {
        xml += serializeValue(item, `${indent}\t`);
      }
      xml += `${indent}</array>\n`;
      return xml;
    }
    if (typeof val === 'object') {
      const keys = Object.keys(val);
      if (keys.length === 0) return `${indent}<dict/>\n`;
      let xml = `${indent}<dict>\n`;
      for (const key of keys) {
        xml += `${indent}\t<key>${escapeXml(key)}</key>\n`;
        xml += serializeValue(val[key], `${indent}\t`);
      }
      xml += `${indent}</dict>\n`;
      return xml;
    }
    return `${indent}<string>${escapeXml(String(val))}</string>\n`;
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n';
  xml += '<plist version="1.0">\n';
  xml += '<dict>\n';
  for (const key of Object.keys(dict)) {
    xml += `\t<key>${escapeXml(key)}</key>\n`;
    xml += serializeValue(dict[key], '\t');
  }
  xml += '</dict>\n';
  xml += '</plist>\n';
  return xml;
}

/**
 * Lightweight XML Plist parser for SEB configuration plists.
 */
export function parseSebPlistXml(xml: string): Record<string, any> {
  let pos = 0;

  function skipWhitespace() {
    while (pos < xml.length && /\s/.test(xml[pos])) {
      pos++;
    }
  }

  function parseValue(): any {
    skipWhitespace();
    if (pos >= xml.length) return null;

    if (xml.startsWith('<true/>', pos) || xml.startsWith('<true />', pos)) {
      pos = xml.indexOf('>', pos) + 1;
      return true;
    }
    if (xml.startsWith('<false/>', pos) || xml.startsWith('<false />', pos)) {
      pos = xml.indexOf('>', pos) + 1;
      return false;
    }
    if (xml.startsWith('<string/>', pos) || xml.startsWith('<string />', pos)) {
      pos = xml.indexOf('>', pos) + 1;
      return '';
    }
    if (xml.startsWith('<string>', pos)) {
      pos += '<string>'.length;
      const endIdx = xml.indexOf('</string>', pos);
      if (endIdx === -1) throw new Error('Unterminated <string> tag');
      const content = xml.slice(pos, endIdx);
      pos = endIdx + '</string>'.length;
      return unescapeXml(content);
    }
    if (xml.startsWith('<integer>', pos)) {
      pos += '<integer>'.length;
      const endIdx = xml.indexOf('</integer>', pos);
      if (endIdx === -1) throw new Error('Unterminated <integer> tag');
      const content = xml.slice(pos, endIdx).trim();
      pos = endIdx + '</integer>'.length;
      return parseInt(content, 10);
    }
    if (xml.startsWith('<real>', pos)) {
      pos += '<real>'.length;
      const endIdx = xml.indexOf('</real>', pos);
      if (endIdx === -1) throw new Error('Unterminated <real> tag');
      const content = xml.slice(pos, endIdx).trim();
      pos = endIdx + '</real>'.length;
      return parseFloat(content);
    }
    if (xml.startsWith('<array/>', pos) || xml.startsWith('<array />', pos)) {
      pos = xml.indexOf('>', pos) + 1;
      return [];
    }
    if (xml.startsWith('<array>', pos)) {
      pos += '<array>'.length;
      const arr: any[] = [];
      while (true) {
        skipWhitespace();
        if (xml.startsWith('</array>', pos)) {
          pos += '</array>'.length;
          break;
        }
        arr.push(parseValue());
      }
      return arr;
    }
    if (xml.startsWith('<dict/>', pos) || xml.startsWith('<dict />', pos)) {
      pos = xml.indexOf('>', pos) + 1;
      return {};
    }
    if (xml.startsWith('<dict>', pos)) {
      pos += '<dict>'.length;
      const obj: Record<string, any> = {};
      while (true) {
        skipWhitespace();
        if (xml.startsWith('</dict>', pos)) {
          pos += '</dict>'.length;
          break;
        }
        if (!xml.startsWith('<key>', pos)) {
          throw new Error(`Expected <key> tag at position ${pos}`);
        }
        pos += '<key>'.length;
        const keyEnd = xml.indexOf('</key>', pos);
        if (keyEnd === -1) throw new Error('Unterminated <key> tag');
        const key = unescapeXml(xml.slice(pos, keyEnd).trim());
        pos = keyEnd + '</key>'.length;
        const val = parseValue();
        obj[key] = val;
      }
      return obj;
    }
    throw new Error(`Unexpected XML plist token at position ${pos}: ${xml.slice(pos, pos + 30)}`);
  }

  const plistIdx = xml.indexOf('<plist');
  if (plistIdx === -1) throw new Error('Missing <plist> root element');
  pos = xml.indexOf('>', plistIdx) + 1;
  skipWhitespace();

  const rootDict = parseValue();
  return rootDict || {};
}

/**
 * Generates an authoritative Safe Exam Browser .seb configuration plist and computes its official Config Key.
 */
export function generateSafeExamBrowserConfigPlist(options: GenerateSebConfigOptions): {
  xml: string;
  configKey: string;
  configDict: Record<string, any>;
} {
  const configDict = buildSebConfigDictionary(options);
  const configKey = computeOfficialSebConfigKey(configDict);
  const xml = serializeSebConfigPlist(configDict);
  return { xml, configKey, configDict };
}

// --- DEEP LINK URL BUILDERS ---

export function buildSebExamStartUrl(
  baseUrl: string,
  examId: string,
  classroomId: string,
  token?: string
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const query = token ? `?sebToken=${encodeURIComponent(token)}` : '';
  return `${cleanBase}/classroom/${encodeURIComponent(classroomId)}/exam/${encodeURIComponent(examId)}${query}`;
}

export function buildSebExamQuitUrl(baseUrl: string, classroomId: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/classroom/${encodeURIComponent(classroomId)}`;
}

export function buildSebAssignmentStartUrl(
  baseUrl: string,
  assignmentId: string,
  classroomId: string,
  token?: string
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const query = token ? `?sebToken=${encodeURIComponent(token)}` : '';
  return `${cleanBase}/classroom/${encodeURIComponent(classroomId)}/assignment/${encodeURIComponent(assignmentId)}${query}`;
}

export function buildSebAssignmentQuitUrl(baseUrl: string, classroomId: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/classroom/${encodeURIComponent(classroomId)}`;
}

// --- SEB SINGLE-USE LAUNCH TOKENS ---

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf8');
}

/**
 * Generates a signed, single-use SEB launch token with a 10-minute TTL.
 */
export function createSebLaunchToken(payload: SebLaunchTokenPayload): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 10 * 60; // 10 minutes
  const jti = crypto.randomBytes(16).toString('hex');

  const header = { alg: 'HS256', typ: 'JWT' };
  const claims: SebLaunchTokenClaims = {
    ...payload,
    jti,
    iat: nowSec,
    exp: expSec,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const signatureTarget = `${encodedHeader}.${encodedClaims}`;
  const signature = crypto
    .createHmac('sha256', getSebLaunchTokenSecret())
    .update(signatureTarget)
    .digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${signatureTarget}.${encodedSignature}`;
}

/**
 * Verifies an SEB launch token and atomically consumes its nonce to prevent replay attacks.
 */
export async function verifyAndConsumeSebLaunchToken(
  token: string,
  expectedContext: {
    userId?: string;
    assessmentId?: string;
    assessmentType?: 'exam' | 'assignment';
    classroomId?: string;
  }
): Promise<{ valid: boolean; claims?: SebLaunchTokenClaims; reason?: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Missing launch token' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Malformed launch token structure' };
  }

  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const signatureTarget = `${encodedHeader}.${encodedClaims}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', getSebLaunchTokenSecret()).update(signatureTarget).digest()
  );

  if (!safeTimingEqual(encodedSignature, expectedSig, true)) {
    return { valid: false, reason: 'Invalid token cryptographic signature' };
  }

  let claims: SebLaunchTokenClaims;
  try {
    claims = JSON.parse(base64UrlDecode(encodedClaims));
  } catch (_) {
    return { valid: false, reason: 'Failed to decode token claims payload' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!claims.exp || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= nowSec) {
    return { valid: false, reason: 'Launch token has expired or is invalid' };
  }

  if (expectedContext.userId && claims.userId !== expectedContext.userId) {
    return { valid: false, reason: 'Launch token user mismatch' };
  }
  if (expectedContext.assessmentId && claims.assessmentId !== expectedContext.assessmentId) {
    return { valid: false, reason: 'Launch token assessment mismatch' };
  }
  if (expectedContext.assessmentType && claims.assessmentType !== expectedContext.assessmentType) {
    return { valid: false, reason: 'Launch token assessment type mismatch' };
  }
  if (expectedContext.classroomId && claims.classroomId !== expectedContext.classroomId) {
    return { valid: false, reason: 'Launch token classroom mismatch' };
  }

  // Atomic single-use consumption check
  const { consumeTokenNonce } = await import('./seb-token-registry');
  const consumed = await consumeTokenNonce(
    claims.jti,
    claims.userId,
    claims.assessmentId,
    claims.exp * 1000
  );

  if (!consumed) {
    return { valid: false, reason: 'Launch token has already been consumed (replay rejected)' };
  }

  return { valid: true, claims };
}
