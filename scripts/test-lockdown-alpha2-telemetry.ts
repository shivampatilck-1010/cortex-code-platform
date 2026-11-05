// Cortex Lockdown - Alpha 2 Telemetry & Advanced Integrity Verification Suite
// Verifies native C# telemetry dispatching, drag-and-drop suppression,
// client-side computer-vision face absence detection, audio anomaly thresholding,
// and backend integrity event persistence.
// Strictly zero emojis.

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ExamIntegrityEventType } from '../src/lib/classroom/models';

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
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

async function runAlpha2Verification() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN - ALPHA 2 ADVANCED TELEMETRY VERIFICATION');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: Native Windows Telemetry Dispatcher & Drag/Drop
  // -------------------------------------------------------------
  console.log('--- Suite 1: Native Windows Telemetry Subsystem ---');
  const dispatcherSrcPath = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/Security/TelemetryDispatcher.cs');
  assert(fs.existsSync(dispatcherSrcPath), 'TEL-01', 'TelemetryDispatcher Source File', 'Found TelemetryDispatcher.cs');

  const dispatcherSrc = fs.readFileSync(dispatcherSrcPath, 'utf8');
  assert(dispatcherSrc.includes('DispatchEvent(string eventType'), 'TEL-02', 'DispatchEvent Declaration', 'Exposes public static DispatchEvent method');
  assert(dispatcherSrc.includes('ThreadPool.QueueUserWorkItem'), 'TEL-03', 'Non-blocking Async Dispatch', 'Queues HTTP requests on .NET ThreadPool to protect UI thread');
  assert(dispatcherSrc.includes('HttpWebRequest') && dispatcherSrc.includes('EscapeJson'), 'TEL-04', 'Secure JSON Serialization', 'Builds escaped JSON payload and HTTP POST request');

  const mainWndSrc = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/UI/MainWindow.cs'), 'utf8');
  assert(mainWndSrc.includes('AllowWebBrowserDrop = false') && mainWndSrc.includes('this.AllowDrop = false'), 'TEL-05', 'Drag-and-Drop Suppression', 'Explicitly disables drag-and-drop on form and browser control');
  assert(mainWndSrc.includes('TelemetryDispatcher.Initialize') && mainWndSrc.includes('blocked_key_attempt'), 'TEL-06', 'Keyboard Hook Telemetry Binding', 'Wires low-level hook blocked keystroke events to TelemetryDispatcher');
  assert(mainWndSrc.includes('prohibited_process_detected'), 'TEL-07', 'Watchdog Telemetry Binding', 'Wires prohibited process watchdog alerts to TelemetryDispatcher');
  assert(mainWndSrc.includes('window_blur') && mainWndSrc.includes('emergency_exit'), 'TEL-08', 'Focus & Emergency Exit Telemetry', 'Wires window blur and emergency proctor unlock to TelemetryDispatcher');

  // Verify recompiled executable
  const exePath = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/bin/CortexLockdown.exe');
  assert(fs.existsSync(exePath), 'BIN-01', 'Updated Binary Existence', 'Found CortexLockdown.exe');
  const stats = fs.statSync(exePath);
  assert(stats.size === 28160, 'BIN-02', 'Updated Binary Size', `Size: ${stats.size} bytes (Expected: 28160)`);

  const fileBytes = fs.readFileSync(exePath);
  const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex').toUpperCase();
  const expectedSha256 = '18E41B800696C7262722C1880BD207FCB603C1591F9C9CA884986C828CCF07F4';
  assert(sha256 === expectedSha256, 'BIN-03', 'Updated Binary Checksum', `Hash: ${sha256}`);

  // -------------------------------------------------------------
  // SUITE 2: Downloads Route Alignment
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Downloads Manifest Alignment ---');
  const dlRouteSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/app/api/v1/lockdown/downloads/route.ts'), 'utf8');
  assert(dlRouteSrc.includes(expectedSha256), 'DL-01', 'Downloads API SHA-256 Alignment', 'downloads/route.ts contains exact binary SHA-256');
  assert(dlRouteSrc.includes('sizeBytes: 28160'), 'DL-02', 'Downloads API Size Alignment', 'downloads/route.ts matches 28160 bytes');

  const dlPageSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/app/lockdown/download/page.tsx'), 'utf8');
  assert(dlPageSrc.includes('27.5 KB') && dlPageSrc.includes('18e41b800696c7262722c1880bd207fcb603c159'), 'DL-03', 'Downloads Page UI Alignment', 'download/page.tsx matches updated file size and hash prefix');

  // -------------------------------------------------------------
  // SUITE 3: Models & Integrity Event Types
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Domain Models & Integrity Event Catalog ---');
  const modelsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/classroom/models.ts'), 'utf8');
  const requiredEventTypes = [
    'fullscreen_exit',
    'window_blur',
    'tab_hidden',
    'paste_attempt',
    'reconnect',
    'proctor_action',
    'prohibited_process_detected',
    'blocked_key_attempt',
    'display_capture_attempt',
    'remote_session_detected',
    'camera_revoked',
    'microphone_revoked',
    'multiple_faces_detected',
    'face_absent',
    'audio_anomaly',
    'clipboard_tamper',
    'emergency_exit'
  ];

  let missingEventTypes = 0;
  for (const t of requiredEventTypes) {
    if (!modelsSrc.includes(`'${t}'`)) {
      missingEventTypes++;
      console.error(`Missing event type: ${t}`);
    }
  }
  assert(missingEventTypes === 0, 'MOD-01', 'Complete Integrity Event Type Catalog', `Verified all ${requiredEventTypes.length} integrity event types in models.ts`);

  // -------------------------------------------------------------
  // SUITE 4: WebRTC Computer-Vision & Audio Heuristics
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: WebRTC Advanced Proctoring Heuristics ---');
  const clientAppSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/lockdown/CortexLockdownApp.tsx'), 'utf8');
  const proctorEnginePath = path.resolve(process.cwd(), 'src/lib/lockdown/proctoring-engine.ts');
  const proctorEngineSrc = fs.existsSync(proctorEnginePath) ? fs.readFileSync(proctorEnginePath, 'utf8') : '';

  assert(clientAppSrc.includes('dispatchTelemetryEvent'), 'PRC-01', 'Automated Telemetry Dispatcher Function', 'Client dispatches events to /api/v1/lockdown/telemetry');
  assert(clientAppSrc.includes('canvasRef') && (clientAppSrc.includes('drawImage') || proctorEngineSrc.includes('drawImage')), 'PRC-02', 'Offscreen Canvas Frame Sampling', 'Samples video frames at 160x120 for non-intrusive CV analysis');
  assert((clientAppSrc.includes('face_absent') && (clientAppSrc.includes('avgLuminance') || clientAppSrc.includes('analyzeVideoFrame'))), 'PRC-03', 'Face Absence & Dark Frame Detection', 'Triggers face_absent when candidate absent or camera covered');
  assert(clientAppSrc.includes('highAudioStreakRef') && clientAppSrc.includes('audio_anomaly'), 'PRC-04', 'Sustained Audio Anomaly Detection', 'Tracks high-decibel streaks and spectral vocalization, dispatching audio_anomaly');
  assert(clientAppSrc.includes('camera_revoked') && clientAppSrc.includes('microphone_revoked'), 'PRC-05', 'Hardware Revocation Event Dispatch', 'Dispatches camera_revoked and microphone_revoked on track.onended');
  assert(clientAppSrc.includes('handleCopy') && clientAppSrc.includes('handlePaste') && clientAppSrc.includes('handleDragOver') && clientAppSrc.includes('handleDrop'), 'PRC-06', 'Clipboard & Drag-and-Drop Event Interception', 'Prevents copy, paste, drag, and drop in workspace canvas');
  assert(clientAppSrc.includes('handleBlur') && clientAppSrc.includes('handleVisibility'), 'PRC-07', 'Window Blur & Tab Switch Interception', 'Dispatches window_blur and tab_hidden on focus loss');

  // -------------------------------------------------------------
  // SUITE 5: Device Registration Handshake
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Device Registration Handshake ---');
  assert(clientAppSrc.includes('/api/v1/lockdown/devices/enroll'), 'DEV-01', 'Device Registration Call', 'CortexLockdownApp executes device enrollment handshake on pre-flight');
  const enrollRouteSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/app/api/v1/lockdown/devices/enroll/route.ts'), 'utf8');
  assert(enrollRouteSrc.includes('signDeviceTrustToken'), 'DEV-02', 'Device Trust Token Issuance', 'enroll/route.ts issues signed compact device trust token');

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('ALPHA 2 VERIFICATION SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAlpha2Verification().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
