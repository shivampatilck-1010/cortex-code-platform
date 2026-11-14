import { runTier4GovernanceWorkload } from './tier4-governance-workload';

export async function runTier3GovernanceAudit(projectRoot = process.cwd()) {
  return runTier4GovernanceWorkload(projectRoot);
}

runTier3GovernanceAudit().then((summary) => {
  console.log(`\n--- ${summary.tierName} Summary ---`);
  console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
  console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
  console.log(`Duration: ${summary.durationMs}ms`);
  process.exit(summary.passed ? 0 : 1);
});
