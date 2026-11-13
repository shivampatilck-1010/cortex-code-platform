import * as fs from 'fs';
import * as path from 'path';
import { runTier1FeatureCoverage } from './tier1-feature-coverage';
import { runTier2BoundaryCorner } from './tier2-boundary-corner';
import { runTier3CrossFeature } from './tier3-cross-feature';
import { runTier4GovernanceWorkload } from './tier4-governance-workload';
import { TierExecutionResult } from './test-utils';

interface RunnerOptions {
  tierFilter?: number;
  jsonOutput?: boolean;
  verbose?: boolean;
}

export async function runAllE2ETests(
  projectRoot = process.cwd(),
  options: RunnerOptions = {}
): Promise<{ success: boolean; summaries: TierExecutionResult[] }> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('='.repeat(80));
  console.log('CORTEX UNIVERSAL CODE PLATFORM - E2E TEST HARNESS');
  console.log('='.repeat(80));
  console.log(`Timestamp:    ${timestamp}`);
  console.log(`Node Runtime: ${process.version}`);
  console.log(`Project Root: ${projectRoot}`);
  console.log(`Execution:    Sequential Opaque-Box Multi-Tier Verification`);
  console.log('='.repeat(80));
  console.log('');

  const summaries: TierExecutionResult[] = [];

  const tierRunners = [
    { tierNumber: 1, name: 'Tier 1 - Feature Coverage', fn: runTier1FeatureCoverage },
    { tierNumber: 2, name: 'Tier 2 - Boundary and Corner Cases', fn: runTier2BoundaryCorner },
    { tierNumber: 3, name: 'Tier 3 - Cross-Feature Combinations', fn: runTier3CrossFeature },
    { tierNumber: 4, name: 'Tier 4 - Governance and Workload Simulation', fn: runTier4GovernanceWorkload },
  ];

  for (const runner of tierRunners) {
    if (options.tierFilter && options.tierFilter !== runner.tierNumber) {
      continue;
    }

    console.log(`>>> Executing ${runner.name}...`);
    try {
      const tierResult = await runner.fn(projectRoot);
      summaries.push(tierResult);

      for (const tc of tierResult.results) {
        const statusBadge = tc.status === 'passed' ? '[PASS]' : tc.status === 'failed' ? '[FAIL]' : '[SKIP]';
        console.log(`  ${statusBadge} ${tc.name} (${tc.durationMs}ms, ${tc.assertionCount} assertions)`);
        if (tc.status === 'failed' && tc.error) {
          console.log(`         ERROR: ${tc.error}`);
        }
        if (options.verbose && tc.details) {
          for (const d of tc.details) {
            console.log(`           ${d}`);
          }
        }
      }
      const tierStatusBadge = tierResult.passed ? '[PASS]' : '[FAIL]';
      console.log(
        `--- ${runner.name} Result: ${tierStatusBadge} (Tests: ${tierResult.passedTests}/${tierResult.totalTests}, Assertions: ${tierResult.passedAssertions}/${tierResult.totalAssertions}, Time: ${tierResult.durationMs}ms)\n`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  [CRITICAL ERROR] Failed to complete ${runner.name}: ${msg}\n`);
      summaries.push({
        tierName: runner.name,
        passed: false,
        totalTests: 1,
        passedTests: 0,
        failedTests: 1,
        skippedTests: 0,
        totalAssertions: 0,
        passedAssertions: 0,
        failedAssertions: 1,
        durationMs: 0,
        results: [
          {
            name: `${runner.name} Suite Execution`,
            tier: runner.name,
            status: 'failed',
            durationMs: 0,
            assertionCount: 0,
            error: msg,
          },
        ],
      });
    }
  }

  const totalDuration = Date.now() - startTime;
  let allPassed = true;
  let totalTests = 0;
  let totalPassedTests = 0;
  let totalFailedTests = 0;
  let totalAssertions = 0;
  let totalPassedAssertions = 0;
  let totalFailedAssertions = 0;

  for (const s of summaries) {
    if (!s.passed) {
      allPassed = false;
    }
    totalTests += s.totalTests;
    totalPassedTests += s.passedTests;
    totalFailedTests += s.failedTests;
    totalAssertions += s.totalAssertions;
    totalPassedAssertions += s.passedAssertions;
    totalFailedAssertions += s.failedAssertions;
  }

  console.log('='.repeat(80));
  console.log('E2E TEST HARNESS EXECUTION SUMMARY');
  console.log('='.repeat(80));
  console.log(
    'Tier Name'.padEnd(42) +
      'Status'.padEnd(10) +
      'Tests'.padEnd(12) +
      'Assertions'.padEnd(14) +
      'Duration'
  );
  console.log('-'.repeat(80));

  for (const s of summaries) {
    const statusText = s.passed ? 'PASS' : 'FAIL';
    const testText = `${s.passedTests}/${s.totalTests}`;
    const assertText = `${s.passedAssertions}/${s.totalAssertions}`;
    const durText = `${s.durationMs}ms`;
    console.log(
      s.tierName.padEnd(42) +
        statusText.padEnd(10) +
        testText.padEnd(12) +
        assertText.padEnd(14) +
        durText
    );
  }

  console.log('-'.repeat(80));
  console.log(`TOTAL SUITE METRICS:`);
  console.log(`  Total Test Cases: ${totalTests} (Passed: ${totalPassedTests}, Failed: ${totalFailedTests})`);
  console.log(`  Total Assertions: ${totalAssertions} (Passed: ${totalPassedAssertions}, Failed: ${totalFailedAssertions})`);
  console.log(`  Total Duration:   ${totalDuration}ms`);
  console.log(`  Overall Verdict:  ${allPassed ? 'ALL TIERS PASSED [SUCCESS]' : 'TIERS FAILED [FAILURE]'}`);
  console.log('='.repeat(80));

  if (options.jsonOutput) {
    const jsonReportPath = path.join(projectRoot, 'test-e2e-report.json');
    fs.writeFileSync(
      jsonReportPath,
      JSON.stringify(
        {
          timestamp,
          allPassed,
          totalDuration,
          totalTests,
          totalPassedTests,
          totalFailedTests,
          totalAssertions,
          totalPassedAssertions,
          totalFailedAssertions,
          summaries,
        },
        null,
        2
      )
    );
    console.log(`[INFO] Machine-readable JSON report written to: ${jsonReportPath}`);
  }

  return { success: allPassed, summaries };
}

// Parse CLI flags
function parseArgs(): RunnerOptions {
  const options: RunnerOptions = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--tier=')) {
      options.tierFilter = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--json') {
      options.jsonOutput = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }
  return options;
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('tests/run-e2e.ts');
if (isDirectRun) {
  const options = parseArgs();
  runAllE2ETests(process.cwd(), options).then((res) => {
    process.exit(res.success ? 0 : 1);
  });
}
