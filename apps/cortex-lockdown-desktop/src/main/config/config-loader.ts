/**
 * Codex Browser — Modular Configuration Loader
 * Inspired by Safe Exam Browser (.seb) & Numbas settings loader.
 * Loads, validates, and provides hot-reload capabilities for codex.config.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

export interface CodexConfig {
  app: {
    name: string;
    version: string;
    theme: {
      accentColor: string;
      backgroundColor: string;
      headerBackground: string;
      surfaceColor: string;
      textColor: string;
      dangerColor: string;
    };
    branding: {
      logoTitle: string;
      logoSubtitle: string;
      showCubeIcon: boolean;
    };
  };
  exam: {
    targetUrl: string;
    allowedHosts: string[];
    userAgent: string;
    offlineFallbackEnabled: boolean;
  };
  proctoring: {
    enabled: boolean;
    requireCamera: boolean;
    requireMicrophone: boolean;
    requireScreenShare: boolean;
    requireClipboardSync: boolean;
    showFloatingHud: boolean;
    hudPosition: string;
    triggerOnTestEntry: boolean;
  };
  security: {
    kioskMode: boolean;
    alwaysOnTop: boolean;
    allowDevTools: boolean;
    singleDisplayEnforced: boolean;
    blockKeyboardShortcuts: boolean;
    processWatchdog: {
      enabled: boolean;
      pollIntervalMs: number;
      autoTerminate: boolean;
      customBlacklist: string[];
    };
  };
  customization: {
    enableCustomCss: boolean;
    customCssPath: string;
    enableCustomPreload: boolean;
    customPreloadPath: string;
    enableLiveCustomizer: boolean;
  };
}

export const DEFAULT_CONFIG: CodexConfig = {
  app: {
    name: 'Codex Browser',
    version: '2.0.10',
    theme: {
      accentColor: '#00e5c9',
      backgroundColor: '#041c17',
      headerBackground: '#06251f',
      surfaceColor: '#072b23',
      textColor: '#ffffff',
      dangerColor: '#dc2626'
    },
    branding: {
      logoTitle: 'Codex Browser',
      logoSubtitle: 'Secure Exam Environment',
      showCubeIcon: true
    }
  },
  exam: {
    targetUrl: 'https://cortex-code-platform.cortexbuild1.workers.dev/classroom',
    allowedHosts: [
      'cortex-code-platform.cortexbuild1.workers.dev',
      'cortex-code-platform-staging.cortexbuild1.workers.dev',
      'lpucolab438.examly.io',
      'examly.io',
      'localhost',
      '127.0.0.1'
    ],
    userAgent: 'CodexBrowser/2.0 (SEB-Compatible; Windows NT 10.0; Win64; x64)',
    offlineFallbackEnabled: true
  },
  proctoring: {
    enabled: true,
    requireCamera: true,
    requireMicrophone: true,
    requireScreenShare: true,
    requireClipboardSync: true,
    showFloatingHud: true,
    hudPosition: 'top-right',
    triggerOnTestEntry: true
  },
  security: {
    kioskMode: true,
    alwaysOnTop: true,
    allowDevTools: false,
    singleDisplayEnforced: true,
    blockKeyboardShortcuts: true,
    processWatchdog: {
      enabled: true,
      pollIntervalMs: 1500,
      autoTerminate: false,
      customBlacklist: []
    }
  },
  customization: {
    enableCustomCss: true,
    customCssPath: './custom/custom.css',
    enableCustomPreload: true,
    customPreloadPath: './custom/custom-preload.js',
    enableLiveCustomizer: true
  }
};

export class ConfigManager {
  private static instance: ConfigManager;
  private config: CodexConfig;
  private configPath: string;

  private constructor() {
    // Look for config in root of app or project
    const candidatePaths = [
      path.join(process.cwd(), 'config', 'codex.config.json'),
      path.join(__dirname, '../../../config/codex.config.json'),
      path.join(__dirname, '../../config/codex.config.json'),
      path.join(__dirname, '../config/codex.config.json')
    ];

    this.configPath = candidatePaths[0];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        this.configPath = p;
        break;
      }
    }

    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): CodexConfig {
    return this.config;
  }

  public loadConfig(): CodexConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          app: { ...DEFAULT_CONFIG.app, ...parsed.app },
          exam: { ...DEFAULT_CONFIG.exam, ...parsed.exam },
          proctoring: { ...DEFAULT_CONFIG.proctoring, ...parsed.proctoring },
          security: { ...DEFAULT_CONFIG.security, ...parsed.security },
          customization: { ...DEFAULT_CONFIG.customization, ...parsed.customization }
        };
      }
    } catch (err) {
      console.warn(`[ConfigManager] Failed to read ${this.configPath}, using defaults:`, err);
    }
    return DEFAULT_CONFIG;
  }

  public saveConfig(newConfig: Partial<CodexConfig>): boolean {
    try {
      this.config = {
        ...this.config,
        ...newConfig
      };
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error(`[ConfigManager] Failed to write config to ${this.configPath}:`, err);
      return false;
    }
  }

  public getCustomCss(): string {
    if (!this.config.customization.enableCustomCss) return '';
    try {
      const cssRelPath = this.config.customization.customCssPath || './custom/custom.css';
      const candidates = [
        path.resolve(path.dirname(this.configPath), '..', cssRelPath),
        path.resolve(path.dirname(this.configPath), cssRelPath),
        path.resolve(process.cwd(), cssRelPath),
        path.resolve(__dirname, '../../../', cssRelPath),
        path.resolve(__dirname, '../../', cssRelPath)
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return fs.readFileSync(candidate, 'utf-8');
        }
      }
    } catch {}
    return '';
  }

  public getCustomPreloadPath(): string {
    if (!this.config.customization.enableCustomPreload) return '';
    try {
      const preloadRelPath = this.config.customization.customPreloadPath || './custom/custom-preload.js';
      const candidates = [
        path.resolve(path.dirname(this.configPath), '..', preloadRelPath),
        path.resolve(path.dirname(this.configPath), preloadRelPath),
        path.resolve(process.cwd(), preloadRelPath),
        path.resolve(__dirname, '../../../', preloadRelPath),
        path.resolve(__dirname, '../../', preloadRelPath)
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return pathToFileURL(candidate).href;
        }
      }
    } catch (err) {
      console.warn('[ConfigManager] Error resolving custom preload path:', err);
    }
    return '';
  }
}
