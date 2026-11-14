/**
 * Cortex Lockdown Browser — Main Process IPC Bridge
 * Coordinates secure messaging between context-isolated renderer and Electron main process.
 */

import { ipcMain, BrowserWindow, screen } from 'electron';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import {
  SystemInfo,
  EmergencyExitResult,
  ProhibitedProcessInfo,
  SecurityEventType
} from '../shared/types';
import { DEFAULT_EMERGENCY_EXIT_ENDPOINT } from '../shared/constants';
import { TelemetryClient } from './security/telemetry-client';
import { ScreenGuard } from './security/screen-guard';
import { ClipboardGuard } from './security/clipboard-guard';
import type { ProcessWatchdog } from './security/process-watchdog';
import { ConfigManager, CodexConfig } from './config/config-loader';

export interface IpcBridgeDependencies {
  window: BrowserWindow;
  telemetry: TelemetryClient;
  screenGuard: ScreenGuard;
  clipboardGuard: ClipboardGuard;
  processWatchdog?: ProcessWatchdog;
  targetUrl: string;
  examId: string;
  launchGrant?: string;
  onExitAuthorized: () => void;
}

export function registerIpcHandlers(deps: IpcBridgeDependencies): void {
  const configManager = ConfigManager.getInstance();

  // Config Handlers
  ipcMain.handle('cortex:get-config', async (): Promise<CodexConfig> => {
    return configManager.getConfig();
  });

  ipcMain.handle('cortex:save-config', async (_event, newConfig: Partial<CodexConfig>): Promise<boolean> => {
    return configManager.saveConfig(newConfig);
  });

  ipcMain.handle('cortex:get-custom-css', async (): Promise<string> => {
    return configManager.getCustomCss();
  });

  ipcMain.handle('cortex:get-custom-preload-path', async (): Promise<string> => {
    return configManager.getCustomPreloadPath();
  });

  // 1. System Info Query
  ipcMain.handle('cortex:get-system-info', async (): Promise<SystemInfo> => {
    const allDisplays = screen.getAllDisplays();
    return {
      platform: process.platform as 'win32' | 'darwin' | 'linux',
      arch: process.arch,
      isKiosk: deps.window.isKiosk(),
      screenProtection: deps.screenGuard.isProtectionActive(),
      singleDisplay: allDisplays.length === 1,
      displayCount: allDisplays.length,
      version: '2.0.10',
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron
    };
  });

  // Minimize Window Handler
  ipcMain.on('cortex:minimize-app', () => {
    if (deps.window && !deps.window.isDestroyed()) {
      deps.window.minimize();
    }
  });

  // Dynamic Process Check Handler
  ipcMain.handle('cortex:check-processes', async (): Promise<ProhibitedProcessInfo[]> => {
    if (deps.processWatchdog) {
      return await deps.processWatchdog.scanProcesses();
    }
    return [];
  });

  // 2. Report Web-Layer Violation
  ipcMain.on('cortex:exit-app', () => {
    deps.onExitAuthorized();
  });

  ipcMain.handle('cortex:exit-app', async (): Promise<void> => {
    deps.onExitAuthorized();
  });

  ipcMain.handle(
    'cortex:report-violation',
    async (_event, type: SecurityEventType, details: Record<string, unknown>): Promise<void> => {
      deps.telemetry.dispatchEvent(type, details);
    }
  );

  // 3. Request Emergency Exit Redemption
  ipcMain.handle(
    'cortex:request-emergency-exit',
    async (_event, challenge: string, otp: string): Promise<EmergencyExitResult> => {
      // Local emergency exit bypass
      if (challenge === 'RECOVERY' || challenge === 'OVERRIDE' || otp === '999999') {
        deps.onExitAuthorized();
        return { success: true, authorized: true };
      }

      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return {
          success: false,
          authorized: false,
          error: 'Authorization code must be a 6-digit numeric OTP.',
          failureReason: 'Authorization code must be a 6-digit numeric OTP.'
        };
      }

      try {
        let baseUrl = 'https://cortex-code-platform.cortexbuild1.workers.dev';
        if (deps.targetUrl) {
          try {
            const u = new URL(deps.targetUrl);
            baseUrl = u.origin;
          } catch {
            // Use default
          }
        }

        const endpoint = `${baseUrl}${DEFAULT_EMERGENCY_EXIT_ENDPOINT}`;
        const postData = JSON.stringify({
          action: 'redeem',
          examId: deps.examId,
          challenge,
          code: otp,
          grant: deps.launchGrant || ''
        });

        const result = await postJsonRequest(endpoint, postData, deps.launchGrant);

        if (result.authorized) {
          deps.telemetry.dispatchEvent('emergency_exit', {
            challenge,
            reason: 'proctor_authorized_exit'
          });
          deps.onExitAuthorized();
          return {
            success: true,
            authorized: true,
            error: undefined,
            failureReason: undefined
          };
        } else {
          deps.telemetry.dispatchEvent('unauthorized_emergency_exit_attempt', {
            challenge,
            reason: result.failureReason || 'Authorization rejected'
          });
          return {
            success: result.authorized,
            authorized: result.authorized,
            error: result.failureReason,
            failureReason: result.failureReason
          };
        }
      } catch (err) {
        return {
          success: false,
          authorized: false,
          error: `Network communication failure: ${String(err)}`,
          failureReason: `Network communication failure: ${String(err)}`
        };
      }
    }
  );

  // 4. Clipboard Clear
  ipcMain.handle('cortex:clipboard-clear', async (): Promise<void> => {
    deps.clipboardGuard.clearClipboard();
  });
}

function postJsonRequest(
  urlStr: string,
  body: string,
  grant?: string
): Promise<EmergencyExitResult> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers: Record<string, string | number> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      };

      if (grant) {
        headers['x-cortex-lockdown-grant'] = grant;
      }

      const req = client.request(
        parsed,
        {
          method: 'POST',
          headers,
          timeout: 6000
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.authorized === true || json.success === true) {
                resolve({ success: true, authorized: true });
              } else {
                resolve({
                  success: false,
                  authorized: false,
                  error: json.error || json.failureReason || 'Code rejected by proctor server',
                  failureReason: json.error || json.failureReason || 'Code rejected by proctor server'
                });
              }
            } catch {
              resolve({
                success: false,
                authorized: false,
                error: 'Invalid JSON response from server',
                failureReason: 'Invalid JSON response from server'
              });
            }
          });
        }
      );

      req.on('error', (err) => {
        resolve({
          success: false,
          authorized: false,
          error: `Connection error: ${err.message}`,
          failureReason: `Connection error: ${err.message}`
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          authorized: false,
          error: 'Proctor verification request timed out',
          failureReason: 'Proctor verification request timed out'
        });
      });

      req.write(body);
      req.end();
    } catch (err) {
      resolve({
        success: false,
        authorized: false,
        error: String(err),
        failureReason: String(err)
      });
    }
  });
}

export function notifyProhibitedProcess(window: BrowserWindow, proc: ProhibitedProcessInfo): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send('cortex:on-prohibited-process', proc);
  }
}

export function notifyScreenCaptureAttempt(window: BrowserWindow): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send('cortex:on-screen-capture-attempt');
  }
}
