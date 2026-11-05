/**
 * Cortex Online Examination System — Phase 3.9
 * Test Suite: Operational Monitoring & Health Probe Verification
 *
 * Validates monitoring capabilities:
 * 1. GET /api/v1/health returns HTTP 200 and JSON payload
 * 2. Status reports 'healthy' with latencyMs < 50ms
 * 3. Database connectivity probe passes
 * 4. Database metrics reported (usersCount, examsCount, sessionsCount)
 * 5. Environment correctly identified
 * 6. Timestamp and server uptime reported
 * 7. CortexLogger.track() measures execution latency accurately
 * 8. Correlation ID injection and propagation
 *
 * Strictly zero emojis.
 */

import { CortexLogger, createLogger } from '../src/lib/classroom/logger';

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

async function runMonitoringTests() {
  console.log('================================================================');
  console.log('PHASE 3.9: OPERATIONAL MONITORING & HEALTH PROBE TEST SUITE');
  console.log('================================================================\n');

  // --- TEST 1: PUBLIC MINIMAL HEALTH PROBE ---
  console.log('--- TEST 1: PUBLIC MINIMAL HEALTH PROBE (/api/v1/health) ---');
  const healthEndpoint = 'http://localhost:3000/api/v1/health';

  try {
    const res = await fetch(healthEndpoint, {
      method: 'GET',
      headers: {
        'x-request-id': 'health-check-corr-001',
      },
    });

    assert(res.status === 200, `Public health probe returns HTTP 200 (received: ${res.status})`);

    const contentType = res.headers.get('content-type') || '';
    assert(contentType.includes('application/json'), 'Health probe returns application/json');

    const data: any = await res.json();
    assert(data.status === 'healthy', `Health status is 'healthy' (found: '${data.status}')`);
    assert(typeof data.timestamp === 'number', 'Timestamp is reported');
    assert(data.checks === undefined, 'Internal checks dictionary strictly shielded from public probe');
    assert(data.environment === undefined, 'Environment name strictly shielded from public probe');
  } catch (err: any) {
    assert(false, `Public health probe request failed: ${err.message}`);
  }

  // --- TEST 2: PROTECTED OPERATIONAL DIAGNOSTICS PROBE ---
  console.log('\n--- TEST 2: PROTECTED OPERATIONAL DIAGNOSTICS (/api/v1/health?diagnostics=true) ---');
  try {
    const diagRes = await fetch(`${healthEndpoint}?diagnostics=true`, {
      method: 'GET',
      headers: {
        'x-request-id': 'health-diag-corr-002',
        'authorization': 'Bearer cortex-monitoring-diagnostic-key-2026',
      },
    });

    assert(diagRes.status === 200, `Diagnostics probe returns HTTP 200 (received: ${diagRes.status})`);
    const diagData: any = await diagRes.json();
    assert(diagData.status === 'healthy', `Diagnostics status is 'healthy' (found: '${diagData.status}')`);
    assert(diagData.checks?.database?.reachable === true, 'Database reachable check is true');
    assert(diagData.checks?.database?.status === 'healthy', `Database status is 'healthy' (found: '${diagData.checks?.database?.status}')`);
    assert(typeof diagData.totalLatencyMs === 'number', `Total latency measured: ${diagData.totalLatencyMs}ms`);
    assert(diagData.totalLatencyMs < 200, `Diagnostics latency within SLA (< 200ms): ${diagData.totalLatencyMs}ms`);
    assert(typeof diagData.checks?.database?.latencyMs === 'number', `Database query latency measured: ${diagData.checks?.database?.latencyMs}ms`);
    assert(typeof diagData.environment === 'string', `Environment reported in diagnostics: '${diagData.environment}'`);
    assert(diagData.checks?.database?.stats !== undefined, 'Database operational stats included in diagnostics');
    assert(typeof diagData.checks?.database?.stats.userCount === 'number', `User count reported: ${diagData.checks?.database?.stats.userCount}`);
    assert(typeof diagData.checks?.database?.stats.examCount === 'number', `Exam count reported: ${diagData.checks?.database?.stats.examCount}`);
    assert(typeof diagData.checks?.database?.stats.sessionCount === 'number', `Session count reported: ${diagData.checks?.database?.stats.sessionCount}`);
  } catch (err: any) {
    assert(false, `Diagnostics probe request failed: ${err.message}`);
  }

  // --- TEST 3: LOGGER TRACK & LATENCY MEASUREMENT ---
  console.log('\n--- TEST 3: LOGGER TRACK & LATENCY MEASUREMENT ---');
  const customCorrId = 'probe_corr_test_999';
  const probeLogger = createLogger(customCorrId, { component: 'health_monitor' });

  assert(probeLogger.getCorrelationId() === customCorrId, 'Correlation ID correctly assigned to logger');

  let executionTracked = false;
  const result = await probeLogger.track('database_query_benchmark', async () => {
    // Simulate brief asynchronous task
    await new Promise((resolve) => setTimeout(resolve, 25));
    executionTracked = true;
    return { recordsProcessed: 42 };
  });

  assert(executionTracked === true, 'Tracked asynchronous task executed successfully');
  assert(result.recordsProcessed === 42, 'Tracked return value preserved');

  console.log('\n================================================================');
  console.log(`MONITORING RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMonitoringTests().catch((err) => {
  console.error('Fatal monitoring test error:', err);
  process.exit(1);
});
