/**
 * Cortex Lockdown Browser — Clipboard Security Guard
 * Purges clipboard contents on exam launch, window activation, and screenshot events.
 * Isolates cross-application clipboard access while preserving internal editor editing.
 */

import { clipboard } from 'electron';
import { TelemetryClient } from './telemetry-client';

export class ClipboardGuard {
  private telemetry?: TelemetryClient;
  private lastInternalText = '';

  constructor(telemetry?: TelemetryClient) {
    this.telemetry = telemetry;
  }

  /**
   * Purges the operating system clipboard buffer.
   */
  public clearClipboard(): void {
    try {
      clipboard.clear();
      this.lastInternalText = '';
      this.telemetry?.dispatchEvent('clipboard_purged', {
        reason: 'security_flush'
      });
    } catch (err) {
      this.telemetry?.dispatchEvent('integrity_violation', {
        guard: 'ClipboardGuard',
        error: String(err)
      });
    }
  }

  /**
   * Records internal Monaco editor text buffer to allow internal copy/paste
   * while blocking external clipboard injections.
   */
  public recordInternalCopy(text: string): void {
    this.lastInternalText = text;
  }

  /**
   * Checks whether the current clipboard content originated from the internal editor session.
   */
  public isInternalContent(): boolean {
    try {
      const currentText = clipboard.readText();
      return currentText === this.lastInternalText;
    } catch {
      return false;
    }
  }
}
