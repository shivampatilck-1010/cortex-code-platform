/**
 * Cortex Lockdown Browser — Background Process Watchdog
 * Continuously inspects running operating system processes at 1,500 ms intervals.
 * Matches against 44 blacklisted executables and 18 prohibited window title keywords.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  isBlacklistedProcess,
  containsProhibitedKeyword,
  WATCHDOG_POLL_INTERVAL_MS
} from '../../shared/constants';
import { ProhibitedProcessInfo } from '../../shared/types';
import { TelemetryClient } from './telemetry-client';

const execAsync = promisify(exec);

export type ProhibitedProcessCallback = (proc: ProhibitedProcessInfo) => void;

export class ProcessWatchdog {
  private pollIntervalMs: number;
  private autoTerminate: boolean;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private telemetry?: TelemetryClient;
  private listeners: ProhibitedProcessCallback[] = [];
  private reportedViolations = new Set<string>();

  constructor(options: {
    pollIntervalMs?: number;
    autoTerminate?: boolean;
    telemetry?: TelemetryClient;
  } = {}) {
    this.pollIntervalMs = options.pollIntervalMs || WATCHDOG_POLL_INTERVAL_MS;
    this.autoTerminate = options.autoTerminate ?? false;
    this.telemetry = options.telemetry;
  }

  public onProhibitedProcess(callback: ProhibitedProcessCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleScan();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public dispose(): void {
    this.stop();
    this.listeners = [];
    this.reportedViolations.clear();
  }

  private scheduleScan(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      try {
        await this.scanProcesses();
      } catch {
        // Suppress transient process inspection errors
      } finally {
        if (this.isRunning) {
          this.scheduleScan();
        }
      }
    }, this.pollIntervalMs);
  }

  /**
   * Scans the system process table once and returns detected violations.
   */
  public async scanProcesses(): Promise<ProhibitedProcessInfo[]> {
    const platform = process.platform;
    const rawProcesses = await this.fetchProcessList(platform);
    const violations: ProhibitedProcessInfo[] = [];

    for (const proc of rawProcesses) {
      const isViolatingName = isBlacklistedProcess(proc.name);
      const prohibitedKeyword = containsProhibitedKeyword(proc.title);

      if (isViolatingName || prohibitedKeyword) {
        const violationKey = `${proc.pid}:${proc.name}`;
        const info: ProhibitedProcessInfo = {
          name: proc.name,
          pid: proc.pid,
          windowTitle: proc.title || undefined,
          detectedAt: Date.now(),
          category: isViolatingName ? 'blacklisted_executable' : 'prohibited_window_title'
        };

        violations.push(info);

        // Deduplicate logging per process lifetime
        if (!this.reportedViolations.has(violationKey)) {
          this.reportedViolations.add(violationKey);

          // Notify listeners
          for (const listener of this.listeners) {
            try {
              listener(info);
            } catch {
              // Ignore listener callback errors
            }
          }

          // Dispatch telemetry
          this.telemetry?.dispatchEvent('prohibited_process_detected', {
            process: proc.name,
            pid: proc.pid,
            windowTitle: proc.title,
            reason: isViolatingName
              ? `Blacklisted binary: ${proc.name}`
              : `Prohibited title keyword: ${prohibitedKeyword}`
          });

          // Optional auto-termination
          if (this.autoTerminate && proc.pid > 0) {
            try {
              process.kill(proc.pid);
            } catch {
              // Ignore kill permission errors on system processes
            }
          }
        }
      }
    }

    return violations;
  }

  /**
   * Cross-platform process enumerator.
   */
  public async fetchProcessList(platform: string): Promise<Array<{ name: string; pid: number; title: string }>> {
    try {
      if (platform === 'win32') {
        return await this.fetchWindowsProcesses();
      } else {
        return await this.fetchUnixProcesses();
      }
    } catch {
      return [];
    }
  }

  private async fetchWindowsProcesses(): Promise<Array<{ name: string; pid: number; title: string }>> {
    try {
      const { stdout } = await execAsync('tasklist /FO CSV /V /NH', { timeout: 3000, windowsHide: true });
      return this.parseWindowsCsv(stdout);
    } catch {
      try {
        const { stdout } = await execAsync('tasklist /FO CSV /NH', { timeout: 2000, windowsHide: true });
        return this.parseWindowsCsv(stdout);
      } catch {
        return [];
      }
    }
  }

  public parseWindowsCsv(csvOutput: string): Array<{ name: string; pid: number; title: string }> {
    const results: Array<{ name: string; pid: number; title: string }> = [];
    if (!csvOutput) return results;

    const lines = csvOutput.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;

      const columns = this.parseCsvLine(line);
      if (columns.length >= 2) {
        const name = (columns[0] || '').trim();
        const pid = parseInt(columns[1], 10);
        const title = columns.length >= 9 ? (columns[8] || '').trim() : '';

        if (name && !isNaN(pid)) {
          results.push({ name, pid, title });
        }
      }
    }

    return results;
  }

  private async fetchUnixProcesses(): Promise<Array<{ name: string; pid: number; title: string }>> {
    try {
      const { stdout } = await execAsync('ps -eo pid,comm,args', { timeout: 3000 });
      return this.parseUnixPs(stdout);
    } catch {
      return [];
    }
  }

  public parseUnixPs(psOutput: string): Array<{ name: string; pid: number; title: string }> {
    const results: Array<{ name: string; pid: number; title: string }> = [];
    if (!psOutput) return results;

    const lines = psOutput.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const match = line.match(/^(\d+)\s+([^\s]+)\s*(.*)$/);
      if (match) {
        const pid = parseInt(match[1], 10);
        const name = match[2];
        const args = match[3] || '';

        if (!isNaN(pid)) {
          results.push({
            name,
            pid,
            title: args
          });
        }
      }
    }

    return results;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }
}
