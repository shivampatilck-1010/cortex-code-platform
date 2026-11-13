/**
 * Cortex Lockdown Browser — Global Low-Level Keyboard Guard
 * Intercepts and suppresses system navigation shortcuts, task switchers,
 * window closers, and devtools while preserving the proctor emergency exit hotkey.
 */

import { BrowserWindow, globalShortcut, Input } from 'electron';
import { TelemetryClient } from './telemetry-client';
import { ClipboardGuard } from './clipboard-guard';
import { PROCTOR_OVERRIDE_SHORTCUT } from '../../shared/constants';

export class KeyboardGuard {
  private window: BrowserWindow;
  private telemetry?: TelemetryClient;
  private clipboardGuard?: ClipboardGuard;
  private onEmergencyExit?: () => void;
  private isInstalled = false;

  constructor(
    window: BrowserWindow,
    options: {
      telemetry?: TelemetryClient;
      clipboardGuard?: ClipboardGuard;
      onEmergencyExit?: () => void;
    } = {}
  ) {
    this.window = window;
    this.telemetry = options.telemetry;
    this.clipboardGuard = options.clipboardGuard;
    this.onEmergencyExit = options.onEmergencyExit;
  }

  /**
   * Install keyboard event listeners and global shortcuts.
   */
  public install(): void {
    if (this.isInstalled) return;

    const webContents = this.window.webContents;

    // 1. WebContents before-input-event interceptor (Window-level suppression)
    webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;

      const violation = this.evaluateInput(input);

      if (violation) {
        if (violation.isEmergencyExit) {
          event.preventDefault();
          if (this.onEmergencyExit) {
            this.onEmergencyExit();
          }
          return;
        }

        // Drop the key combination
        event.preventDefault();

        // PrintScreen handling: immediately purge clipboard
        if (violation.keyName === 'PrintScreen') {
          this.clipboardGuard?.clearClipboard();
        }

        // Telemetry logging
        this.telemetry?.dispatchEvent('blocked_key_attempt', {
          key: violation.keyName,
          code: input.code,
          keyVal: input.key,
          alt: input.alt,
          ctrl: input.control,
          meta: input.meta,
          shift: input.shift
        });
      }
    });

    // 2. Global Shortcut Registration for Proctor Override
    try {
      globalShortcut.register(PROCTOR_OVERRIDE_SHORTCUT, () => {
        if (this.onEmergencyExit) {
          this.onEmergencyExit();
        }
      });
    } catch {
      // Global shortcut registration might fail in restricted environments; before-input-event will catch it
    }

    this.isInstalled = true;
  }

  /**
   * Evaluates whether an input key event matches prohibited shortcuts or proctor override.
   */
  public evaluateInput(input: Input): { keyName: string; isEmergencyExit?: boolean } | null {
    const key = (input.key || '').toLowerCase();
    const code = (input.code || '').toLowerCase();
    const isAlt = Boolean(input.alt);
    const isCtrl = Boolean(input.control);
    const isShift = Boolean(input.shift);
    const isMeta = Boolean(input.meta);

    // 0. Proctor Emergency Exit: Ctrl + Alt + F10
    if ((isCtrl || isMeta) && isAlt && (key === 'f10' || code === 'f10')) {
      return { keyName: 'CtrlAltF10_ProctorExit', isEmergencyExit: true };
    }

    // 1. Windows / Meta / Command Key
    if (
      isMeta ||
      key === 'meta' ||
      key === 'os' ||
      code.includes('meta') ||
      code.includes('os') ||
      code === 'contextmenu'
    ) {
      return { keyName: 'WindowsKey' };
    }

    // 2. Alt + Tab (Application Switcher)
    if (isAlt && (key === 'tab' || code === 'tab')) {
      return { keyName: 'AltTab' };
    }

    // 3. Alt + Escape
    if (isAlt && (key === 'escape' || code === 'escape')) {
      return { keyName: 'AltEscape' };
    }

    // 4. Ctrl + Escape (Start Menu) or Ctrl + Shift + Escape (Task Manager)
    if ((isCtrl || isMeta) && (key === 'escape' || code === 'escape')) {
      return { keyName: isShift ? 'CtrlShiftEscape_TaskMgr' : 'CtrlEscape_StartMenu' };
    }

    // 5. Alt + F4 (Window Close)
    if (isAlt && (key === 'f4' || code === 'f4')) {
      return { keyName: 'AltF4' };
    }

    // 6. PrintScreen (Screen Capture)
    if (key === 'printscreen' || code === 'printscreen' || key === 'snapshot') {
      return { keyName: 'PrintScreen' };
    }

    // 7. Developer Tools Hotkeys (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
    if (key === 'f12' || code === 'f12') {
      return { keyName: 'F12_DevTools' };
    }

    if ((isCtrl || isMeta) && isShift && (key === 'i' || key === 'j' || key === 'c' || code === 'keyi' || code === 'keyj' || code === 'keyc')) {
      return { keyName: 'CtrlShift_DevTools' };
    }

    if ((isCtrl || isMeta) && (key === 'u' || code === 'keyu')) {
      return { keyName: 'CtrlU_ViewSource' };
    }

    // 8. Navigation & Browser Accelerators (F5, Ctrl+R, Ctrl+P, Ctrl+O, Ctrl+S)
    if (key === 'f5' || code === 'f5' || ((isCtrl || isMeta) && (key === 'r' || code === 'keyr'))) {
      return { keyName: 'BrowserReload' };
    }

    if ((isCtrl || isMeta) && (key === 'p' || code === 'keyp')) {
      return { keyName: 'PrintDialog' };
    }

    if ((isCtrl || isMeta) && (key === 's' || code === 'keys')) {
      return { keyName: 'SavePage' };
    }

    if ((isCtrl || isMeta) && (key === 'o' || code === 'keyo')) {
      return { keyName: 'OpenFile' };
    }

    if (isAlt && (code === 'arrowleft' || code === 'arrowright')) {
      return { keyName: 'HistoryNavigation' };
    }

    return null;
  }

  /**
   * Uninstall shortcuts on cleanup.
   */
  public uninstall(): void {
    if (!this.isInstalled) return;

    try {
      globalShortcut.unregister(PROCTOR_OVERRIDE_SHORTCUT);
    } catch {
      // Ignore unregister errors
    }

    this.isInstalled = false;
  }
}
