import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConsoleMessage {
  type(): string;
  text(): string;
}

export interface Request {
  url(): string;
  method(): string;
  postData(): string | null;
}

export interface Route {
  fulfill(options: {
    status?: number;
    contentType?: string;
    body?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
  continue(): Promise<void>;
  abort(errorCode?: string): Promise<void>;
  request(): Request;
}

export interface Dialog {
  message(): string;
  accept(promptText?: string): Promise<void>;
  dismiss(): Promise<void>;
}

export interface Response {
  status(): number;
  ok(): boolean;
  url(): string;
  text(): Promise<string>;
}

export interface Locator {
  first(): Locator;
  last(): Locator;
  nth(index: number): Locator;
  count(): Promise<number>;
  click(options?: { button?: 'left' | 'right' | 'middle'; force?: boolean; timeout?: number }): Promise<void>;
  dblclick(options?: { timeout?: number }): Promise<void>;
  fill(value: string, options?: { timeout?: number }): Promise<void>;
  clear(options?: { timeout?: number }): Promise<void>;
  press(key: string, options?: { timeout?: number }): Promise<void>;
  hover(options?: { force?: boolean; timeout?: number }): Promise<void>;
  focus(options?: { timeout?: number }): Promise<void>;
  dispatchEvent(type: string, eventInit?: Record<string, unknown>, options?: { timeout?: number }): Promise<void>;
  scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void>;
  isVisible(options?: { timeout?: number }): Promise<boolean>;
  isEnabled(options?: { timeout?: number }): Promise<boolean>;
  isDisabled(options?: { timeout?: number }): Promise<boolean>;
  textContent(options?: { timeout?: number }): Promise<string | null>;
  innerText(options?: { timeout?: number }): Promise<string>;
  getAttribute(name: string, options?: { timeout?: number }): Promise<string | null>;
  inputValue(options?: { timeout?: number }): Promise<string>;
  boundingBox(options?: { timeout?: number }): Promise<BoundingBox | null>;
  evaluate<T, Arg = unknown>(pageFunction: (el: Element, arg: Arg) => T, arg?: Arg): Promise<T>;
  locator(selector: string): Locator;
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): Locator;
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator;
  filter(options: { hasText?: string | RegExp; hasNotText?: string | RegExp; has?: Locator }): Locator;
  waitFor(options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number }): Promise<void>;
}

export interface Keyboard {
  press(key: string): Promise<void>;
  type(text: string): Promise<void>;
}

export interface Mouse {
  move(x: number, y: number): Promise<void>;
  click(x: number, y: number): Promise<void>;
  down(): Promise<void>;
  up(): Promise<void>;
}

export interface Clock {
  install(options?: { time?: number | Date }): Promise<void>;
  fastForward(ticks: number | string): Promise<void>;
  runFor(ticks: number | string): Promise<void>;
  pauseAt(time: number | Date): Promise<void>;
  resume(): Promise<void>;
}

export interface Page {
  goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'; timeout?: number }): Promise<Response | null>;
  reload(options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'; timeout?: number }): Promise<Response | null>;
  url(): string;
  title(): Promise<string>;
  content(): Promise<string>;
  evaluate<T, Arg = unknown>(pageFunction: (arg: Arg) => T, arg?: Arg): Promise<T>;
  waitForTimeout(timeout: number): Promise<void>;
  waitForSelector(selector: string, options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number }): Promise<unknown>;
  waitForFunction<T>(pageFunction: () => T, arg?: unknown, options?: { timeout?: number }): Promise<unknown>;
  waitForURL(url: string | RegExp | ((url: URL) => boolean), options?: { timeout?: number }): Promise<void>;
  setViewportSize(viewportSize: ViewportSize): Promise<void>;
  viewportSize(): ViewportSize | null;
  locator(selector: string): Locator;
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): Locator;
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator;
  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator;
  getByTestId(testId: string | RegExp): Locator;
  keyboard: Keyboard;
  mouse: Mouse;
  clock: Clock;
  route(url: string | RegExp | ((url: URL) => boolean), handler: (route: Route) => Promise<void> | void): Promise<void>;
  unroute(url: string | RegExp | ((url: URL) => boolean)): Promise<void>;
  on(event: 'console', listener: (msg: ConsoleMessage) => void): void;
  on(event: 'pageerror', listener: (err: Error) => void): void;
  on(event: 'dialog', listener: (dialog: Dialog) => void): void;
  off(event: 'console', listener: (msg: ConsoleMessage) => void): void;
  off(event: 'pageerror', listener: (err: Error) => void): void;
  off(event: 'dialog', listener: (dialog: Dialog) => void): void;
  close(): Promise<void>;
  isClosed(): boolean;
}

export interface BrowserContext {
  newPage(): Promise<Page>;
  pages(): Page[];
  grantPermissions(permissions: string[], options?: { origin?: string }): Promise<void>;
  clearPermissions(): Promise<void>;
  addInitScript(script: string | (() => void)): Promise<void>;
  close(): Promise<void>;
}

export interface Browser {
  newContext(options?: {
    viewport?: ViewportSize;
    permissions?: string[];
  }): Promise<BrowserContext>;
  newPage(): Promise<Page>;
  close(): Promise<void>;
  version(): string;
  isConnected(): boolean;
}

export interface BrowserType {
  launch(options?: {
    headless?: boolean;
    executablePath?: string;
    args?: string[];
  }): Promise<Browser>;
}

export interface PlaywrightModule {
  chromium: BrowserType;
}

export interface PlaywrightResolution {
  module: PlaywrightModule;
  resolvedPath: string;
  source: string;
}

export interface ChromiumExecutableResolution {
  path: string;
  source: string;
}

export interface PlaywrightProbeResult {
  playwrightFound: boolean;
  playwrightPath: string | null;
  playwrightSource: string | null;
  chromiumFound: boolean;
  chromiumPath: string | null;
  chromiumSource: string | null;
  errors: string[];
}

function getLocalAppDataDir(): string {
  if (process.env.LOCALAPPDATA) {
    return process.env.LOCALAPPDATA;
  }
  return path.join(os.homedir(), 'AppData', 'Local');
}

function sortEntriesDescending(dirs: string[]): string[] {
  return [...dirs].sort((a, b) => {
    try {
      const mtimeDiff = fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
      if (mtimeDiff !== 0) return mtimeDiff;
    } catch {
      // ignore stat errors
    }
    return b.localeCompare(a);
  });
}

function isPlaywrightModuleLike(candidate: unknown): candidate is PlaywrightModule {
  if (!candidate || typeof candidate !== 'object') return false;
  const mod = candidate as { chromium?: { launch?: unknown } };
  return Boolean(mod.chromium && typeof mod.chromium.launch === 'function');
}

export function resolvePlaywright(): { resolution: PlaywrightResolution | null; errors: string[] } {
  const req = createRequire(import.meta.url);
  const errors: string[] = [];

  // 1. Local node_modules (playwright, playwright-core)
  for (const pkgName of ['playwright', 'playwright-core']) {
    try {
      const resolvedPath = req.resolve(pkgName);
      const loaded = req(resolvedPath);
      if (isPlaywrightModuleLike(loaded)) {
        return {
          resolution: {
            module: loaded,
            resolvedPath,
            source: `local node_modules (${pkgName})`,
          },
          errors,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`local ${pkgName}: ${msg}`);
    }
  }

  // 2. Explicit PLAYWRIGHT_PATH env override
  const envPwPath = process.env.PLAYWRIGHT_PATH?.trim();
  if (envPwPath) {
    try {
      if (fs.existsSync(envPwPath)) {
        const loaded = req(envPwPath);
        if (isPlaywrightModuleLike(loaded)) {
          return {
            resolution: {
              module: loaded,
              resolvedPath: envPwPath,
              source: 'PLAYWRIGHT_PATH',
            },
            errors,
          };
        }
        errors.push(`PLAYWRIGHT_PATH (${envPwPath}) did not export chromium.launch`);
      } else {
        errors.push(`PLAYWRIGHT_PATH does not exist: ${envPwPath}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`PLAYWRIGHT_PATH (${envPwPath}): ${msg}`);
    }
  }

  // 3. %LOCALAPPDATA%\npm-cache\_npx\*\node_modules\playwright (and playwright-core)
  const npxRoot = path.join(getLocalAppDataDir(), 'npm-cache', '_npx');
  if (fs.existsSync(npxRoot)) {
    try {
      const subDirs = fs
        .readdirSync(npxRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(npxRoot, d.name));

      const ordered = sortEntriesDescending(subDirs);
      for (const dir of ordered) {
        for (const pkgName of ['playwright', 'playwright-core']) {
          const pkgDir = path.join(dir, 'node_modules', pkgName);
          if (!fs.existsSync(pkgDir)) continue;
          try {
            const loaded = req(pkgDir);
            if (isPlaywrightModuleLike(loaded)) {
              return {
                resolution: {
                  module: loaded,
                  resolvedPath: pkgDir,
                  source: `_npx cache (${pkgName})`,
                },
                errors,
              };
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`_npx ${pkgDir}: ${msg}`);
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`_npx scan error: ${msg}`);
    }
  } else {
    errors.push(`_npx cache directory not found: ${npxRoot}`);
  }

  return { resolution: null, errors };
}

export function findChromiumExecutable(): ChromiumExecutableResolution | null {
  // 1. Explicit PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH override
  const envExe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (envExe && fs.existsSync(envExe)) {
    return { path: envExe, source: 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH' };
  }

  const msPlaywrightDir = path.join(getLocalAppDataDir(), 'ms-playwright');
  if (fs.existsSync(msPlaywrightDir)) {
    try {
      const entries = fs
        .readdirSync(msPlaywrightDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      // 2. chromium_headless_shell-*
      const headlessDirs = sortEntriesDescending(
        entries
          .filter((name) => name.startsWith('chromium_headless_shell-'))
          .map((name) => path.join(msPlaywrightDir, name))
      );
      for (const dir of headlessDirs) {
        const candidates = [
          path.join(dir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
          path.join(dir, 'chrome-headless-shell-linux', 'chrome-headless-shell'),
          path.join(dir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            return { path: candidate, source: 'ms-playwright chromium_headless_shell' };
          }
        }
      }

      // 3. chromium-*
      const chromiumDirs = sortEntriesDescending(
        entries
          .filter((name) => name.startsWith('chromium-'))
          .map((name) => path.join(msPlaywrightDir, name))
      );
      for (const dir of chromiumDirs) {
        const candidates = [
          path.join(dir, 'chrome-win64', 'chrome.exe'),
          path.join(dir, 'chrome-win', 'chrome.exe'),
          path.join(dir, 'chrome-linux', 'chrome'),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            return { path: candidate, source: 'ms-playwright chromium' };
          }
        }
      }
    } catch {
      // ignore scan failures and continue to system Chrome
    }
  }

  // 4. System Google Chrome
  const systemCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const candidate of systemCandidates) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, source: 'System Google Chrome' };
    }
  }

  return null;
}

export function probePlaywrightAvailability(): PlaywrightProbeResult {
  const { resolution, errors } = resolvePlaywright();
  const exe = findChromiumExecutable();

  return {
    playwrightFound: resolution !== null,
    playwrightPath: resolution?.resolvedPath ?? null,
    playwrightSource: resolution?.source ?? null,
    chromiumFound: exe !== null,
    chromiumPath: exe?.path ?? null,
    chromiumSource: exe?.source ?? null,
    errors,
  };
}

export async function launchChromium(options?: {
  headless?: boolean;
  executablePath?: string;
  args?: string[];
}): Promise<{ browser: Browser; playwrightSource: string; chromiumSource: string }> {
  const { resolution, errors } = resolvePlaywright();
  if (!resolution) {
    throw new Error(
      `Playwright module could not be resolved. Checked local node_modules, PLAYWRIGHT_PATH, and _npx cache. Details: ${errors.join(' | ')}`
    );
  }

  const exe = options?.executablePath
    ? { path: options.executablePath, source: 'explicit option' }
    : findChromiumExecutable();

  const launchArgs = options?.args ?? ['--no-sandbox', '--disable-dev-shm-usage'];
  const headless = options?.headless ?? true;

  if (exe) {
    const browser = await resolution.module.chromium.launch({
      headless,
      executablePath: exe.path,
      args: launchArgs,
    });
    return {
      browser,
      playwrightSource: resolution.source,
      chromiumSource: `${exe.source} (${exe.path})`,
    };
  }

  // Fallback to Playwright default binary if installed
  const browser = await resolution.module.chromium.launch({
    headless,
    args: launchArgs,
  });
  return {
    browser,
    playwrightSource: resolution.source,
    chromiumSource: 'Playwright default managed browser',
  };
}
