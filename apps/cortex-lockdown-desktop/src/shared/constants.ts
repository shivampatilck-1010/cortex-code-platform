/**
 * Cortex Lockdown Browser — Desktop Kiosk Shared Constants
 * Authoritative security definitions matching docs/lockdown and ProcessWatchdog.cs
 */

/**
 * 44+ Blacklisted Executables categorized by adversarial threat vector.
 * Synchronized with apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs.
 */
export const BLACKLISTED_PROCESSES: readonly string[] = Object.freeze([
  // Screen Recorders, Streamers & Capture Tools (19 items)
  'obs64',
  'obs32',
  'obs',
  'streamlabs obs',
  'discord',
  'camtasia',
  'snagit32',
  'snagit64',
  'snagit',
  'action',
  'bandicam',
  'fraps',
  'xsplit',
  'geforceexperience',
  'nvcontainer',
  'radeonsoftware',
  'snippingtool',
  'screenclippinghost',
  'psr',

  // Remote Desktop & Collaboration Tools (11 items)
  'teamviewer',
  'anydesk',
  'vncviewer',
  'tv_w32',
  'chromeremotedesktop',
  'logmein',
  'parsec',
  'ammyy',
  'radmin',
  'ultraviewer',
  'tightvnc',

  // Unauthorized Secondary Browsers & Communication (12 items)
  'chrome',
  'firefox',
  'msedge',
  'brave',
  'opera',
  'vivaldi',
  'telegram',
  'whatsapp',
  'slack',
  'skype',
  'teams',
  'zoom',

  // Decompilers, Debuggers, Task Managers & Memory Editors (16 items)
  'wireshark',
  'fiddler',
  'charles',
  'cheatengine',
  'x64dbg',
  'x32dbg',
  'ida64',
  'ida',
  'processhacker',
  'procexp',
  'procexp64',
  'taskmgr',
  'perfmon',
  'resmon',
  'ghidra',
  'regedit',

  // Unauthorized Command Line & Shells (3 items)
  'cmd',
  'powershell',
  'pwsh'
]);

/**
 * Exactly 18 Prohibited Window Title Keywords for Adversarial Rename Bypass Defense.
 * Synchronized with apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs.
 */
export const PROHIBITED_TITLE_KEYWORDS: readonly string[] = Object.freeze([
  'obs',
  'streamlabs',
  'discord',
  'teamviewer',
  'anydesk',
  'vnc',
  'wireshark',
  'fiddler',
  'cheat engine',
  'x64dbg',
  'x32dbg',
  'ida pro',
  'ghidra',
  'task manager',
  'process hacker',
  'process explorer',
  'developer tools',
  'inspect element'
]);

/**
 * Authorized Examination Hosts and Origins Whitelist.
 */
export const AUTHORIZED_HOSTS: readonly string[] = Object.freeze([
  'examly.io',
  'lpucolab438.examly.io',
  'cortex-code-platform.cortexbuild1.workers.dev',
  'cortex-code-platform-staging.cortexbuild1.workers.dev',
  'localhost',
  '127.0.0.1'
]);

export const AUTHORIZED_ORIGINS: readonly string[] = Object.freeze([
  'https://lpucolab438.examly.io',
  'https://examly.io',
  'https://cortex-code-platform.cortexbuild1.workers.dev',
  'https://cortex-code-platform-staging.cortexbuild1.workers.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

export const DEFAULT_TARGET_URL = 'https://lpucolab438.examly.io';

export const DEFAULT_TELEMETRY_ENDPOINT = '/api/v1/lockdown/telemetry';
export const DEFAULT_EMERGENCY_EXIT_ENDPOINT = '/api/v1/lockdown/emergency-exit';

export const WATCHDOG_POLL_INTERVAL_MS = 1500;
export const PROCTOR_OVERRIDE_SHORTCUT = 'CommandOrControl+Alt+F10';
export const PROTOCOL_SCHEME = 'cortex-lockdown';

/**
 * Set for O(1) blacklist lookups.
 */
const blacklistedSet = new Set(BLACKLISTED_PROCESSES.map((p) => p.toLowerCase()));

/**
 * Check whether an executable name (with or without .exe extension) is blacklisted.
 * Strips leading Unix and Windows directory paths (e.g. /usr/bin/obs -> obs) before matching.
 */
export function isBlacklistedProcess(processName: string): boolean {
  if (!processName) return false;
  let cleanName = processName.trim().toLowerCase();

  // Strip Unix/Windows directory paths (e.g. /usr/bin/obs -> obs)
  const lastSlash = Math.max(cleanName.lastIndexOf('/'), cleanName.lastIndexOf('\\'));
  if (lastSlash >= 0) {
    cleanName = cleanName.slice(lastSlash + 1);
  }

  if (cleanName.endsWith('.exe')) {
    cleanName = cleanName.slice(0, -4);
  }
  return blacklistedSet.has(cleanName);
}

/**
 * Check whether a window title contains any prohibited keyword.
 */
export function containsProhibitedKeyword(title: string): string | null {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const keyword of PROHIBITED_TITLE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

/**
 * Check whether a host is authorized by the origin whitelist.
 */
export function isAllowedHost(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  return AUTHORIZED_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

/**
 * Check whether a full URL is authorized by origin whitelist and scheme restrictions.
 */
export function isAllowedUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (parsed.protocol === 'file:') {
      return true;
    }

    // Only allow http for localhost/127.0.0.1; https required for all other domains
    if (parsed.protocol === 'http:') {
      return host === 'localhost' || host === '127.0.0.1';
    }

    if (parsed.protocol === 'https:') {
      return isAllowedHost(host);
    }

    return false;
  } catch {
    return false;
  }
}
