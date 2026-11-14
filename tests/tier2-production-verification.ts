import { runTier2BoundaryCorner } from './tier2-boundary-corner';

export async function runTier2ProductionVerification(projectRoot = process.cwd()) {
  return runTier2BoundaryCorner(projectRoot);
}

runTier2ProductionVerification().then((summary) => {
  console.log(`\n--- ${summary.tierName} Summary ---`);
  console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
  console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
  console.log(`Duration: ${summary.durationMs}ms`);
  process.exit(summary.passed ? 0 : 1);
});
