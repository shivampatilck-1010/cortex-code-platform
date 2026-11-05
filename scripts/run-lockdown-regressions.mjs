import { spawnSync } from 'child_process';
import path from 'path';

const testSuites = [
  { name: 'Packaging & Installer', script: 'scripts/test-lockdown-packaging-and-installer.ts', expected: 7 },
  { name: 'Physical Process Crash', script: 'scripts/test-lockdown-physical-process-crash.ts', expected: 1 },
  { name: 'College Demonstration (22-Step)', script: 'scripts/test-lockdown-college-demonstration.ts', expected: 22 },
  { name: 'Alpha 28 Proctoring & Integrity', script: 'scripts/test-lockdown-alpha28-proctoring-and-integrity.ts', expected: 17 },
  { name: 'Alpha 29 Reliability & Adversarial', script: 'scripts/test-lockdown-alpha29-reliability-and-adversarial.ts', expected: 22 },
  { name: 'Alpha 30 Institutional & Accessibility', script: 'scripts/test-lockdown-alpha30-institutional-and-accessibility.ts', expected: 25 },
  { name: 'Alpha 31 Policy Enforcement & RBAC', script: 'scripts/test-lockdown-alpha31-policy-enforcement-and-rbac.ts', expected: 27 },
  { name: 'Alpha 32 End-to-End Enforcement', script: 'scripts/test-lockdown-alpha32-end-to-end-enforcement.ts', expected: 17 },
  { name: 'Alpha 33 Identity & Cryptographic Security', script: 'scripts/test-lockdown-alpha33-identity-and-cryptographic-security.ts', expected: 29 },
  { name: 'Alpha 34 Distributed Security & Concurrency', script: 'scripts/test-lockdown-alpha34-distributed-security.ts', expected: 32 },
  { name: 'Alpha 35 Standards & Release Readiness', script: 'scripts/test-lockdown-alpha35-standards-and-release-readiness.ts', expected: 35 },
  { name: 'Alpha 36 Protocol Interoperability', script: 'scripts/test-lockdown-alpha36-protocol-interoperability.ts', expected: 39 },
  { name: 'Alpha 37 Adversarial Security & Qualification', script: 'scripts/test-lockdown-alpha37-adversarial-verification.ts', expected: 47 },
  { name: 'Alpha 38 Release Qualification', script: 'scripts/test-lockdown-alpha38-release-qualification.ts', expected: 70 }
];

console.log('================================================================');
console.log('CORTEX LOCKDOWN: FULL 14-SUITE REGRESSION RUN');
console.log('================================================================');

let totalChecks = 0;
let totalPassed = 0;
let allPassed = true;

for (const suite of testSuites) {
  process.stdout.write(`Executing ${suite.name}... `);
  const result = spawnSync('npx.cmd', ['tsx', suite.script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
    shell: true
  });

  if (result.status === 0) {
    console.log(`PASS (${suite.expected}/${suite.expected})`);
    totalChecks += suite.expected;
    totalPassed += suite.expected;
  } else {
    console.log(`FAIL (Exit Code ${result.status})`);
    if (result.error) console.error('Spawn error:', result.error);
    console.error(result.stderr || result.stdout);
    allPassed = false;
    break;
  }
}

console.log('================================================================');
console.log(`Cumulative Regression: ${totalPassed}/${totalChecks} Passed (${((totalPassed/totalChecks)*100).toFixed(1)}%)`);
console.log(`All 14 Suites Status:  ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
console.log('================================================================');

if (!allPassed) {
  process.exit(1);
}
