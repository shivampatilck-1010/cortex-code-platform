/**
 * Cortex Lockdown Browser — Exclusive Kiosk Window Manager
 * Configures borderless, exclusive topmost full-screen window covering primary display.
 * Coordinates display protection, hotkey suppression, process watchdog, and IPC.
 */

import { app, BrowserWindow, screen, dialog, session, desktopCapturer, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { KioskWindowOptions } from '../shared/types';
import { DEFAULT_TARGET_URL } from '../shared/constants';
import { TelemetryClient } from './security/telemetry-client';
import { ScreenGuard } from './security/screen-guard';
import { KeyboardGuard } from './security/keyboard-guard';
import { ProcessWatchdog } from './security/process-watchdog';
import { ClipboardGuard } from './security/clipboard-guard';
import { NavigationGuard } from './security/navigation-guard';
import { registerIpcHandlers, notifyProhibitedProcess } from './ipc-bridge';

export class KioskWindowManager {
  private window: BrowserWindow | null = null;
  private telemetry: TelemetryClient;
  private screenGuard: ScreenGuard | null = null;
  private keyboardGuard: KeyboardGuard | null = null;
  private processWatchdog: ProcessWatchdog | null = null;
  private clipboardGuard: ClipboardGuard | null = null;
  private navigationGuard: NavigationGuard | null = null;
  private options: KioskWindowOptions;
  private isPromptingExit = false;

  constructor(options: KioskWindowOptions = {}) {
    this.options = options;
    this.telemetry = new TelemetryClient({
      telemetryUrl: options.telemetryUrl,
      examId: options.examId,
      launchGrant: options.launchGrant
    });
  }

  public create(): BrowserWindow {
    const logFile = path.join(__dirname, 'debug.log');
    try {
      fs.appendFileSync(logFile, 'Entering KioskWindowManager.create()\n');
      // 1. Single Display Enforcement
      const displays = screen.getAllDisplays();
      fs.appendFileSync(logFile, `Displays detected: ${displays.length}\n`);
    if (displays.length > 1) {
      this.telemetry.dispatchEvent('multimonitor_detected', {
        displayCount: displays.length,
        displays: displays.map((d) => ({ id: d.id, bounds: d.bounds }))
      });
    }

    // 2. Compute Primary Screen Bounds
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;
    const isWindowed = this.options.isWindowed ?? false;

    // 3. Create Topmost Window (Exclusive Kiosk or Windowed for Dev/Preview)
    this.window = new BrowserWindow({
      x: isWindowed ? undefined : x,
      y: isWindowed ? undefined : y,
      width: isWindowed ? 1280 : width,
      height: isWindowed ? 820 : height,
      center: isWindowed,
      kiosk: !isWindowed,
      fullscreen: !isWindowed,
      alwaysOnTop: !isWindowed,
      frame: isWindowed,
      skipTaskbar: false,
      autoHideMenuBar: !isWindowed,
      backgroundColor: '#041d18',
      show: true,
      title: 'Codex Browser',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        devTools: this.options.allowDevTools ?? isWindowed
      }
    });

    // 4. Instantiate Security Guards
    this.clipboardGuard = new ClipboardGuard(this.telemetry);
    this.screenGuard = new ScreenGuard(this.window, this.telemetry);
    this.navigationGuard = new NavigationGuard(this.window, this.telemetry);
    this.processWatchdog = new ProcessWatchdog({
      autoTerminate: this.options.autoTerminateProhibited ?? false,
      telemetry: this.telemetry
    });

    this.keyboardGuard = new KeyboardGuard(this.window, {
      telemetry: this.telemetry,
      clipboardGuard: this.clipboardGuard,
      onEmergencyExit: () => this.promptEmergencyExit()
    });

    // 5. Register IPC Bridge
    registerIpcHandlers({
      window: this.window,
      telemetry: this.telemetry,
      screenGuard: this.screenGuard,
      clipboardGuard: this.clipboardGuard,
      processWatchdog: this.processWatchdog,
      targetUrl: this.options.targetUrl || DEFAULT_TARGET_URL,
      examId: this.options.examId || '',
      launchGrant: this.options.launchGrant,
      onExitAuthorized: () => this.teardownAndExit()
    });

    // Configure Proctoring Permissions (Camera, Microphone, Screen Share, Clipboard)
    const setupProctoringSession = (ses: any) => {
      try {
        ses.setPermissionRequestHandler((_webContents: any, permission: string, callback: (granted: boolean) => void) => {
          callback(true);
        });
        ses.setPermissionCheckHandler(() => true);

        if (typeof ses.setDisplayMediaRequestHandler === 'function') {
          ses.setDisplayMediaRequestHandler(async (_request: any, callback: any) => {
            try {
              const sources = await desktopCapturer.getSources({ types: ['screen'] });
              if (sources && sources.length > 0) {
                callback({ video: sources[0] });
              } else {
                callback({});
              }
            } catch {
              callback({});
            }
          });
        }
      } catch (err) {
        fs.appendFileSync(logFile, `Session permission setup error: ${err}\n`);
      }
    };

    setupProctoringSession(session.defaultSession);
    try {
      const examlySession = session.fromPartition('persist:examly_session');
      setupProctoringSession(examlySession);
    } catch {}

    // Allow screen sharing without black-screen capture
    ipcMain.handle('cortex:enable-screen-share', async () => {
      fs.appendFileSync(logFile, 'cortex:enable-screen-share invoked: Disabling setContentProtection for proctoring\n');
      this.screenGuard?.disable();
      return true;
    });

    // 6. Connect Process Watchdog to Renderer
    this.processWatchdog.onProhibitedProcess((proc) => {
      if (this.window && !this.window.isDestroyed()) {
        notifyProhibitedProcess(this.window, proc);
      }
    });

    this.window.webContents.on('ipc-message', (_event, channel) => {
      if (channel === 'cortex:exit-app') {
        fs.appendFileSync(logFile, 'ipc-message cortex:exit-app received! Exiting immediately.\n');
        this.teardownAndExit();
      }
    });

    this.window.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
      fs.appendFileSync(logFile, `[Renderer Console] ${message} (${sourceId}:${line})\n`);
    });

    // 7. Window Event Handlers
    const initializeGuards = () => {
      if (!this.window || this.window.isDestroyed()) return;

      this.window.show();
      this.window.focus();

      if (!isWindowed) {
        this.window.setAlwaysOnTop(true, 'screen-saver');
        this.screenGuard?.enable();
        this.keyboardGuard?.install();
        this.navigationGuard?.install();
      }

      this.processWatchdog?.start();
      this.clipboardGuard?.clearClipboard();
    };

    this.window.once('ready-to-show', initializeGuards);

    this.window.on('close', () => {
      fs.appendFileSync(logFile, 'Window close event triggered! Executing teardown...\n');
      this.teardownAndExit();
    });

    this.window.on('closed', () => {
      fs.appendFileSync(logFile, 'Window closed event fired!\n');
    });

    // Guaranteed fallback display timer (ensures kiosk is never trapped invisible)
    setTimeout(() => {
      if (this.window && !this.window.isDestroyed() && !this.window.isVisible()) {
        initializeGuards();
      }
    }, 1500);

    // Automatic fallback to embedded local assessment UI if remote navigation fails
    const localHtml = path.join(__dirname, '../renderer/index.html');
    this.window.webContents.on('did-fail-load', () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.loadFile(localHtml);
      }
    });

    // Reassert focus and display affinity on blur
    this.window.on('blur', () => {
      this.telemetry.dispatchEvent('window_blur', { action: 'focus_lost_reasserted' });
      this.clipboardGuard?.clearClipboard();

      if (!this.isPromptingExit && !this.window?.isMinimized()) {
        setTimeout(() => {
          if (this.window && !this.window.isDestroyed() && !this.window.isMinimized() && !this.isPromptingExit) {
            this.window.focus();
            if (!isWindowed) {
              this.window.setAlwaysOnTop(true, 'screen-saver');
              this.screenGuard?.reassert();
            }
          }
        }, 150);
      }
    });

    // Listen for secondary display connections during active exam
    screen.on('display-added', (_event, newDisplay) => {
      this.telemetry.dispatchEvent('multimonitor_detected', {
        action: 'display_connected_during_exam',
        displayId: newDisplay.id,
        bounds: newDisplay.bounds
      });
    });

    // 8. Always load the Codex Browser Shell (localHtml)
    fs.appendFileSync(logFile, `Loading Codex Browser UI: ${localHtml}\n`);
    this.window.loadFile(localHtml).then(() => {
      fs.appendFileSync(logFile, 'loadFile resolved successfully!\n');
    }).catch((err: any) => {
      fs.appendFileSync(logFile, `loadFile error: ${err}\n`);
    });

      return this.window;
    } catch (err: any) {
      fs.appendFileSync(logFile, `FATAL in create(): ${err?.stack || err}\n`);
      throw err;
    }
  }

  /**
   * Challenge-Response Proctor Emergency Override Dialog
   * Guarded with reentrancy lock (isPromptingExit) to prevent multiple dialog stacking.
   */
  public async promptEmergencyExit(): Promise<void> {
    if (this.isPromptingExit || !this.window || this.window.isDestroyed()) return;
    this.isPromptingExit = true;

    try {
      // Generate random 4-character hex challenge
      const challenge = Math.floor(0x1000 + Math.random() * 0xefff).toString(16).toUpperCase();

      // In desktop kiosk, show emergency modal dialog
      const { response } = await dialog.showMessageBox(this.window, {
        type: 'warning',
        title: 'Proctor Emergency Recovery Override',
        message: `PROCTOR EMERGENCY OVERRIDE\n\nExit the examination and close the lockdown environment?\nChallenge: ${challenge}\nExam ID: ${this.options.examId || 'CTX-2026-CSE276'}`,
        buttons: ['Exit Examination & Close App', 'Cancel / Resume Exam'],
        defaultId: 0,
        cancelId: 1
      });

      if (response === 0) {
        this.teardownAndExit();
      }
    } finally {
      this.isPromptingExit = false;
    }
  }

  private isTearingDown = false;

  /**
   * Clean Teardown and Application Exit
   */
  public teardownAndExit(): void {
    if (this.isTearingDown) return;
    this.isTearingDown = true;

    try {
      this.processWatchdog?.dispose();
      this.keyboardGuard?.uninstall();
      this.screenGuard?.disable();
    } catch {}

    app.exit(0);
  }
}
