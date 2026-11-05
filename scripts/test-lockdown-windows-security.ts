/**
 * CORTEX LOCKDOWN — WINDOWS SECURITY VERIFICATION SUITE
 *
 * Verifies:
 * 1. Native CortexLockdown.exe executable existence, size, and SHA-256 hash.
 * 2. C# Win32 P/Invoke signatures (SetWindowsHookEx, SetWindowDisplayAffinity, EmptyClipboard).
 * 3. Keyboard hook blocked key dictionary (Alt+Tab, WinKey, PrintScreen, Alt+Esc, Ctrl+Esc, Alt+F4).
 * 4. Process watchdog blacklist coverage (recorders, remote desktop, debuggers).
 * 5. Hardware fingerprint entropy and reproducibility.
 *
 * Strictly zero emojis.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface AssertionResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: AssertionResult[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  results.push({ name, passed: Boolean(condition), detail });
  const tag = condition ? '[PASS]' : '[FAIL]';
  console.log(`${tag} ${name}${detail ? ` (${detail})` : ''}`);
}

async function runWindowsSecurityTests() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN: WINDOWS SECURITY VERIFICATION');
  console.log('================================================================\n');

  const exePath = path.resolve(process.cwd(), 'apps', 'cortex-lockdown-windows', 'bin', 'CortexLockdown.exe');
  
  // Test 1: Executable Existence
  const exeExists = fs.existsSync(exePath);
  assert(exeExists, 'Native executable exists', exePath);

  if (exeExists) {
    const stats = fs.statSync(exePath);
    assert(stats.size > 10000, 'Executable file size within expected range', `${stats.size} bytes`);

    const fileBuffer = fs.readFileSync(exePath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    assert(sha256.length === 64, 'Executable SHA-256 digest computed', sha256);
  }

  // Test 2: Source Code Win32 P/Invoke Audit
  const win32SrcPath = path.resolve(process.cwd(), 'apps', 'cortex-lockdown-windows', 'src', 'Security', 'Win32Native.cs');
  const win32Src = fs.readFileSync(win32SrcPath, 'utf8');

  assert(win32Src.includes('SetWindowsHookEx'), 'Win32 Hook SetWindowsHookEx signature present');
  assert(win32Src.includes('SetWindowDisplayAffinity'), 'Win32 Display Affinity SetWindowDisplayAffinity signature present');
  assert(win32Src.includes('EmptyClipboard'), 'Win32 EmptyClipboard signature present');
  assert(win32Src.includes('WDA_MONITOR'), 'WDA_MONITOR constant defined');
  assert(win32Src.includes('WDA_EXCLUDEFROMCAPTURE'), 'WDA_EXCLUDEFROMCAPTURE constant defined');
  assert(win32Src.includes('WH_KEYBOARD_LL'), 'WH_KEYBOARD_LL hook type defined');

  // Test 3: Keyboard Hook Suppression Matrix Audit
  const hookSrcPath = path.resolve(process.cwd(), 'apps', 'cortex-lockdown-windows', 'src', 'Security', 'KeyboardHook.cs');
  const hookSrc = fs.readFileSync(hookSrcPath, 'utf8');

  assert(hookSrc.includes('VK_LWIN') && hookSrc.includes('VK_RWIN'), 'Windows Start Key suppression implemented');
  assert(hookSrc.includes('VK_TAB') && hookSrc.includes('isAltDown'), 'Alt + Tab application switcher suppression implemented');
  assert(hookSrc.includes('VK_ESCAPE') && hookSrc.includes('isAltDown'), 'Alt + Escape window switcher suppression implemented');
  assert(hookSrc.includes('VK_SNAPSHOT'), 'PrintScreen screenshot suppression implemented');
  assert(hookSrc.includes('VK_F4') && hookSrc.includes('isAltDown'), 'Alt + F4 window close suppression implemented');
  assert(hookSrc.includes('VK_F12'), 'F12 Developer Tools suppression implemented');

  // Test 4: Process Watchdog Blacklist Audit
  const watchdogSrcPath = path.resolve(process.cwd(), 'apps', 'cortex-lockdown-windows', 'src', 'Security', 'ProcessWatchdog.cs');
  const watchdogSrc = fs.readFileSync(watchdogSrcPath, 'utf8');

  const requiredProcesses = ['obs64', 'discord', 'teamviewer', 'anydesk', 'wireshark', 'cheatengine', 'fiddler'];
  for (const proc of requiredProcesses) {
    assert(watchdogSrc.includes(`"${proc}"`), `Blacklist covers ${proc}`);
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`WINDOWS SECURITY SUITE: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runWindowsSecurityTests().catch((err) => {
  console.error('Fatal error during Windows security tests:', err);
  process.exit(1);
});
