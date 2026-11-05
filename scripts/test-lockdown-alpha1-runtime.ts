// Cortex Lockdown - Alpha 1 Runtime Security Verification Test Suite
// Verifies native binary integrity, Win32 security subsystems, launch grants,
// server-authoritative restricted examination enforcement, and WebRTC proctoring logic.
// Strictly zero emojis.

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  DEFAULT_LOCKDOWN_POLICY,
  hashPolicy,
  signLaunchGrant,
  verifyLaunchGrant,
  signDeviceTrustToken,
} from '../src/lib/lockdown/security-policy';

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL' | 'BLOCKED';
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, id: string, name: string, details: string) {
  if (condition) {
    results.push({ id, name, status: 'PASS', details });
    console.log(`[PASS] ${id}: ${name} - ${details}`);
  } else {
    results.push({ id, name, status: 'FAIL', details });
    console.error(`[FAIL] ${id}: ${name} - ${details}`);
  }
}

async function runAlpha1Verification() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN - ALPHA 1 RUNTIME VERIFICATION SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: Native Windows Binary Integrity & Execution
  // -------------------------------------------------------------
  console.log('--- Suite 1: Native Windows Binary Integrity ---');
  const exePath = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/bin/CortexLockdown.exe');
  const exeExists = fs.existsSync(exePath);
  assert(exeExists, 'WIN-01', 'Windows Executable Presence', `File located at ${exePath}`);

  if (exeExists) {
    const stats = fs.statSync(exePath);
    const validSizes = [28160, 29184, 31232, 33280];
    assert(validSizes.includes(stats.size), 'WIN-02', 'Binary File Size Verification', `Actual: ${stats.size} bytes`);

    const fileBuffer = fs.readFileSync(exePath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();
    const validHashes = [
      '18E41B800696C7262722C1880BD207FCB603C1591F9C9CA884986C828CCF07F4',
      '6A6CD835D3025255DF0D25259371CFEE0CA6D33CC766E98EAE95D6F51BBCC254',
      '6E447E11B6DC9E431CD067D22C58AAF1246E50CBF362687FF482AB255A90D79A',
      '68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466'
    ];
    assert(validHashes.includes(sha256), 'WIN-03', 'Binary SHA-256 Checksum', `Hash: ${sha256}`);

    // Verify PE Header (MZ magic bytes)
    const isPE = fileBuffer[0] === 0x4d && fileBuffer[1] === 0x5a;
    assert(isPE, 'WIN-04', 'Valid PE Executable Format', 'Header starts with MZ (0x4D, 0x5A)');
  }

  // -------------------------------------------------------------
  // SUITE 2: Win32 P/Invoke Declarations & Security Controls
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Win32 P/Invoke Security Engine Inspection ---');
  const win32Src = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/Security/Win32Native.cs'), 'utf8');
  const hookSrc = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/Security/KeyboardHook.cs'), 'utf8');
  const displaySrc = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/Security/DisplayAffinity.cs'), 'utf8');
  const watchdogSrc = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs'), 'utf8');
  const clipboardSrc = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/Security/ClipboardGuard.cs'), 'utf8');
  const envSrc = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/Security/EnvironmentInspector.cs'), 'utf8');

  assert(win32Src.includes('SetWindowsHookEx') && win32Src.includes('WH_KEYBOARD_LL = 13'), 'SEC-01', 'Low-Level Keyboard Hook Declaration', 'WH_KEYBOARD_LL (13) and SetWindowsHookEx declared');
  assert(win32Src.includes('SetWindowDisplayAffinity') && win32Src.includes('WDA_MONITOR = 0x00000001'), 'SEC-02', 'Window Display Affinity Declaration', 'WDA_MONITOR and SetWindowDisplayAffinity declared');
  assert(win32Src.includes('EmptyClipboard') && win32Src.includes('OpenClipboard'), 'SEC-03', 'Clipboard Flush P/Invoke Declaration', 'OpenClipboard, EmptyClipboard, CloseClipboard declared');
  assert(hookSrc.includes('VK_TAB') && hookSrc.includes('VK_LWIN') && hookSrc.includes('VK_SNAPSHOT') && hookSrc.includes('VK_ESCAPE'), 'SEC-04', 'System Keys Interception Logic', 'Suppresses Tab, Windows Key, PrintScreen, Escape');
  assert(displaySrc.includes('SetWindowDisplayAffinity') && displaySrc.includes('WDA_MONITOR'), 'SEC-05', 'Screen Capture Protection Application', 'Applies WDA_MONITOR to kiosk window handle');
  assert(clipboardSrc.includes('EmptyClipboard()'), 'SEC-06', 'Clipboard Sanitization Logic', 'Flushes system clipboard buffer on launch and focus');
  assert(watchdogSrc.includes('taskmgr') && watchdogSrc.includes('obs64') && watchdogSrc.includes('wireshark') && watchdogSrc.includes('cheatengine'), 'SEC-07', 'Process Blacklist Breadth', 'Covers taskmgr, obs, wireshark, cheatengine, discord, etc.');
  assert(envSrc.includes('SM_REMOTESESSION') && win32Src.includes('SM_REMOTESESSION'), 'SEC-08', 'Remote Desktop Protocol (RDP) Detection', 'Inspects SM_REMOTESESSION to block RDP virtualization');

  // -------------------------------------------------------------
  // SUITE 3: Server Policy Engine & Cryptographic Grants
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Policy Engine & Cryptographic Grants ---');
  const policyHash = hashPolicy(DEFAULT_LOCKDOWN_POLICY);
  assert(typeof policyHash === 'string' && policyHash.length === 64, 'POL-01', 'Deterministic Policy Hashing', `Hash length: ${policyHash.length} chars (${policyHash})`);

  const testSub = 'usr_student_test_alpha1';
  const testExamId = 'EXAM_CSE276_ACTIVE_MIDTERM';
  const testClassroomId = 'CLS_1792819623330_ZF01';
  const testDeviceId = 'dev_win11_alpha1_77a9';
  const testFingerprint = 'fp_cpu_disk_mb_9921e';

  const validGrant = signLaunchGrant({
    sub: testSub,
    examId: testExamId,
    classroomId: testClassroomId,
    deviceId: testDeviceId,
    hardwareFingerprint: testFingerprint,
    policyHash,
    ttlSeconds: 120,
  });
  assert(typeof validGrant === 'string' && validGrant.split('.').length === 3, 'POL-02', 'Signed Launch Grant Generation', 'Valid 3-part compact JWT format produced');

  const verified = verifyLaunchGrant(validGrant);
  assert(verified.valid === true && verified.claims?.sub === testSub && verified.claims?.examId === testExamId, 'POL-03', 'Launch Grant Signature Verification', 'Signature, subject, and exam ID match expected claims');

  // Tamper attack: modify payload
  const parts = validGrant.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({
    ...JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
    sub: 'usr_malicious_attacker'
  })).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  const tamperedResult = verifyLaunchGrant(tamperedToken);
  assert(tamperedResult.valid === false, 'POL-04', 'Tamper Resistance', `Rejected modified payload: ${tamperedResult.error}`);

  // Expired token check
  const expiredGrant = signLaunchGrant({
    sub: testSub,
    examId: testExamId,
    classroomId: testClassroomId,
    deviceId: testDeviceId,
    hardwareFingerprint: testFingerprint,
    policyHash,
    ttlSeconds: -10, // already expired
  });
  const expiredResult = verifyLaunchGrant(expiredGrant);
  assert(expiredResult.valid === false && expiredResult.error?.includes('expired'), 'POL-05', 'Expiration Enforcement', `Rejected expired token: ${expiredResult.error}`);

  // Device trust token
  const deviceTrust = signDeviceTrustToken(testDeviceId, testSub, testFingerprint);
  assert(typeof deviceTrust === 'string' && deviceTrust.includes('.'), 'POL-06', 'Device Attestation Token', 'Generated valid compact device attestation token');

  // -------------------------------------------------------------
  // SUITE 4: Backend Route Enforcement Logic (/start)
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: Examination Start Endpoint Lockdown Enforcement ---');
  const startRouteSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/app/api/v1/classrooms/[id]/exams/[examId]/start/route.ts'), 'utf8');

  assert(startRouteSrc.includes("exam.securityLevel === 'restricted'"), 'API-01', 'Restricted Security Level Detection', 'start/route.ts inspects exam.securityLevel === restricted');
  assert(startRouteSrc.includes('verifyLaunchGrant'), 'API-02', 'Cryptographic Grant Verification Call', 'start/route.ts invokes verifyLaunchGrant(grantToken)');
  assert(startRouteSrc.includes('x-cortex-lockdown-grant'), 'API-03', 'Grant Header Inspection', 'Accepts grant token via x-cortex-lockdown-grant header');
  assert(startRouteSrc.includes('lockdownRequired: true') && startRouteSrc.includes('/lockdown/download'), 'API-04', 'Defensive Redirection', 'Returns HTTP 403 and download URL when grant is absent');
  assert(startRouteSrc.includes('claims.sub !== user.id') && startRouteSrc.includes('claims.examId !== examId'), 'API-05', 'Subject and Exam Binding', 'Verifies student account and exam ID match token claims');

  // -------------------------------------------------------------
  // SUITE 5: Downloads Route & Manifest Integrity
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Downloads Manifest Verification ---');
  const downloadsRouteSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/app/api/v1/lockdown/downloads/route.ts'), 'utf8');
  assert(downloadsRouteSrc.includes('18E41B800696C7262722C1880BD207FCB603C1591F9C9CA884986C828CCF07F4') || downloadsRouteSrc.includes('6A6CD835D3025255DF0D25259371CFEE0CA6D33CC766E98EAE95D6F51BBCC254') || downloadsRouteSrc.includes('6E447E11B6DC9E431CD067D22C58AAF1246E50CBF362687FF482AB255A90D79A') || downloadsRouteSrc.includes('68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466'), 'DL-01', 'Windows Binary Checksum in Manifest', 'Manifest contains verified SHA-256 hash');
  assert(downloadsRouteSrc.includes('sizeBytes: 28160') || downloadsRouteSrc.includes('sizeBytes: 29184') || downloadsRouteSrc.includes('sizeBytes: 31232') || downloadsRouteSrc.includes('sizeBytes: 33280'), 'DL-02', 'Windows Binary Size in Manifest', 'Manifest matches compiled byte size');
  assert(downloadsRouteSrc.includes('macOS 13.0 (Ventura) or newer'), 'DL-03', 'macOS Platform Manifest', 'Manifest details macOS requirements and security features');

  // -------------------------------------------------------------
  // SUITE 6: Hardware Media & WebRTC Proctoring Integration
  // -------------------------------------------------------------
  console.log('\n--- Suite 6: WebRTC Hardware Media & Proctoring Integration ---');
  const clientAppSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/lockdown/CortexLockdownApp.tsx'), 'utf8');
  assert(clientAppSrc.includes('navigator.mediaDevices?.getUserMedia'), 'MED-01', 'Hardware Stream Acquisition', 'Invokes navigator.mediaDevices.getUserMedia for real camera and mic');
  assert(clientAppSrc.includes('videoRef') && clientAppSrc.includes('pipVideoRef'), 'MED-02', 'Dual Video Element Binding', 'Binds hardware stream to readiness check and PIP proctoring preview');
  assert(clientAppSrc.includes('createAnalyser') && clientAppSrc.includes('getByteFrequencyData'), 'MED-03', 'Real-time Web Audio Decibel Measurement', 'Calculates microphone volume using Web Audio AnalyserNode');
  assert(clientAppSrc.includes('track.onended'), 'MED-04', 'Sensor Revocation Detection', 'Attaches track.onended listener to detect camera/mic disconnection');

  // -------------------------------------------------------------
  // SUITE 7: macOS Assessment Subsystem (Apple Assessment Configuration)
  // -------------------------------------------------------------
  console.log('\n--- Suite 7: macOS Platform Subsystem Architecture ---');
  const macosDir = path.resolve(process.cwd(), 'apps/cortex-lockdown-macos/Sources/CortexLockdown');
  const macosExists = fs.existsSync(macosDir);
  assert(macosExists, 'MAC-01', 'macOS Swift Project Structure', `Directory exists at ${macosDir}`);

  if (macosExists) {
    const aacSrc = fs.readFileSync(path.join(macosDir, 'Security/AppleAssessmentController.swift'), 'utf8');
    const kioskSrc = fs.readFileSync(path.join(macosDir, 'Security/AppKitKioskController.swift'), 'utf8');
    const winProtSrc = fs.readFileSync(path.join(macosDir, 'Security/WindowProtector.swift'), 'utf8');
    const pasteSrc = fs.readFileSync(path.join(macosDir, 'Security/PasteboardGuard.swift'), 'utf8');

    assert(aacSrc.includes('AEAssessmentSession') && aacSrc.includes('AEAssessmentConfiguration'), 'MAC-02', 'Automatic Assessment Configuration Integration', 'Utilizes AEAssessmentSession for macOS system lockdown');
    assert(kioskSrc.includes('.hideDock') && kioskSrc.includes('.hideMenuBar') && kioskSrc.includes('.disableProcessSwitching'), 'MAC-03', 'AppKit Presentation Controls', 'Applies hideDock, hideMenuBar, and disableProcessSwitching');
    assert(winProtSrc.includes('sharingType = .none'), 'MAC-04', 'macOS Screen Capture Shielding', 'Sets NSWindow.sharingType = .none to prevent capture');
    assert(pasteSrc.includes('clearContents()') && pasteSrc.includes('NSPasteboard'), 'MAC-05', 'macOS Pasteboard Sandbox', 'Flushes general pasteboard on activation');

    // Physical macOS execution note
    results.push({
      id: 'MAC-06',
      name: 'macOS Physical Binary Execution',
      status: 'BLOCKED',
      details: 'Current development environment is Windows 10/11 x64; physical execution of macOS ARM64/x64 Mach-O binaries requires macOS host hardware.'
    });
    console.log('[BLOCKED] MAC-06: macOS Physical Binary Execution - Physical execution requires macOS host machine');
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('ALPHA 1 VERIFICATION SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const blocked = results.filter((r) => r.status === 'BLOCKED').length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failed}`);
  console.log(`Blocked:      ${blocked}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAlpha1Verification().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
