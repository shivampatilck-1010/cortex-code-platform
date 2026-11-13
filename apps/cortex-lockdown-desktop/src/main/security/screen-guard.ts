/**
 * Cortex Lockdown Browser — Screen Capture Protection Guard
 * Interfaces with Win32 SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
 * and macOS NSWindow.sharingType = .none via Electron setContentProtection.
 */

import { BrowserWindow } from 'electron';
import { TelemetryClient } from './telemetry-client';

export class ScreenGuard {
  private window: BrowserWindow;
  private telemetry?: TelemetryClient;
  private isActive = false;

  constructor(window: BrowserWindow, telemetry?: TelemetryClient) {
    this.window = window;
    this.telemetry = telemetry;
  }

  /**
   * Enforces screen capture protection on the kiosk window.
   * On Windows: Obscures window with black pixels in OBS, Discord, Teams, Zoom, Snipping Tool.
   * On macOS: Excludes window surface from ScreenCaptureKit and Quartz Display Services.
   */
  public enable(): boolean {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.setContentProtection(true);
        this.isActive = true;
        return true;
      }
      return false;
    } catch (err) {
      this.isActive = false;
      this.telemetry?.dispatchEvent('integrity_violation', {
        guard: 'ScreenGuard',
        error: String(err)
      });
      return false;
    }
  }

  /**
   * Disables screen capture protection (e.g. during clean proctor teardown).
   */
  public disable(): void {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.setContentProtection(false);
      }
    } catch {
      // Ignore teardown errors
    } finally {
      this.isActive = false;
    }
  }

  /**
   * Verifies if screen capture protection is currently enabled.
   */
  public isProtectionActive(): boolean {
    return this.isActive;
  }

  /**
   * Reasserts screen capture protection if the window state changes.
   */
  public reassert(): void {
    if (this.isActive) {
      this.enable();
    }
  }
}
