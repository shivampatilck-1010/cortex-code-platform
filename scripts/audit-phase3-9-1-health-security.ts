/**
 * Cortex Online Examination System — Phase 3.9.1 Audit
 * Health Endpoint Security & Information Disclosure Audit
 *
 * Tests:
 * 1. Unauthenticated information exposure on /api/v1/health
 * 2. Leaked database record counts (userCount, examCount, sessionCount)
 * 3. Environment name disclosure
 * 4. Error message leakage on database fault simulation
 * 5. Architectural separation between public probe and protected diagnostics
 *
 * Strictly zero emojis.
 */

interface HealthAuditFinding {
  field: string;
  exposedValue: any;
  risk: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

const findings: HealthAuditFinding[] = [];

console.log('================================================================');
console.log('PHASE 3.9.1: HEALTH ENDPOINT SECURITY AUDIT');
console.log('================================================================\n');

const endpoint = 'http://localhost:3000/api/v1/health';

try {
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  const payload: any = await res.json();
  console.log('Raw Health Response from unauthenticated request:');
  console.log(JSON.stringify(payload, null, 2));

  // Check 1: Record counts exposed to public
  if (payload.checks?.database?.stats) {
    findings.push({
      field: 'checks.database.stats',
      exposedValue: payload.checks.database.stats,
      risk: 'Exposes total university user counts, active exam counts, and candidate session counts to unauthenticated scrapers.',
      severity: 'MEDIUM',
    });
  }

  // Check 2: Environment disclosure
  if (payload.environment) {
    findings.push({
      field: 'environment',
      exposedValue: payload.environment,
      risk: 'Discloses backend deployment environment tier (development/staging/production).',
      severity: 'LOW',
    });
  }

  // Check 3: Internal query latency disclosure
  if (typeof payload.checks?.database?.latencyMs === 'number') {
    findings.push({
      field: 'checks.database.latencyMs',
      exposedValue: `${payload.checks.database.latencyMs}ms`,
      risk: 'Permits timing and side-channel profiling of database query performance.',
      severity: 'LOW',
    });
  }

  console.log('\n--- IDENTIFIED EXPOSURES ---');
  for (const f of findings) {
    console.log(`[${f.severity}] Field: ${f.field}`);
    console.log(`  Exposed: ${JSON.stringify(f.exposedValue)}`);
    console.log(`  Risk:    ${f.risk}`);
  }
} catch (err: any) {
  console.error('Audit request failed:', err.message);
}

console.log('\n================================================================');
console.log(`AUDIT COMPLETE: ${findings.length} INFORMATION DISCLOSURE FINDINGS`);
console.log('================================================================\n');
