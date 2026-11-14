/**
 * Cortex Lockdown Browser — Desktop Kiosk Application Entry Point
 * Implements single-instance lock, custom protocol handler, CLI arguments, and lifecycle.
 * Manages KioskWindowManager coordinating ProcessWatchdog, ScreenGuard, and KeyboardGuard.
 */

import { app, ipcMain } from 'electron';
import { URL } from 'url';
import { isAllowedUrl, DEFAULT_TARGET_URL, PROTOCOL_SCHEME } from '../shared/constants';
import { ParsedLaunchArguments } from '../shared/types';
import { KioskWindowManager } from './kiosk-window';
import type { ProcessWatchdog } from './security/process-watchdog';
import { ConfigManager } from './config/config-loader';

import * as fs from 'fs';
import * as path from 'path';

// Prevent Chromium GPU and disk cache lock errors (cache_util_win.cc 0x5 Access Denied)
app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Immediate process-level exit handler for any renderer exit signal
ipcMain.on('cortex:exit-app', () => {
  if (kioskManager) {
    kioskManager.teardownAndExit();
  } else {
    app.exit(0);
  }
});

const debugLogPath = path.join(app.getPath('userData'), 'cortex_debug.log');
fs.writeFileSync(path.join(__dirname, 'debug.log'), `App launched at ${new Date().toISOString()}\n`);

// 1. Single Instance Lock Enforcement
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  fs.appendFileSync(path.join(__dirname, 'debug.log'), 'Single instance lock rejected. Quitting.\n');
  app.quit();
  process.exit(0);
}

let kioskManager: KioskWindowManager | null = null;

/**
 * Parses protocol URLs (cortex-lockdown://launch?examId=...&grant=...) and CLI arguments.
 */
export function parseLaunchArguments(argv: string[]): ParsedLaunchArguments {
  const config = ConfigManager.getInstance().getConfig();
  let targetUrl = config.exam?.targetUrl || DEFAULT_TARGET_URL;
  let examId = '';
  let launchGrant = '';
  let isProtocolLaunch = false;
  let isWindowed = false;

  for (const arg of argv) {
    const trimmed = arg.trim();

    // Check for custom protocol scheme: cortex-lockdown://
    if (
      trimmed.toLowerCase().startsWith(`${PROTOCOL_SCHEME}://`) ||
      trimmed.toLowerCase().startsWith(`${PROTOCOL_SCHEME}:`)
    ) {
      isProtocolLaunch = true;
      try {
        let uriStr = trimmed;
        if (!uriStr.toLowerCase().startsWith(`${PROTOCOL_SCHEME}://`)) {
          uriStr = `${PROTOCOL_SCHEME}://${uriStr.slice(PROTOCOL_SCHEME.length + 1)}`;
        }
        const parsed = new URL(uriStr);
        const params = parsed.searchParams;

        if (params.get('examId') || params.get('exam-id') || params.get('exam_id')) {
          examId = params.get('examId') || params.get('exam-id') || params.get('exam_id') || '';
        }
        if (params.get('grant') || params.get('launchGrant') || params.get('launch_grant')) {
          launchGrant = params.get('grant') || params.get('launchGrant') || params.get('launch_grant') || '';
        }
        if (params.get('url') || params.get('targetUrl') || params.get('target_url')) {
          const candidateUrl = params.get('url') || params.get('targetUrl') || params.get('target_url') || '';
          if (isAllowedUrl(candidateUrl)) {
            targetUrl = candidateUrl;
          }
        }
      } catch {
        // Fallback to default target
      }
    } else if (trimmed.startsWith('--url=')) {
      const candidateUrl = trimmed.slice(6);
      if (isAllowedUrl(candidateUrl)) {
        targetUrl = candidateUrl;
      }
    } else if (trimmed.startsWith('--exam-id=')) {
      examId = trimmed.slice(10);
    } else if (trimmed.startsWith('--grant=')) {
      launchGrant = trimmed.slice(8);
    } else if (trimmed === '--windowed' || trimmed === '--dev' || trimmed === '-w') {
      isWindowed = true;
    }
  }

  // Append parameters to target URL if present
  if (examId || launchGrant) {
    try {
      const u = new URL(targetUrl);
      if (examId && !u.searchParams.has('examId')) {
        u.searchParams.set('examId', examId);
      }
      if (launchGrant && !u.searchParams.has('launchGrant')) {
        u.searchParams.set('launchGrant', launchGrant);
      }
      targetUrl = u.toString();
    } catch {
      // Use targetUrl as-is
    }
  }

  return { targetUrl, examId, launchGrant, isProtocolLaunch, isWindowed };
}

// 2. Register Custom Protocol Client
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

// 3. Application Lifecycle Handlers
app.whenReady().then(() => {
  try {
    fs.appendFileSync(path.join(__dirname, 'debug.log'), 'app.whenReady resolved\n');
    const launchArgs = parseLaunchArguments(process.argv);
    fs.appendFileSync(path.join(__dirname, 'debug.log'), `launchArgs: ${JSON.stringify(launchArgs)}\n`);

    // Instantiates KioskWindow and registers security guards (ProcessWatchdog, ScreenGuard, KeyboardGuard)
    kioskManager = new KioskWindowManager({
      targetUrl: launchArgs.targetUrl,
      examId: launchArgs.examId,
      launchGrant: launchArgs.launchGrant,
      isWindowed: launchArgs.isWindowed
    });

    fs.appendFileSync(path.join(__dirname, 'debug.log'), 'Calling kioskManager.create()\n');
    kioskManager.create();
    fs.appendFileSync(path.join(__dirname, 'debug.log'), 'kioskManager.create() called successfully\n');
  } catch (err: any) {
    fs.appendFileSync(path.join(__dirname, 'debug.log'), `ERROR in whenReady: ${err?.stack || err}\n`);
  }
}).catch((err: any) => {
  fs.appendFileSync(path.join(__dirname, 'debug.log'), `whenReady rejected: ${err?.stack || err}\n`);
});

// Second instance focus reassertion
app.on('second-instance', (_event, commandLine) => {
  const secondArgs = parseLaunchArguments(commandLine);
  if (kioskManager) {
    // Kiosk is already running; refuse second instance and re-focus
  }
});

process.on('uncaughtException', (err: any) => {
  fs.appendFileSync(path.join(__dirname, 'debug.log'), `UNCAUGHT EXCEPTION: ${err?.stack || err}\n`);
});

process.on('unhandledRejection', (err: any) => {
  fs.appendFileSync(path.join(__dirname, 'debug.log'), `UNHANDLED REJECTION: ${err?.stack || err}\n`);
});

app.on('before-quit', () => {
  fs.appendFileSync(path.join(__dirname, 'debug.log'), 'app before-quit event fired\n');
});

app.on('will-quit', () => {
  fs.appendFileSync(path.join(__dirname, 'debug.log'), 'app will-quit event fired\n');
});

app.on('window-all-closed', () => {
  fs.appendFileSync(path.join(__dirname, 'debug.log'), 'app window-all-closed event fired\n');
  app.quit();
});
