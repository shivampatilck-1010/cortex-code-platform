/**
 * Milestone 3: Frontend Exam & Assignment Verification Script
 * Validates:
 * 1. SEB client utilities (protocol URI, headers, hex color validation, theme presets).
 * 2. Component exports and structural integrity.
 * 3. Deep link routing files existence and interface contracts.
 */

import {
  validateHexColor,
  getSebProtocolUri,
  buildSebHeaders,
  THEME_PRESETS,
  hashQuitPassword,
} from '../src/lib/classroom/seb-client.ts';
import fs from 'node:fs';
import path from 'node:path';

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

async function runM3Verification() {
  console.log('================================================================');
  console.log('MILESTONE 3: FRONTEND EXAM & ASSIGNMENT VERIFICATION');
  console.log('================================================================\n');

  // --- SECTION 1: SEB Client Helpers & Hex Validation ---
  console.log('--- SECTION 1: SEB CLIENT HELPERS & HEX VALIDATION ---');
  assert(validateHexColor('#FF9100') === true, 'validateHexColor accepts valid 6-char hex #FF9100');
  assert(validateHexColor('#fff') === true, 'validateHexColor accepts valid 3-char hex #fff');
  assert(validateHexColor('#000000') === true, 'validateHexColor accepts valid 6-char hex #000000');
  assert(validateHexColor('#0ea5e9') === true, 'validateHexColor accepts valid 6-char hex #0ea5e9');
  assert(validateHexColor('#12345') === false, 'validateHexColor rejects invalid 5-char hex #12345');
  assert(validateHexColor('red') === false, 'validateHexColor rejects color name red');
  assert(validateHexColor('<script>') === false, 'validateHexColor rejects XSS attempt <script>');
  assert(validateHexColor('#gggggg') === false, 'validateHexColor rejects non-hex characters #gggggg');

  // --- SECTION 2: Protocol URI Generation ---
  console.log('\n--- SECTION 2: SEB PROTOCOL URI GENERATION ---');
  const httpsUrl = 'https://cortex.edu/api/v1/classrooms/CLS_1/exams/exam_1/seb-config';
  const protocolUri = getSebProtocolUri(httpsUrl);
  assert(protocolUri === 'sebs://cortex.edu/api/v1/classrooms/CLS_1/exams/exam_1/seb-config', 'https URL converted to sebs:// protocol URI');

  const httpUrl = 'http://cortex.edu/api/v1/classrooms/CLS_1/assignments/asg_1/seb-config';
  const protocolUriHttp = getSebProtocolUri(httpUrl);
  assert(protocolUriHttp === 'seb://cortex.edu/api/v1/classrooms/CLS_1/assignments/asg_1/seb-config', 'http URL converted to seb:// protocol URI');

  // --- SECTION 3: SEB Header Generation ---
  console.log('\n--- SECTION 3: SEB HEADER GENERATION ---');
  const headers = buildSebHeaders({
    configKey: 'a'.repeat(64),
    browserExamKey: 'b'.repeat(64),
    launchToken: 'header_launch_token_123',
  });
  assert(headers['x-seb-client-config-key'] === 'a'.repeat(64), 'buildSebHeaders binds x-seb-client-config-key');
  assert(headers['x-seb-client-browser-exam-key'] === 'b'.repeat(64), 'buildSebHeaders binds x-seb-client-browser-exam-key');
  assert(headers['x-seb-launch-token'] === 'header_launch_token_123', 'buildSebHeaders binds x-seb-launch-token');

  // --- SECTION 4: Quit Password Hashing ---
  console.log('\n--- SECTION 4: CLIENT QUIT PASSWORD HASHING ---');
  const rawPw = 'TeacherQuit2026';
  const hashedPw = await hashQuitPassword(rawPw);
  assert(hashedPw.length === 64, 'hashQuitPassword produces 64-char hex SHA-256');
  assert(/^[a-f0-9]{64}$/.test(hashedPw), 'hashQuitPassword produces lowercase hex string');

  // --- SECTION 5: Theme Presets ---
  console.log('\n--- SECTION 5: THEME PRESETS ---');
  assert(THEME_PRESETS.length >= 4, 'THEME_PRESETS provides at least 4 presets');
  const presetIds = THEME_PRESETS.map(p => p.id);
  assert(presetIds.includes('cortex-dark'), 'THEME_PRESETS includes cortex-dark');
  assert(presetIds.includes('slate-dark'), 'THEME_PRESETS includes slate-dark');
  assert(presetIds.includes('midnight-blue'), 'THEME_PRESETS includes midnight-blue');
  assert(presetIds.includes('classic-light'), 'THEME_PRESETS includes classic-light');

  // --- SECTION 6: File Verification & Component Integrity ---
  console.log('\n--- SECTION 6: FILE VERIFICATION & ACCESSIBILITY ---');
  const filesToCheck = [
    'src/components/classroom/exams/ExamRunnerModal.tsx',
    'src/components/classroom/exams/ExamBuilderModal.tsx',
    'src/components/classroom/exams/ExaminationsTab.tsx',
    'src/components/classroom/ExaminationsTab.tsx',
    'src/app/classroom/[roomId]/assignments/[asgId]/solve/page.tsx',
    'src/app/classroom/page.tsx',
    'src/app/classroom/[roomId]/page.tsx',
    'src/app/classroom/[roomId]/exam/[examId]/page.tsx',
    'src/app/classroom/[roomId]/assignment/[asgId]/page.tsx',
    'src/app/classroom/[roomId]/assignments/builder/[asgId]/page.tsx',
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(relPath);
    assert(fs.existsSync(fullPath), `Target file exists: ${relPath}`);
  }

  // Check ExamRunnerModal contents for accessibility attributes
  const runnerContent = fs.readFileSync(path.resolve('src/components/classroom/exams/ExamRunnerModal.tsx'), 'utf8');
  assert(runnerContent.includes('role="alertdialog"'), 'ExamRunnerModal contains role="alertdialog"');
  assert(runnerContent.includes('aria-modal="true"'), 'ExamRunnerModal contains aria-modal="true"');
  assert(runnerContent.includes('aria-labelledby="seb-gate-title"'), 'ExamRunnerModal contains aria-labelledby="seb-gate-title"');
  assert(runnerContent.includes('aria-describedby="seb-gate-desc"'), 'ExamRunnerModal contains aria-describedby="seb-gate-desc"');
  assert(runnerContent.includes('https://safeexambrowser.org/download_en.html'), 'ExamRunnerModal contains official SEB download link');
  assert(runnerContent.includes('--exam-primary-color'), 'ExamRunnerModal injects --exam-primary-color');
  assert(runnerContent.includes('--exam-bg-color'), 'ExamRunnerModal injects --exam-bg-color');
  assert(runnerContent.includes('Exit Safe Exam Browser'), 'ExamRunnerModal contains Exit Safe Exam Browser button');

  // Check Assignment Solve page contents for accessibility attributes
  const asgSolveContent = fs.readFileSync(path.resolve('src/app/classroom/[roomId]/assignments/[asgId]/solve/page.tsx'), 'utf8');
  assert(asgSolveContent.includes('role="alertdialog"'), 'Assignment solve page contains role="alertdialog"');
  assert(asgSolveContent.includes('aria-modal="true"'), 'Assignment solve page contains aria-modal="true"');
  assert(asgSolveContent.includes('https://safeexambrowser.org/download_en.html'), 'Assignment solve page contains official SEB download link');
  assert(asgSolveContent.includes('x-seb-client-config-key'), 'Assignment solve forwards x-seb-client-config-key');
  assert(asgSolveContent.includes('x-seb-client-browser-exam-key'), 'Assignment solve forwards x-seb-client-browser-exam-key');

  // Check ExaminationsTab for SEB badge and action buttons
  const examsTabContent = fs.readFileSync(path.resolve('src/components/classroom/exams/ExaminationsTab.tsx'), 'utf8');
  assert(examsTabContent.includes('Safe Exam Browser (SEB Required)'), 'ExaminationsTab includes SEB badge text');
  assert(examsTabContent.includes('Launch in SEB'), 'ExaminationsTab includes Launch in SEB action');
  assert(examsTabContent.includes('.seb'), 'ExaminationsTab includes .seb download action');

  // Check ExamBuilderModal for SEB security controls and branding theme picker
  const builderContent = fs.readFileSync(path.resolve('src/components/classroom/exams/ExamBuilderModal.tsx'), 'utf8');
  assert(builderContent.includes('Safe Branding &amp; Theme Customization'), 'ExamBuilderModal includes Branding & Theme customization');
  assert(builderContent.includes('validateHexColor'), 'ExamBuilderModal uses validateHexColor');
  assert(builderContent.includes('sebAllowReload'), 'ExamBuilderModal supports sebAllowReload');
  assert(builderContent.includes('sebShowReloadWarning'), 'ExamBuilderModal supports sebShowReloadWarning');

  // Check classroom deep link handler
  const classroomPageContent = fs.readFileSync(path.resolve('src/app/classroom/page.tsx'), 'utf8');
  assert(classroomPageContent.includes('deepLinkLaunchToken'), 'classroom/page.tsx handles deep link launch token');
  assert(classroomPageContent.includes('deepLinkExamId'), 'classroom/page.tsx handles deep link examId');
  assert(classroomPageContent.includes('qAssignmentId'), 'classroom/page.tsx handles deep link assignmentId');

  console.log('\n================================================================');
  console.log(`MILESTONE 3 VERIFICATION SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runM3Verification().catch((err) => {
  console.error('M3 Verification Error:', err);
  process.exit(1);
});
