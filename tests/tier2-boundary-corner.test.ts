export * from './tier2-boundary-corner';
import { runTier2BoundaryCorner } from './tier2-boundary-corner';

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tier2-boundary-corner.test.ts')) {
  runTier2BoundaryCorner().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
