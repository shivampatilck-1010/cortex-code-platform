/**
 * Cortex Lockdown Browser — Ambient Electron Type Declarations
 * Ensures robust offline compilation across all development environments.
 */

declare module 'electron' {
  export interface Input {
    type: string;
    key: string;
    code: string;
    alt?: boolean;
    control?: boolean;
    shift?: boolean;
    meta?: boolean;
    isAutoRepeat?: boolean;
  }

  export interface Display {
    id: number;
    bounds: { x: number; y: number; width: number; height: number };
    workArea: { x: number; y: number; width: number; height: number };
  }

  export interface WebPreferences {
    preload?: string;
    contextIsolation?: boolean;
    nodeIntegration?: boolean;
    sandbox?: boolean;
    webSecurity?: boolean;
    allowRunningInsecureContent?: boolean;
    devTools?: boolean;
    webviewTag?: boolean;
  }

  export interface BrowserWindowConstructorOptions {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    kiosk?: boolean;
    fullscreen?: boolean;
    alwaysOnTop?: boolean;
    frame?: boolean;
    skipTaskbar?: boolean;
    autoHideMenuBar?: boolean;
    backgroundColor?: string;
    show?: boolean;
    webPreferences?: WebPreferences;
  }

  export interface WebContents {
    on(event: 'before-input-event', listener: (event: { preventDefault: () => void }, input: Input) => void): this;
    on(event: 'will-navigate', listener: (event: { preventDefault: () => void }, targetUrl: string) => void): this;
    on(event: 'will-redirect', listener: (event: { preventDefault: () => void }, targetUrl: string) => void): this;
    setWindowOpenHandler(handler: (details: { url: string; disposition: string }) => { action: 'allow' | 'deny' }): void;
    send(channel: string, ...args: any[]): void;
  }

  export class BrowserWindow {
    webContents: WebContents;
    constructor(options?: BrowserWindowConstructorOptions);
    setContentProtection(enable: boolean): void;
    isProtectionActive?(): boolean;
    isDestroyed(): boolean;
    isKiosk(): boolean;
    show(): void;
    focus(): void;
    setAlwaysOnTop(flag: boolean, level?: string): void;
    loadURL(url: string): Promise<void>;
    destroy(): void;
    once(event: string, listener: (...args: any[]) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export const app: {
    requestSingleInstanceLock(): boolean;
    setAsDefaultProtocolClient(protocol: string, path?: string, args?: string[]): boolean;
    whenReady(): Promise<void>;
    quit(): void;
    on(event: string, listener: (...args: any[]) => void): void;
  };

  export const screen: {
    getAllDisplays(): Display[];
    getPrimaryDisplay(): Display;
    on(event: string, listener: (...args: any[]) => void): void;
  };

  export const dialog: {
    showMessageBox(browserWindow: BrowserWindow, options: any): Promise<{ response: number }>;
  };

  export const clipboard: {
    clear(): void;
    readText(): string;
    writeText(text: string): void;
  };

  export const globalShortcut: {
    register(accelerator: string, callback: () => void): boolean;
    unregister(accelerator: string): void;
    unregisterAll(): void;
  };

  export const contextBridge: {
    exposeInMainWorld(apiKey: string, api: any): void;
  };

  export const ipcMain: {
    handle(channel: string, listener: (event: any, ...args: any[]) => any): void;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
  };

  export interface Session {
    setPermissionRequestHandler(handler: (webContents: any, permission: string, callback: (permissionGranted: boolean) => void, details?: any) => void): void;
    setPermissionCheckHandler(handler: (webContents: any, permission: string, requestingOrigin?: string, details?: any) => boolean): void;
    setDisplayMediaRequestHandler(handler: (request: any, callback: (response: { video: any; audio?: any }) => void) => void): void;
  }

  export const session: {
    defaultSession: Session;
    fromPartition(partition: string): Session;
  };

  export const desktopCapturer: {
    getSources(options: { types: string[]; thumbnailSize?: { width: number; height: number } }): Promise<Array<{ id: string; name: string; display_id?: string }>>;
  };

  export const ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    removeListener(channel: string, listener: (...args: any[]) => void): void;
  };
}
