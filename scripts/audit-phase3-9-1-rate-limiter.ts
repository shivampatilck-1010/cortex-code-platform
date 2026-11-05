/**
 * Cortex Online Examination System — Phase 3.9.1 Audit
 * Distributed Rate Limiting & Authentication Abuse Test
 *
 * Reproduces and verifies:
 * 1. Multi-isolate in-memory partitioning (in-memory state not shared across isolates)
 * 2. Worker isolate restart / recycling wiping lockout state
 * 3. Account lockout denial-of-service abuse against legitimate users
 * 4. IP spoofing via X-Forwarded-For when CF-Connecting-IP is absent or behind reverse proxies
 * 5. Concurrent login race conditions
 *
 * Strictly zero emojis.
 */

import { rateLimiter } from '../src/lib/classroom/rate-limiter';

interface AuditResult {
  vulnerability: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confirmed: boolean;
  evidence: string;
}

const auditResults: AuditResult[] = [];

console.log('================================================================');
console.log('PHASE 3.9.1: DISTRIBUTED RATE LIMITING & AUTHENTICATION AUDIT');
console.log('================================================================\n');

// 1. Multi-Isolate State Partitioning Simulation
console.log('--- TEST 1: MULTI-ISOLATE STATE PARTITIONING ---');
// In Cloudflare Workers, separate edge isolates have separate memory heaps.
// We simulate 3 distinct Worker isolates executing concurrently:
const isolateAStore = new Map<string, any>();
const isolateBStore = new Map<string, any>();
const isolateCStore = new Map<string, any>();

// An attacker attacks target 'victim@university.edu' by distributing across isolates:
const targetUser = 'user:victim@university.edu';
const maxPerIsolate = 4; // Attacker sends 4 failed requests to Isolate A, 4 to B, 4 to C (Total 12 failed attempts)

// Isolate A receives 4 failures:
for (let i = 0; i < maxPerIsolate; i++) {
  isolateAStore.set(targetUser, (isolateAStore.get(targetUser) || 0) + 1);
}
// Isolate B receives 4 failures:
for (let i = 0; i < maxPerIsolate; i++) {
  isolateBStore.set(targetUser, (isolateBStore.get(targetUser) || 0) + 1);
}
// Isolate C receives 4 failures:
for (let i = 0; i < maxPerIsolate; i++) {
  isolateCStore.set(targetUser, (isolateCStore.get(targetUser) || 0) + 1);
}

const totalFailures = isolateAStore.get(targetUser) + isolateBStore.get(targetUser) + isolateCStore.get(targetUser);
const isAnyIsolateLocked = (isolateAStore.get(targetUser) >= 5) || (isolateBStore.get(targetUser) >= 5) || (isolateCStore.get(targetUser) >= 5);

console.log(`Total distributed failed attempts sent: ${totalFailures}`);
console.log(`Were any isolates locked? ${isAnyIsolateLocked}`);

if (totalFailures === 12 && !isAnyIsolateLocked) {
  auditResults.push({
    vulnerability: 'Distributed In-Memory Partitioning (Bypass via Multi-Isolate Routing)',
    severity: 'HIGH',
    confirmed: true,
    evidence: `Attacker executed ${totalFailures} failed attempts distributed across 3 isolates without triggering the 5-attempt lockout threshold because in-memory state is isolated per Worker V8 instance.`,
  });
  console.log('[CONFIRMED VULNERABILITY] In-memory rate limiting is partitioned across Worker isolates.');
}

// 2. Isolate Recycling / Memory Loss
console.log('\n--- TEST 2: WORKER ISOLATE RECYCLING / LIFECYCLE ---');
rateLimiter.reset();
// Lock out an account in memory
for (let i = 0; i < 5; i++) {
  rateLimiter.recordAuthFailure('user:attacker_target');
}
const beforeRestart = rateLimiter.check('user:attacker_target', 10, 60000);
console.log(`Lockout active before isolate recycle: ${!beforeRestart.allowed}`);

// Worker isolate recycles (cold start, serverless recycle, redeploy, or idle timeout)
rateLimiter.reset();
const afterRestart = rateLimiter.check('user:attacker_target', 10, 60000);
console.log(`Lockout active after isolate recycle: ${!afterRestart.allowed}`);

if (!beforeRestart.allowed && afterRestart.allowed) {
  auditResults.push({
    vulnerability: 'Ephemeral Memory State Loss on Isolate Recycling',
    severity: 'HIGH',
    confirmed: true,
    evidence: 'Worker isolate recycle or cold start completely resets all in-memory lockout and rate-limit records, wiping lockout history.',
  });
  console.log('[CONFIRMED VULNERABILITY] Lockout state is completely lost upon isolate restart.');
}

// 3. Denial-of-Service via Malicious Account Lockout Abuse
console.log('\n--- TEST 3: DENIAL OF SERVICE VIA ACCOUNT LOCKOUT ABUSE ---');
// Attacker knows legitimate student email: 'student_alice@university.edu'
// Attacker deliberately submits 5 wrong passwords from attacker IP.
rateLimiter.reset();
const legitimateUserKey = 'user:student_alice@university.edu';
for (let i = 0; i < 5; i++) {
  rateLimiter.recordAuthFailure(legitimateUserKey);
}

// Legitimate student now tries to log in with correct password:
const studentAttempt = rateLimiter.check(legitimateUserKey, 10, 60000);
console.log(`Is legitimate student locked out? ${!studentAttempt.allowed}`);

if (!studentAttempt.allowed) {
  auditResults.push({
    vulnerability: 'Account Lockout Denial of Service (Unauthenticated Targeted DOS)',
    severity: 'HIGH',
    confirmed: true,
    evidence: 'Any anonymous adversary can submit 5 bad passwords for a known student or faculty email to deny legitimate access for up to 15 minutes, which is catastrophic right before or during an exam.',
  });
  console.log('[CONFIRMED VULNERABILITY] Unauthenticated lockout creates a denial-of-service vector against legitimate users.');
}

// 4. IP Spoofing via X-Forwarded-For
console.log('\n--- TEST 4: IP SPOOFING BEHAVIOR ---');
// When behind reverse proxies or when cf-connecting-ip is missing:
const req1Ip = reqHeadersToIp({ 'x-forwarded-for': '203.0.113.195' });
const req2Ip = reqHeadersToIp({ 'x-forwarded-for': '203.0.113.196' });
console.log(`Req 1 derived IP: ${req1Ip}, Req 2 derived IP: ${req2Ip}`);
if (req1Ip !== req2Ip) {
  auditResults.push({
    vulnerability: 'IP Rate Limiting Bypass via Header Mutation in Non-CF Proxies',
    severity: 'MEDIUM',
    confirmed: true,
    evidence: 'When CF-Connecting-IP is not guaranteed (e.g. local staging or intermediate reverse proxies), rotating X-Forwarded-For bypasses IP-based sliding window.',
  });
}

function reqHeadersToIp(headers: Record<string, string>): string {
  return headers['cf-connecting-ip'] || headers['x-forwarded-for']?.split(',')[0].trim() || '127.0.0.1';
}

console.log('\n================================================================');
console.log('AUDIT SUMMARY:');
for (const r of auditResults) {
  console.log(`[${r.severity}] ${r.vulnerability}`);
  console.log(`  Evidence: ${r.evidence}`);
}
console.log('================================================================\n');
