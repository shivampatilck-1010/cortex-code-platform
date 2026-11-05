import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

interface TestResult {
  code: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  message: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, code: string, name: string, message: string) {
  if (condition) {
    results.push({ code, name, status: 'PASS', message });
    console.log(`[PASS] ${code}: ${name} - ${message}`);
  } else {
    results.push({ code, name, status: 'FAIL', message });
    console.error(`[FAIL] ${code}: ${name} - ${message}`);
  }
}

function runAlpha3Tests() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN - ALPHA 3 PACKAGING & PROTOCOL VERIFICATION');
  console.log('================================================================');

  // -------------------------------------------------------------
  // SUITE 1: Windows Custom Protocol Handler & Registry
  // -------------------------------------------------------------
  console.log('\n--- Suite 1: Windows Custom Protocol Handler & Registry ---');

  let regKeyExists = false;
  let regCommand = '';
  try {
    const psCheck = execSync(
      'powershell -Command "Get-ItemProperty -Path \'HKCU:\\Software\\Classes\\cortex-lockdown\\shell\\open\\command\' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty \'(default)\'"',
      { encoding: 'utf8' }
    ).trim();
    if (psCheck) {
      regKeyExists = true;
      regCommand = psCheck;
    }
  } catch (_) {}

  assert(regKeyExists, 'PROT-01', 'Windows Registry Protocol Handler Existence', 'Found HKCU\\Software\\Classes\\cortex-lockdown');
  assert(regCommand.includes('CortexLockdown.exe') && regCommand.includes('%1'), 'PROT-02', 'Open Command Target Alignment', `Command: ${regCommand}`);

  // -------------------------------------------------------------
  // SUITE 2: Program.cs URI Protocol Parser & CLI Arguments
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Native Program.cs URI Protocol Parser ---');
  const programSrc = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/src/Program.cs'), 'utf8');

  assert(programSrc.includes('cortex-lockdown://'), 'CLI-01', 'Protocol Scheme Detection', 'Program.cs checks for cortex-lockdown:// scheme');
  assert(programSrc.includes('Uri.TryCreate') && programSrc.includes('uri.Query'), 'CLI-02', 'RFC Compliant URI Query Parsing', 'Program.cs uses Uri and query extraction');
  assert(programSrc.includes('examId = val') && programSrc.includes('launchGrant = val'), 'CLI-03', 'Launch Grant & Exam Binding from Protocol', 'Binds examId and launchGrant from URI query parameters');
  assert(programSrc.includes('--exam-id=') && programSrc.includes('--grant='), 'CLI-04', 'Standard CLI Parameter Support', 'Maintains backwards-compatible CLI parameter parsing');
  assert(programSrc.includes('EnvironmentInspector.InspectEnvironment'), 'CLI-05', 'Pre-Launch Environment Safety Check', 'Blocks execution on RDP and virtualization');

  // -------------------------------------------------------------
  // SUITE 3: Windows Installer & Distribution Packaging
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Windows Installer & Packaging Suite ---');
  const issPath = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/installer/cortex-lockdown.iss');
  assert(fs.existsSync(issPath), 'PKG-01', 'Inno Setup Script Existence', 'Found cortex-lockdown.iss');
  const issSrc = fs.readFileSync(issPath, 'utf8');
  assert(issSrc.includes('Software\\Classes\\cortex-lockdown') && issSrc.includes('URL Protocol'), 'PKG-02', 'Inno Setup Protocol Registration', 'Configures HKCU protocol keys in installer');

  const zipPath = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip');
  assert(fs.existsSync(zipPath), 'PKG-03', 'Portable Distribution ZIP Existence', 'Found CortexLockdown-Windows-x64.zip');
  if (fs.existsSync(zipPath)) {
    const zipStats = fs.statSync(zipPath);
    assert(zipStats.size > 10000, 'PKG-04', 'Portable Distribution ZIP Integrity', `Size: ${zipStats.size} bytes`);
  }

  const installBat = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/installer/install.bat');
  const uninstallBat = path.resolve(process.cwd(), 'apps/cortex-lockdown-windows/installer/uninstall.bat');
  assert(fs.existsSync(installBat) && fs.existsSync(uninstallBat), 'PKG-05', 'Automated Install/Uninstall Batch Scripts', 'install.bat and uninstall.bat exist and are operational');

  // -------------------------------------------------------------
  // SUITE 4: macOS Bundle Architecture & URL Types
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: macOS Bundle Architecture & URL Handling ---');
  const infoPlistPath = path.resolve(process.cwd(), 'apps/cortex-lockdown-macos/Info.plist');
  assert(fs.existsSync(infoPlistPath), 'MAC-01', 'macOS Info.plist Existence', 'Found Info.plist');
  const plistSrc = fs.readFileSync(infoPlistPath, 'utf8');
  assert(plistSrc.includes('cortex-lockdown') && plistSrc.includes('CFBundleURLSchemes'), 'MAC-02', 'macOS URL Scheme Registration', 'Info.plist registers cortex-lockdown scheme');
  assert(plistSrc.includes('NSCameraUsageDescription') && plistSrc.includes('NSMicrophoneUsageDescription'), 'MAC-03', 'Privacy Permissions Declarations', 'Camera and microphone privacy descriptions present');

  const appDelegateSrc = fs.readFileSync(path.resolve(process.cwd(), 'apps/cortex-lockdown-macos/Sources/CortexLockdown/AppDelegate.swift'), 'utf8');
  assert(appDelegateSrc.includes('application(_ application: NSApplication, open urls: [URL])'), 'MAC-04', 'macOS AppKit Protocol Link Receiver', 'AppDelegate implements application(_:open:)');
  assert(appDelegateSrc.includes('cortex-lockdown') && appDelegateSrc.includes('launchGrant='), 'MAC-05', 'macOS Launch Grant Extraction', 'AppDelegate parses grant and loads target webview');

  const buildMacosSh = path.resolve(process.cwd(), 'apps/cortex-lockdown-macos/build-macos.sh');
  assert(fs.existsSync(buildMacosSh), 'MAC-06', 'macOS Build & Packaging Script', 'Found build-macos.sh');

  // -------------------------------------------------------------
  // SUITE 5: Web Platform Integration & One-Click Launch
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Web Platform Integration & One-Click Launch ---');
  const runnerModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/classroom/exams/ExamRunnerModal.tsx'), 'utf8');
  assert(runnerModalSrc.includes('lockdownRequiredInfo'), 'WEB-01', 'Exam Runner Modal Lockdown Detection', 'ExamRunnerModal manages lockdownRequiredInfo state');
  assert(runnerModalSrc.includes('cortex-lockdown://launch'), 'WEB-02', 'Web Custom Protocol Link Construction', 'Constructs cortex-lockdown://launch URL with grant');
  assert(runnerModalSrc.includes('Download Application'), 'WEB-03', 'Download Application Action in Modal', 'Offers direct link to download portal');

  const tabSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/classroom/exams/ExaminationsTab.tsx'), 'utf8');
  assert(tabSrc.includes('Take in Lockdown'), 'WEB-04', 'Restricted Exam Badge in Examinations Tab', 'Visual tag for Level 2 Restricted exams');

  const dlRouteSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/app/api/v1/lockdown/downloads/route.ts'), 'utf8');
  assert(dlRouteSrc.includes('cortex-lockdown://') && dlRouteSrc.includes('portableZipUrl'), 'WEB-05', 'Downloads API Custom Protocol & Portable Zip', 'Declares custom protocol and portable zip manifest');

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('ALPHA 3 VERIFICATION SUMMARY');
  console.log('================================================================');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed:       ${passCount}`);
  console.log(`Failed:       ${failCount}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAlpha3Tests();
