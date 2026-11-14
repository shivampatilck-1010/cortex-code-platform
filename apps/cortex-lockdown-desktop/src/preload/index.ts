/**
 * Cortex Lockdown Browser — Context-Isolated Preload Script
 * Exposes window.cortexLockdown secure APIs to the web assessment application.
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  CortexLockdownApi,
  SystemInfo,
  SecurityEventType,
  EmergencyExitResult,
  ProhibitedProcessInfo
} from '../shared/types';

const api: CortexLockdownApi = {
  getSystemInfo: async (): Promise<SystemInfo> => {
    return await ipcRenderer.invoke('cortex:get-system-info');
  },

  reportViolation: async (type: SecurityEventType, details: Record<string, unknown>): Promise<void> => {
    await ipcRenderer.invoke('cortex:report-violation', type, details);
  },

  requestEmergencyExit: async (challenge: string, otp: string): Promise<EmergencyExitResult> => {
    return await ipcRenderer.invoke('cortex:request-emergency-exit', challenge, otp);
  },

  onScreenCaptureAttempt: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('cortex:on-screen-capture-attempt', handler);
    return () => {
      ipcRenderer.removeListener('cortex:on-screen-capture-attempt', handler);
    };
  },

  onProhibitedProcessDetected: (callback: (proc: ProhibitedProcessInfo) => void): (() => void) => {
    const handler = (_event: unknown, proc: ProhibitedProcessInfo) => callback(proc);
    ipcRenderer.on('cortex:on-prohibited-process', handler);
    return () => {
      ipcRenderer.removeListener('cortex:on-prohibited-process', handler);
    };
  },

  onRestrictionWarning: (callback: (warning: string) => void): (() => void) => {
    const handler = (_event: unknown, warning: string) => callback(warning);
    ipcRenderer.on('cortex:on-restriction-warning', handler);
    return () => {
      ipcRenderer.removeListener('cortex:on-restriction-warning', handler);
    };
  },

  onForceSubmit: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('cortex:on-force-submit', handler);
    return () => {
      ipcRenderer.removeListener('cortex:on-force-submit', handler);
    };
  },

  clearClipboard: async (): Promise<void> => {
    await ipcRenderer.invoke('cortex:clipboard-clear');
  },

  exitApp: (): void => {
    ipcRenderer.send('cortex:exit-app');
  },

  minimizeApp: (): void => {
    ipcRenderer.send('cortex:minimize-app');
  },

  checkProcesses: async (): Promise<ProhibitedProcessInfo[]> => {
    return await ipcRenderer.invoke('cortex:check-processes');
  },

  enableScreenShare: async (): Promise<boolean> => {
    return await ipcRenderer.invoke('cortex:enable-screen-share');
  },

  getConfig: async (): Promise<any> => {
    return await ipcRenderer.invoke('cortex:get-config');
  },

  saveConfig: async (newConfig: any): Promise<boolean> => {
    return await ipcRenderer.invoke('cortex:save-config', newConfig);
  },

  getCustomCss: async (): Promise<string> => {
    return await ipcRenderer.invoke('cortex:get-custom-css');
  },

  getCustomPreloadPath: async (): Promise<string> => {
    return await ipcRenderer.invoke('cortex:get-custom-preload-path');
  }
};

contextBridge.exposeInMainWorld('cortexLockdown', api);
contextBridge.exposeInMainWorld('codex', api);
