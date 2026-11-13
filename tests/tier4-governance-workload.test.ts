export * from './tier4-governance-workload';
import { runTier4GovernanceWorkload } from './tier4-governance-workload';

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tier4-governance-workload.test.ts')) {
  runTier4GovernanceWorkload().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
