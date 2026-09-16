import { execSync } from 'child_process';
import fs from 'fs';

const suites = [
  'test-phase1-final.ts',
  'test-phase2a.ts',
  'test-phase2b.ts',
  'test-phase2c.ts',
  'test-phase2d.ts',
  'test-phase2e.ts',
  'test-phase2f.ts',
  'test-phase2g.ts',
  'test-phase2h.ts',
  'test-phase2i-a.mjs',
  'test-phase2i-b.ts',
  'test-phase2i-c.ts',
  'test-phase2i-d.ts'
];

console.log('=== RUNNING ALL REGRESSION SUITES LOCALLY ===');
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
for (const suite of suites) {
  if (fs.existsSync('scripts/' + suite)) {
    try {
      console.log('--- RUNNING ' + suite + ' ---');
      const out = execSync('npx tsx scripts/' + suite, { 
          encoding: 'utf-8', 
          env: { ...process.env, BASE_URL: baseUrl }
      });
      const passMatch = out.match(/(\\d+)\\s*PASS/);
      const failMatch = out.match(/(\\d+)\\s*FAIL/);
      
      const passes = passMatch ? passMatch[1] : '?';
      const fails = failMatch ? failMatch[1] : '?';
      console.log(suite + ': ' + passes + ' PASS / ' + fails + ' FAIL');
    } catch (e) {
      const out = e.stdout || e.stderr || e.message;
      const passMatch = out.match(/(\\d+)\\s*PASS/);
      const failMatch = out.match(/(\\d+)\\s*FAIL/);
      const passes = passMatch ? passMatch[1] : '?';
      const fails = failMatch ? failMatch[1] : '?';
      console.log(suite + ' (FAILED RUN): ' + passes + ' PASS / ' + fails + ' FAIL');
    }
  } else {
    console.log(suite + ' NOT FOUND');
  }
}
