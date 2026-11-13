export * from './tier3-cross-feature';
import { runTier3CrossFeature } from './tier3-cross-feature';

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tier3-cross-feature.test.ts')) {
  runTier3CrossFeature().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
