/**
 * Cortex Lockdown Browser — Navigation & Origin Security Guard
 * Restricts browser navigation strictly to authorized examination origins.
 * Blocks external navigation, unwhitelisted links, and popup windows.
 */

import { BrowserWindow } from 'electron';
import { isAllowedUrl } from '../../shared/constants';
import { TelemetryClient } from './telemetry-client';

export class NavigationGuard {
  private window: BrowserWindow;
  private telemetry?: TelemetryClient;

  constructor(window: BrowserWindow, telemetry?: TelemetryClient) {
    this.window = window;
    this.telemetry = telemetry;
  }

  /**
   * Installs navigation security handlers on the window's webContents.
   */
  public install(): void {
    const webContents = this.window.webContents;

    // 1. Intercept top-level navigation (will-navigate)
    webContents.on('will-navigate', (event, targetUrl) => {
      if (!isAllowedUrl(targetUrl)) {
        event.preventDefault();

        this.telemetry?.dispatchEvent('navigation_blocked', {
          url: targetUrl,
          reason: 'unauthorized_origin'
        });
      }
    });

    // 2. Block all popups, window.open, and target="_blank"
    webContents.setWindowOpenHandler((details) => {
      this.telemetry?.dispatchEvent('navigation_blocked', {
        url: details.url,
        disposition: details.disposition,
        reason: 'window_open_denied'
      });

      return { action: 'deny' };
    });

    // 3. Intercept redirects
    webContents.on('will-redirect', (event, targetUrl) => {
      if (!isAllowedUrl(targetUrl)) {
        event.preventDefault();

        this.telemetry?.dispatchEvent('navigation_blocked', {
          url: targetUrl,
          reason: 'unauthorized_redirect'
        });
      }
    });
  }
}
