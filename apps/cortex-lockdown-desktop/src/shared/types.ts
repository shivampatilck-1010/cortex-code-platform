/**
 * Cortex Lockdown Browser — Desktop Kiosk Shared Types
 * Production-grade type definitions for unified cross-platform desktop application.
 */

export type SecurityEventType =
  | 'blocked_key_attempt'
  | 'prohibited_process_detected'
  | 'window_blur'
  | 'screen_capture_attempt'
  | 'emergency_exit'
  | 'unauthorized_emergency_exit_attempt'
  | 'clipboard_purged'
  | 'navigation_blocked'
  | 'multimonitor_detected'
  | 'remote_session_detected'
  | 'devtools_opened'
  | 'integrity_violation';

export interface TelemetryEvent {
  eventType: SecurityEventType;
  timestamp: number;
  details: Record<string, unknown>;
}

export interface TelemetryPayload {
  sessionId: string;
  examId: string;
  events: TelemetryEvent[];
}

export interface ProhibitedProcessInfo {
  name: string;
  pid: number;
  windowTitle?: string;
  detectedAt: number;
  category?: string;
}

export interface EmergencyExitRequest {
  action: 'redeem';
  examId: string;
  challenge: string;
  code: string;
  grant?: string;
}

export interface EmergencyExitResult {
  authorized: boolean;
  success?: boolean;
  error?: string;
  failureReason?: string;
  message?: string;
}

export interface SystemInfo {
  platform: 'win32' | 'darwin' | 'linux';
  arch: string;
  isKiosk: boolean;
  screenProtection: boolean;
  singleDisplay: boolean;
  displayCount: number;
  version: string;
  nodeVersion: string;
  electronVersion: string;
}

export interface KioskWindowOptions {
  targetUrl?: string;
  examId?: string;
  launchGrant?: string;
  telemetryUrl?: string;
  autoTerminateProhibited?: boolean;
  allowDevTools?: boolean;
  isWindowed?: boolean;
}

export interface ParsedLaunchArguments {
  targetUrl: string;
  examId: string;
  launchGrant: string;
  isProtocolLaunch: boolean;
  isWindowed?: boolean;
}

export interface CortexLockdownApi {
  getSystemInfo: () => Promise<SystemInfo>;
  reportViolation: (type: SecurityEventType, details: Record<string, unknown>) => Promise<void>;
  requestEmergencyExit: (challenge: string, otp: string) => Promise<EmergencyExitResult>;
  onScreenCaptureAttempt: (callback: () => void) => () => void;
  onProhibitedProcessDetected: (callback: (proc: ProhibitedProcessInfo) => void) => () => void;
  onRestrictionWarning: (callback: (warning: string) => void) => () => void;
  onForceSubmit: (callback: () => void) => () => void;
  clearClipboard: () => Promise<void>;
  exitApp: () => void;
  minimizeApp: () => void;
  checkProcesses: () => Promise<ProhibitedProcessInfo[]>;
  enableScreenShare: () => Promise<boolean>;
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<boolean>;
  getCustomCss: () => Promise<string>;
  getCustomPreloadPath: () => Promise<string>;
}

export type IpcChannel =
  | 'cortex:get-system-info'
  | 'cortex:report-violation'
  | 'cortex:request-emergency-exit'
  | 'cortex:clipboard-clear'
  | 'cortex:on-screen-capture-attempt'
  | 'cortex:on-prohibited-process'
  | 'cortex:on-restriction-warning'
  | 'cortex:on-force-submit'
  | 'cortex:get-custom-preload-path';
