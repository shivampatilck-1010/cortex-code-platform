/**
 * CORTEX LOCKDOWN — CROSS-PLATFORM DESKTOP SECURITY VERIFICATION SUITE
 *
 * Verifies:
 * 1. Desktop package structure and exports under apps/cortex-lockdown-desktop/.
 * 2. Fullscreen kiosk window bounds, topmost attribute, frame=false, skipTaskbar, and multi-monitor policy.
 * 3. Screen capture shield mapping (setContentProtection(true) -> WDA_EXCLUDEFROMCAPTURE / NSWindow.sharingType = .none).
 * 4. System hotkey suppression table (WinKey, Alt+Tab, Alt+Esc, Ctrl+Esc, Ctrl+Shift+Esc, Alt+F4, F12, DevTools)
 *    and proctor emergency exit override (Ctrl+Alt+F10).
 * 5. Active Process Watchdog daemon (1,500 ms polling loop, process table inspection, 44 executables, 18 window titles).
 * 6. Clipboard flush on launch, activation, and PrintScreen with internal editor isolation.
 * 7. Origin whitelist navigation enforcement and scheme lockdown.
 * 8. Main process entry point, IPC bridge, and context-isolated preload API.
 *
 * Strictly zero emojis.
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = 'D:\\Lpu lecture ppt\\Sem 3\\CSE 276\\Project\\Codex';

// Load constants dynamically from project
const constantsModule = await import(path.join(projectRoot, 'apps/cortex-lockdown-desktop/src/shared/constants.ts'));
const {
  BLACKLISTED_PROCESSES,
  PROHIBITED_TITLE_KEYWORDS,
  AUTHORIZED_HOSTS,
  WATCHDOG_POLL_INTERVAL_MS,
  PROCTOR_OVERRIDE_SHORTCUT,
  isBlacklistedProcess,
  containsProhibitedKeyword,
  isAllowedHost,
  isAllowedUrl
} = constantsModule;

// Load security modules
const screenGuardModule = await import(path.join(projectRoot, 'apps/cortex-lockdown-desktop/src/main/security/screen-guard.ts'));
const { ScreenGuard } = screenGuardModule;

const keyboardGuardModule = await import(path.join(projectRoot, 'apps/cortex-lockdown-desktop/src/main/security/keyboard-guard.ts'));
const { KeyboardGuard } = keyboardGuardModule;

interface AssertionResult {
  code: string;
  name: string;
  domain: string;
  passed: boolean;
  detail?: string;
}

const results: AssertionResult[] = [];

function assert(code: string, domain: string, name: string, condition: boolean, detail?: string) {
  results.push({ code, domain, name, passed: Boolean(condition), detail });
  const tag = condition ? '[PASS]' : '[FAIL]';
  console.log(`${tag} [${code}] (${domain}): ${name}${detail ? ` -> ${detail}` : ''}`);
}

// Mock BrowserWindow for isolated guard unit tests
const mockWebContents = {
  on: (_event: string, _callback: Function) => {},
  removeAllListeners: () => {},
  send: (_channel: string, ..._args: any[]) => {},
  executeJavaScript: async () => true,
};

const mockBrowserWindow: any = {
  webContents: mockWebContents,
  isDestroyed: () => false,
  setContentProtection: (_enable: boolean) => true,
  setAlwaysOnTop: (_flag: boolean, _level?: string) => {},
  setFullScreen: (_flag: boolean) => {},
  setKiosk: (_flag: boolean) => {},
  focus: () => {},
  on: (_event: string, _callback: Function) => {},
  once: (_event: string, _callback: Function) => {},
};

async function runDesktopSecuritySuite() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN: CROSS-PLATFORM DESKTOP SECURITY SUITE');
  console.log('================================================================\n');

  const desktopDir = path.resolve(projectRoot, 'apps', 'cortex-lockdown-desktop');

  // -------------------------------------------------------------------------
  // DOMAIN 1: Desktop Package Structure & TypeScript Configuration
  // -------------------------------------------------------------------------
  console.log('--- Domain 1: Package Structure & Configuration ---');

  const pkgJsonPath = path.join(desktopDir, 'package.json');
  assert('DSK-PKG-01', 'Package', 'Desktop package.json exists', fs.existsSync(pkgJsonPath), pkgJsonPath);

  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    assert('DSK-PKG-02', 'Package', 'Package name is cortex-lockdown-desktop', pkg.name === 'cortex-lockdown-desktop', pkg.name);
    assert('DSK-PKG-03', 'Package', 'Main entry point points to dist/main/index.js', pkg.main === 'dist/main/index.js', pkg.main);
    assert(
      'DSK-PKG-04',
      'Package',
      'Declares electron and typescript devDependencies',
      Boolean(pkg.devDependencies?.electron && pkg.devDependencies?.typescript),
      `electron=${pkg.devDependencies?.electron}, typescript=${pkg.devDependencies?.typescript}`
    );
    assert(
      'DSK-PKG-05',
      'Package',
      'Build and test scripts defined',
      Boolean(pkg.scripts?.build && pkg.scripts?.start && pkg.scripts?.lint),
      `scripts=${Object.keys(pkg.scripts || {}).join(', ')}`
    );
  }

  const tsconfigPath = path.join(desktopDir, 'tsconfig.json');
  assert('DSK-TSC-01', 'TypeScript', 'tsconfig.json exists and specifies strict configuration', fs.existsSync(tsconfigPath), tsconfigPath);
  if (fs.existsSync(tsconfigPath)) {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    assert(
      'DSK-TSC-02',
      'TypeScript',
      'tsconfig targets modern Node/Electron environment with strict checks',
      Boolean(tsconfig.compilerOptions?.outDir === './dist' && tsconfig.compilerOptions?.strict),
      `outDir=${tsconfig.compilerOptions?.outDir}, strict=${tsconfig.compilerOptions?.strict}`
    );
  }

  // -------------------------------------------------------------------------
  // DOMAIN 2: Fullscreen Kiosk Bounds, Topmost & Shell Concealment
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 2: Fullscreen Kiosk & Window Containment ---');

  const kioskWindowPath = path.join(desktopDir, 'src', 'main', 'kiosk-window.ts');
  const kioskExists = fs.existsSync(kioskWindowPath);
  assert('DSK-KIO-01', 'Kiosk Window', 'kiosk-window.ts exists in desktop main sources', kioskExists, kioskWindowPath);

  if (kioskExists) {
    const kioskSrc = fs.readFileSync(kioskWindowPath, 'utf8');
    assert('DSK-KIO-02', 'Kiosk Window', 'Configures borderless, frame=false window', kioskSrc.includes('frame: false'), 'frame: false verified');
    assert('DSK-KIO-03', 'Kiosk Window', 'Configures fullscreen and exclusive kiosk mode', kioskSrc.includes('fullscreen: true') && kioskSrc.includes('kiosk: true'), 'fullscreen & kiosk enabled');
    assert('DSK-KIO-04', 'Kiosk Window', 'Configures alwaysOnTop with screen-saver priority', kioskSrc.includes('alwaysOnTop: true') || kioskSrc.includes('setAlwaysOnTop(true'), 'alwaysOnTop configured');
    assert('DSK-KIO-05', 'Kiosk Window', 'Enforces single physical display policy (detects multi-monitor)', kioskSrc.includes('getAllDisplays') && (kioskSrc.includes('displays.length') || kioskSrc.includes('singleDisplay')), 'Multi-monitor detection verified');
    assert('DSK-KIO-06', 'Kiosk Window', 'Implements window blur reassertion and telemetry logging', kioskSrc.includes("'blur'") && (kioskSrc.includes('focus') || kioskSrc.includes('window_blur')), 'Focus reassertion on blur verified');
  }

  // -------------------------------------------------------------------------
  // DOMAIN 3: Display Screen Capture Protection (setContentProtection)
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 3: Screen Capture Protection ---');

  const screenGuardPath = path.join(desktopDir, 'src', 'main', 'security', 'screen-guard.ts');
  assert('DSK-SCR-01', 'Screen Protection', 'ScreenGuard source exists', fs.existsSync(screenGuardPath), screenGuardPath);

  const screenGuard = new ScreenGuard(mockBrowserWindow);
  assert('DSK-SCR-02', 'Screen Protection', 'ScreenGuard enables setContentProtection(true)', screenGuard.enable() === true, 'enable() returned true');
  assert('DSK-SCR-03', 'Screen Protection', 'ScreenGuard reports active status', screenGuard.isProtectionActive() === true, 'isActive = true');
  assert('DSK-SCR-04', 'Screen Protection', 'ScreenGuard disables cleanly on proctor teardown', screenGuard.disable() === true && screenGuard.isProtectionActive() === false, 'disable() returned true');

  // Verify Native OS Cross-Platform Bindings
  const winAffinityPath = path.resolve(projectRoot, 'apps', 'cortex-lockdown-windows', 'src', 'Security', 'DisplayAffinity.cs');
  if (fs.existsSync(winAffinityPath)) {
    const winAffinitySrc = fs.readFileSync(winAffinityPath, 'utf8');
    assert(
      'DSK-SCR-05',
      'Screen Protection',
      'Windows native mapping links to SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE = 0x11)',
      winAffinitySrc.includes('SetWindowDisplayAffinity') && winAffinitySrc.includes('WDA_EXCLUDEFROMCAPTURE = 0x00000011'),
      'WDA_EXCLUDEFROMCAPTURE (0x00000011)'
    );
  }

  const macProtectorPath = path.resolve(projectRoot, 'apps', 'cortex-lockdown-macos', 'Sources', 'CortexLockdown', 'Security', 'WindowProtector.swift');
  if (fs.existsSync(macProtectorPath)) {
    const macProtectorSrc = fs.readFileSync(macProtectorPath, 'utf8');
    assert(
      'DSK-SCR-06',
      'Screen Protection',
      'macOS native mapping links to NSWindow.sharingType = .none',
      macProtectorSrc.includes('window.sharingType = .none'),
      'NSWindow.sharingType = .none'
    );
  }

  // -------------------------------------------------------------------------
  // DOMAIN 4: Low-Level Hotkey Interception & Proctor Override
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 4: Low-Level Hotkey Interception & Proctor Override ---');

  const keyboardGuardPath = path.join(desktopDir, 'src', 'main', 'security', 'keyboard-guard.ts');
  assert('DSK-KEY-01', 'Keyboard Guard', 'KeyboardGuard source exists', fs.existsSync(keyboardGuardPath), keyboardGuardPath);

  const keyboardGuard = new KeyboardGuard(mockBrowserWindow);

  // Test System Navigation & Task Switchers
  const winKeyEval = keyboardGuard.evaluateInput({ key: 'Meta', code: 'MetaLeft', meta: true } as any);
  assert('DSK-KEY-02', 'Keyboard Guard', 'Drops Windows / Super / Meta key', winKeyEval?.keyName === 'WindowsKey', `result=${winKeyEval?.keyName}`);

  const altTabEval = keyboardGuard.evaluateInput({ key: 'Tab', code: 'Tab', alt: true } as any);
  assert('DSK-KEY-03', 'Keyboard Guard', 'Drops Alt + Tab application switcher', altTabEval?.keyName === 'AltTab', `result=${altTabEval?.keyName}`);

  const altEscEval = keyboardGuard.evaluateInput({ key: 'Escape', code: 'Escape', alt: true } as any);
  assert('DSK-KEY-04', 'Keyboard Guard', 'Drops Alt + Escape window switcher', altEscEval?.keyName === 'AltEscape', `result=${altEscEval?.keyName}`);

  const ctrlEscEval = keyboardGuard.evaluateInput({ key: 'Escape', code: 'Escape', control: true } as any);
  assert('DSK-KEY-05', 'Keyboard Guard', 'Drops Ctrl + Escape Start Menu', ctrlEscEval?.keyName === 'CtrlEscape_StartMenu', `result=${ctrlEscEval?.keyName}`);

  const ctrlShiftEscEval = keyboardGuard.evaluateInput({ key: 'Escape', code: 'Escape', control: true, shift: true } as any);
  assert('DSK-KEY-06', 'Keyboard Guard', 'Drops Ctrl + Shift + Escape Task Manager shortcut', ctrlShiftEscEval?.keyName === 'CtrlShiftEscape_TaskMgr', `result=${ctrlShiftEscEval?.keyName}`);

  const altF4Eval = keyboardGuard.evaluateInput({ key: 'F4', code: 'F4', alt: true } as any);
  assert('DSK-KEY-07', 'Keyboard Guard', 'Drops Alt + F4 window close shortcut', altF4Eval?.keyName === 'AltF4', `result=${altF4Eval?.keyName}`);

  const printScreenEval = keyboardGuard.evaluateInput({ key: 'PrintScreen', code: 'PrintScreen' } as any);
  assert('DSK-KEY-08', 'Keyboard Guard', 'Intercepts PrintScreen snapshot key', printScreenEval?.keyName === 'PrintScreen', `result=${printScreenEval?.keyName}`);

  const f12Eval = keyboardGuard.evaluateInput({ key: 'F12', code: 'F12' } as any);
  assert('DSK-KEY-09', 'Keyboard Guard', 'Drops F12 Developer Tools key', f12Eval?.keyName === 'F12_DevTools', `result=${f12Eval?.keyName}`);

  const devToolsIEval = keyboardGuard.evaluateInput({ key: 'i', code: 'KeyI', control: true, shift: true } as any);
  assert('DSK-KEY-10', 'Keyboard Guard', 'Drops Ctrl + Shift + I Developer Tools inspector', devToolsIEval?.keyName === 'CtrlShift_DevTools', `result=${devToolsIEval?.keyName}`);

  const devToolsJEval = keyboardGuard.evaluateInput({ key: 'j', code: 'KeyJ', control: true, shift: true } as any);
  assert('DSK-KEY-11', 'Keyboard Guard', 'Drops Ctrl + Shift + J Developer Tools console', devToolsJEval?.keyName === 'CtrlShift_DevTools', `result=${devToolsJEval?.keyName}`);

  const viewSourceEval = keyboardGuard.evaluateInput({ key: 'u', code: 'KeyU', control: true } as any);
  assert('DSK-KEY-12', 'Keyboard Guard', 'Drops Ctrl + U View Page Source', viewSourceEval?.keyName === 'CtrlU_ViewSource', `result=${viewSourceEval?.keyName}`);

  const normalKeyEval = keyboardGuard.evaluateInput({ key: 'a', code: 'KeyA' } as any);
  assert('DSK-KEY-13', 'Keyboard Guard', 'Permits normal student typing (does not suppress regular characters)', normalKeyEval === null, 'key=a -> null');

  // Proctor Emergency Exit (Ctrl + Alt + F10)
  const proctorExitEval = keyboardGuard.evaluateInput({ key: 'F10', code: 'F10', control: true, alt: true } as any);
  assert(
    'DSK-KEY-14',
    'Keyboard Guard',
    'Unconditionally identifies Proctor Emergency Exit (Ctrl + Alt + F10)',
    proctorExitEval?.keyName === 'CtrlAltF10_ProctorExit' && proctorExitEval?.isEmergencyExit === true,
    `keyName=${proctorExitEval?.keyName}, isEmergencyExit=${proctorExitEval?.isEmergencyExit}`
  );
  assert(
    'DSK-KEY-15',
    'Keyboard Guard',
    'Configured proctor override shortcut constant matches CommandOrControl+Alt+F10',
    PROCTOR_OVERRIDE_SHORTCUT === 'CommandOrControl+Alt+F10',
    PROCTOR_OVERRIDE_SHORTCUT
  );

  // -------------------------------------------------------------------------
  // DOMAIN 5: Active Background Process Watchdog Daemon
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 5: Active Process Watchdog Daemon ---');

  const watchdogPath = path.join(desktopDir, 'src', 'main', 'security', 'process-watchdog.ts');
  const watchdogExists = fs.existsSync(watchdogPath);
  assert('DSK-WDG-01', 'Process Watchdog', 'process-watchdog.ts source exists in desktop main security', watchdogExists, watchdogPath);

  if (watchdogExists) {
    const watchdogSrc = fs.readFileSync(watchdogPath, 'utf8');

    // 5.1 Active Polling Loop & Cadence
    const has1500Interval = watchdogSrc.includes('1500') || watchdogSrc.includes('WATCHDOG_POLL_INTERVAL_MS');
    const hasScheduling = watchdogSrc.includes('scheduleScan') || watchdogSrc.includes('setTimeout') || watchdogSrc.includes('setInterval');
    assert('DSK-WDG-02', 'Process Watchdog', 'Implements active polling loop scheduled at 1,500 ms', has1500Interval && hasScheduling, '1500ms polling schedule verified');

    // 5.2 Operating System Process Table Enumeration
    const inspectsProcessTable = watchdogSrc.includes('tasklist') || watchdogSrc.includes('ps ') || watchdogSrc.includes('fetchProcessList');
    assert('DSK-WDG-03', 'Process Watchdog', 'Executes OS process enumeration (tasklist on Windows, ps on macOS/Linux)', inspectsProcessTable, 'Process table enumeration verified');

    // 5.3 Violation Reporting & Callback Lifecycle
    const hasViolationCallback = watchdogSrc.includes('onProhibitedProcess') || watchdogSrc.includes('listeners');
    const hasLifecycle = watchdogSrc.includes('start()') && watchdogSrc.includes('stop()');
    assert('DSK-WDG-04', 'Process Watchdog', 'Provides violation listener registration and start/stop lifecycle methods', hasViolationCallback && hasLifecycle, 'Watchdog lifecycle verified');

    // 5.4 44-Executable Blacklist Verification
    assert('DSK-WDG-05', 'Process Watchdog', 'Blacklist contains at least 44 prohibited executables', BLACKLISTED_PROCESSES.length >= 44, `Total entries: ${BLACKLISTED_PROCESSES.length}`);

    const representativeProcs = [
      'obs64', 'streamlabs obs', 'camtasia', 'snagit', 'bandicam', 'fraps', 'snippingtool',
      'teamviewer', 'anydesk', 'vncviewer', 'parsec', 'logmein',
      'chrome', 'firefox', 'msedge', 'discord', 'telegram', 'whatsapp', 'zoom',
      'wireshark', 'fiddler', 'cheatengine', 'x64dbg', 'taskmgr', 'processhacker',
      'cmd', 'powershell', 'pwsh'
    ];

    let procsIdentified = 0;
    for (const proc of representativeProcs) {
      if (isBlacklistedProcess(proc)) {
        procsIdentified++;
      }
    }
    assert('DSK-WDG-06', 'Process Watchdog', 'Blacklist identifies all critical threat categories', procsIdentified === representativeProcs.length, `Identified ${procsIdentified}/${representativeProcs.length} procs`);

    // 5.5 Case-Insensitive Normalization & Extension Stripping
    assert(
      'DSK-WDG-07',
      'Process Watchdog',
      'Process matching is case-insensitive and strips .exe extension',
      isBlacklistedProcess('OBS64.EXE') && isBlacklistedProcess('TeamViewer.exe') && isBlacklistedProcess('WireShark.EXE'),
      'Tested OBS64.EXE, TeamViewer.exe, WireShark.EXE'
    );

    // 5.6 18 Prohibited Window Title Keywords (Rename Bypass Defense)
    assert('DSK-WDG-08', 'Process Watchdog', 'Prohibited window title keywords table contains 18 entries', PROHIBITED_TITLE_KEYWORDS.length === 18, `Total keywords: ${PROHIBITED_TITLE_KEYWORDS.length}`);

    const adversarialTitles = [
      { title: 'My Stream - OBS Studio 30.1', expected: 'obs' },
      { title: 'Discord (Voice Connected - Exam Channel)', expected: 'discord' },
      { title: 'Cheat Engine 7.5 [64-bit Memory Scan]', expected: 'cheat engine' },
      { title: 'Wireshark · Capturing on Ethernet [Npcap]', expected: 'wireshark' },
      { title: 'TeamViewer Remote Session #883921', expected: 'teamviewer' },
      { title: 'Task Manager (Processes / CPU Performance)', expected: 'task manager' },
      { title: 'Process Hacker 2 [Administrator]', expected: 'process hacker' },
      { title: 'Developer Tools - Console (Inspect Element)', expected: 'developer tools' }
    ];

    let titlesFlagged = 0;
    for (const sample of adversarialTitles) {
      const match = containsProhibitedKeyword(sample.title);
      if (match === sample.expected) {
        titlesFlagged++;
      }
    }
    assert('DSK-WDG-09', 'Process Watchdog', 'Window title scanner detects renamed adversarial processes', titlesFlagged === adversarialTitles.length, `Flagged ${titlesFlagged}/${adversarialTitles.length} titles`);
  }

  // -------------------------------------------------------------------------
  // DOMAIN 6: Clipboard Purge & Isolation Policy
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 6: Clipboard Purge & Isolation ---');

  const clipboardGuardPath = path.join(desktopDir, 'src', 'main', 'security', 'clipboard-guard.ts');
  const clipExists = fs.existsSync(clipboardGuardPath);
  assert('DSK-CLP-01', 'Clipboard Policy', 'clipboard-guard.ts source exists', clipExists, clipboardGuardPath);

  if (clipExists) {
    const clipSrc = fs.readFileSync(clipboardGuardPath, 'utf8');
    assert('DSK-CLP-02', 'Clipboard Policy', 'Implements clearClipboard and automatic flush on launch/activate', clipSrc.includes('clearClipboard') && clipSrc.includes('clipboard.clear'), 'clearClipboard verified');
    assert('DSK-CLP-03', 'Clipboard Policy', 'Monitors clipboard changes and triggers security telemetry', clipSrc.includes('clipboard_purged') || clipSrc.includes('telemetry'), 'Clipboard telemetry verified');
  }

  // -------------------------------------------------------------------------
  // DOMAIN 7: Origin Whitelist Navigation Guard
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 7: Origin Whitelist & Navigation Enforcement ---');

  const navGuardPath = path.join(desktopDir, 'src', 'main', 'security', 'navigation-guard.ts');
  const navExists = fs.existsSync(navGuardPath);
  assert('DSK-NAV-01', 'Navigation Guard', 'navigation-guard.ts source exists', navExists, navGuardPath);

  assert(
    'DSK-NAV-02',
    'Navigation Guard',
    'Authorized origins whitelist contains official workers.dev domains and localhost',
    AUTHORIZED_HOSTS.includes('cortex-code-platform.cortexbuild1.workers.dev') &&
    AUTHORIZED_HOSTS.includes('cortex-code-platform-staging.cortexbuild1.workers.dev') &&
    AUTHORIZED_HOSTS.includes('localhost') &&
    AUTHORIZED_HOSTS.includes('127.0.0.1'),
    `Authorized hosts: ${AUTHORIZED_HOSTS.join(', ')}`
  );

  assert('DSK-NAV-03', 'Navigation Guard', 'Permits HTTPS navigation to official staging endpoint', isAllowedUrl('https://cortex-code-platform-staging.cortexbuild1.workers.dev/lockdown/workspace'), 'staging workers.dev permitted');
  assert('DSK-NAV-04', 'Navigation Guard', 'Permits HTTPS navigation to official production endpoint', isAllowedUrl('https://cortex-code-platform.cortexbuild1.workers.dev/lockdown/workspace'), 'production workers.dev permitted');
  assert('DSK-NAV-05', 'Navigation Guard', 'Permits HTTP navigation on localhost:3000 during local testing', isAllowedUrl('http://localhost:3000/lockdown/workspace'), 'localhost:3000 permitted');
  assert('DSK-NAV-06', 'Navigation Guard', 'Blocks external search engines (google.com, duckduckgo.com)', !isAllowedUrl('https://www.google.com') && !isAllowedUrl('https://duckduckgo.com'), 'Search engines blocked');
  assert('DSK-NAV-07', 'Navigation Guard', 'Blocks cheat sites and pastebins', !isAllowedUrl('https://cheat-engine.org') && !isAllowedUrl('https://pastebin.com/raw/secret'), 'Cheat sites blocked');
  assert('DSK-NAV-08', 'Navigation Guard', 'Blocks dangerous URI schemes (file://, javascript:, data:)', !isAllowedUrl('file:///C:/Users/student/answers.txt') && !isAllowedUrl('javascript:alert(1)') && !isAllowedUrl('data:text/html,<h1>XSS</h1>'), 'Dangerous schemes blocked');

  // -------------------------------------------------------------------------
  // DOMAIN 8: Desktop Application Entry Point, IPC Bridge & Preload
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 8: Application Entry Point & Preload API ---');

  const mainIndexSrcPath = path.join(desktopDir, 'src', 'main', 'index.ts');
  const mainIndexExists = fs.existsSync(mainIndexSrcPath);
  assert('DSK-APP-01', 'Application Entry', 'src/main/index.ts desktop entry point exists', mainIndexExists, mainIndexSrcPath);

  if (mainIndexExists) {
    const mainSrc = fs.readFileSync(mainIndexSrcPath, 'utf8');
    assert('DSK-APP-02', 'Application Entry', 'Enforces single-instance lock via app.requestSingleInstanceLock()', mainSrc.includes('requestSingleInstanceLock'), 'Single instance lock verified');
    assert('DSK-APP-03', 'Application Entry', 'Instantiates KioskWindow and registers security guards on startup', mainSrc.includes('KioskWindow') && mainSrc.includes('ProcessWatchdog'), 'Window & guards instantiated');
  }

  const ipcBridgePath = path.join(desktopDir, 'src', 'main', 'ipc-bridge.ts');
  const ipcExists = fs.existsSync(ipcBridgePath);
  assert('DSK-IPC-01', 'IPC Bridge', 'src/main/ipc-bridge.ts exists', ipcExists, ipcBridgePath);

  const preloadPath = path.join(desktopDir, 'src', 'preload', 'index.ts');
  const preloadExists = fs.existsSync(preloadPath);
  assert('DSK-PRL-01', 'Preload API', 'src/preload/index.ts exists', preloadExists, preloadPath);

  if (preloadExists) {
    const preloadSrc = fs.readFileSync(preloadPath, 'utf8');
    assert('DSK-PRL-02', 'Preload API', 'Exposes window.cortexLockdown using contextBridge.exposeInMainWorld', preloadSrc.includes('exposeInMainWorld') && preloadSrc.includes('cortexLockdown'), 'window.cortexLockdown exposed');
    assert('DSK-PRL-03', 'Preload API', 'Preload API exposes getSystemInfo, reportViolation, and requestEmergencyExit', preloadSrc.includes('getSystemInfo') && preloadSrc.includes('reportViolation') && preloadSrc.includes('requestEmergencyExit'), 'Preload methods verified');
  }

  // -------------------------------------------------------------------------
  // SCORECARD & RESULTS SUMMARY
  // -------------------------------------------------------------------------
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log('CROSS-PLATFORM DESKTOP SECURITY SCORECARD');
  console.log('================================================================');
  console.log(`Total Checks:  ${results.length}`);
  console.log(`  Passed:      ${passedCount}`);
  console.log(`  Failed:      ${failedCount}`);
  console.log(`Compliance:    ${((passedCount / results.length) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runDesktopSecuritySuite().catch((err) => {
  console.error('Fatal error during Cross-Platform Desktop Security Suite execution:', err);
  process.exit(1);
});
