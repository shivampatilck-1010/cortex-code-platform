// Cortex Online Examination System — Safe Exam Browser Cryptographic Verification & Secret Security
// Implements the official Safe Exam Browser (SEB) verification specification:
// X-SafeExamBrowser-RequestHash = SHA256(RequestURL + BrowserExamKey)
// X-SafeExamBrowser-ConfigKeyHash = SHA256(RequestURL + ConfigKey)

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { Exam } from './models';

export interface SebVerificationResult {
  verified: boolean;
  matchType?: 'bek' | 'ck';
  reason?: string;
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
 * Derives the canonical Browser Exam Key for an examination.
 */
export function getExpectedBrowserExamKey(exam: Exam): string {
  return exam.sebBrowserExamKey || crypto
    .createHash('sha256')
    .update(`${exam.id}_${exam.classroomId}_cortex_seb`)
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
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.workers.dev') ||
    hostname.endsWith('.cortex.dev')
  );
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
 */
function safeTimingEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a.toLowerCase());
  const bufB = Buffer.from(b.toLowerCase());
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates whether an incoming HTTP request is authenticated by Safe Exam Browser
 * according to the official Safe Exam Browser protocol.
 */
export function verifySafeExamBrowserRequest(req: NextRequest, exam: Exam): SebVerificationResult {
  const isSebRequired = exam.securityLevel === 'seb' || (exam.securityLevel as string) === 'seb_required';

  // If exam does not mandate SEB, standard browsers are permitted
  if (!isSebRequired) {
    return { verified: true };
  }

  // Extract official SEB verification headers
  const reqHashHeader = req.headers.get('x-safeexambrowser-requesthash');
  const ckHashHeader = req.headers.get('x-safeexambrowser-configkeyhash') || req.headers.get('x-safeexambrowser-configkey');

  if (!reqHashHeader && !ckHashHeader) {
    return {
      verified: false,
      reason: 'Missing Safe Exam Browser cryptographic verification headers (X-SafeExamBrowser-RequestHash / X-SafeExamBrowser-ConfigKeyHash)',
    };
  }

  const expectedBek = getExpectedBrowserExamKey(exam);
  const expectedCk = exam.sebConfigKey ? String(exam.sebConfigKey).trim() : null;

  const candidateUrls = generateCandidateUrls(req);

  // 1. Verify Browser Exam Key (BEK) Request Hash
  if (reqHashHeader && /^[a-f0-9]{64}$/i.test(reqHashHeader.trim())) {
    const clientHash = reqHashHeader.trim().toLowerCase();
    for (const url of candidateUrls) {
      const expectedHash = computeSafeExamBrowserHash(url, expectedBek);
      if (safeTimingEqual(clientHash, expectedHash)) {
        return { verified: true, matchType: 'bek' };
      }
    }
  }

  // 2. Verify Config Key (CK) Hash
  if (ckHashHeader && expectedCk && /^[a-f0-9]{64}$/i.test(ckHashHeader.trim())) {
    const clientHash = ckHashHeader.trim().toLowerCase();
    for (const url of candidateUrls) {
      const expectedHash = computeSafeExamBrowserHash(url, expectedCk);
      if (safeTimingEqual(clientHash, expectedHash)) {
        return { verified: true, matchType: 'ck' };
      }
    }
  }

  return {
    verified: false,
    reason: 'Invalid or forged Safe Exam Browser cryptographic verification hash',
  };
}
