export * from './tier1-feature-coverage';
import { runTier1FeatureCoverage } from './tier1-feature-coverage';

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tier1-feature-coverage.test.ts')) {
  runTier1FeatureCoverage().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
