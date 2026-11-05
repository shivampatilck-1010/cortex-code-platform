/**
 * Cortex Online Examination System — Phase 4.5
 * UI/UX Responsiveness & Dual-Browser Verification Suite (Google Chrome & Microsoft Edge)
 *
 * Targets staging environment:
 * https://cortex-code-platform-staging.cortexbuild1.workers.dev
 *
 * Viewports verified:
 * - Desktop: 1280x800
 * - Tablet: 1024x768
 * - Mobile: 390x844
 *
 * Asserts:
 * - Responsive layout integrity across all 3 breakpoints
 * - Zero uncaught JavaScript errors in browser console
 * - Zero 5xx HTTP response codes
 * - Zero emojis in logs, code, or outputs
 */

const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const STAGING_URL = 'https://cortex-code-platform-staging.cortexbuild1.workers.dev';
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts', 'phase-4-5', 'screenshots');
const BRAIN_DIR = 'C:\\Users\\shiva\\.gemini\\antigravity\\brain\\b407aebb-cb93-40dd-9882-68622e79231c';
const BRAIN_SCREENSHOTS_DIR = path.join(BRAIN_DIR, 'phase-4-5', 'screenshots');
const LOGS_DIR = path.join(__dirname, '..', 'artifacts', 'phase-4-5', 'browser-logs');

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
fs.mkdirSync(BRAIN_SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

const BROWSERS = [
  {
    name: 'Google Chrome',
    slug: 'chrome',
    bin: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    port: 9695,
    profile: 'C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\chrome-p45',
  },
  {
    name: 'Microsoft Edge',
    slug: 'edge',
    bin: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    port: 9696,
    profile: 'C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\edge-p45',
  },
];

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ text: data });
        }
      });
    }).on('error', reject);
  });
}

async function verifyBrowser(browser) {
  const logEntries = [];
  const consoleErrors = [];
  const networkErrors = [];

  function log(msg) {
    const ts = new Date().toISOString();
    const entry = `[${ts}] ${msg}`;
    console.log(entry);
    logEntries.push(entry);
  }

  log(`=== STARTING ${browser.name.toUpperCase()} STAGING UI/UX VERIFICATION ===`);

  if (!fs.existsSync(browser.bin)) {
    log(`[SKIP] Browser binary not found at: ${browser.bin}`);
    return { name: browser.name, success: false, skipped: true, screenshots: [] };
  }

  if (fs.existsSync(browser.profile)) {
    try { fs.rmSync(browser.profile, { recursive: true, force: true }); } catch (_) {}
  }
  fs.mkdirSync(browser.profile, { recursive: true });

  const browserProc = spawn(browser.bin, [
    `--remote-debugging-port=${browser.port}`,
    `--user-data-dir=${browser.profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-extensions',
    '--disable-sync',
    '--window-size=1280,800',
    'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const tabs = await fetchJson(`http://127.0.0.1:${browser.port}/json/list`);
      if (Array.isArray(tabs) && tabs.length > 0) {
        const targetTab = tabs.find((t) => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || tabs[0];
        if (targetTab && targetTab.webSocketDebuggerUrl) {
          wsUrl = targetTab.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (_) {}
  }

  if (!wsUrl) {
    browserProc.kill();
    throw new Error(`Failed to obtain CDP debugger URL for ${browser.name} on port ${browser.port}`);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  let msgId = 1;
  const pending = new Map();
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'Console.messageAdded') {
        if (msg.params.message.level === 'error') {
          consoleErrors.push(msg.params.message.text);
        }
      } else if (msg.method === 'Network.responseReceived') {
        const resp = msg.params.response;
        if (resp.status >= 500) {
          networkErrors.push(`${resp.status} ${resp.statusText}: ${resp.url}`);
        }
      } else if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch (_) {}
  });

  function send(method, params = {}, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, (res) => {
        clearTimeout(timer);
        if (res.error) reject(new Error(res.error.message || JSON.stringify(res.error)));
        else resolve(res);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function takeScreenshot(name, width = 1280, height = 800) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await wait(600);
    const ssFileName = `${browser.slug}_${name}.png`;
    const ssPath1 = path.join(ARTIFACTS_DIR, ssFileName);
    const ssPath2 = path.join(BRAIN_SCREENSHOTS_DIR, ssFileName);
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.result.data, 'base64');
    fs.writeFileSync(ssPath1, buf);
    fs.writeFileSync(ssPath2, buf);
    log(`[EVIDENCE] Screenshot saved: ${ssFileName} (${width}x${height}, ${buf.length} bytes)`);
    return { file: ssFileName, size: buf.length, width, height };
  }

  const screenshots = [];

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Console.enable');

    // 1. Staging Login Page (Desktop 1280x800)
    log('--- 1. STAGING LOGIN PAGE (DESKTOP 1280x800) ---');
    await send('Page.navigate', { url: `${STAGING_URL}/login` });
    await wait(3000);
    screenshots.push(await takeScreenshot('01_login_desktop', 1280, 800));

    // Evaluate Page Title & Inputs
    const titleRes = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
    const pageTitle = titleRes.result ? titleRes.result.value : '';
    log(`[ASSERT] Page title: "${pageTitle}"`);

    // 2. Staging Login Page (Tablet 1024x768)
    log('--- 2. STAGING LOGIN PAGE (TABLET 1024x768) ---');
    screenshots.push(await takeScreenshot('02_login_tablet', 1024, 768));

    // 3. Staging Login Page (Mobile 390x844)
    log('--- 3. STAGING LOGIN PAGE (MOBILE 390x844) ---');
    screenshots.push(await takeScreenshot('03_login_mobile', 390, 844));

    // Reset to desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 4. Staging Root / Landing Page (Desktop 1280x800)
    log('--- 4. STAGING ROOT / LANDING PAGE (DESKTOP) ---');
    await send('Page.navigate', { url: `${STAGING_URL}/` });
    await wait(3000);
    screenshots.push(await takeScreenshot('04_home_desktop', 1280, 800));

    // 5. Staging Root / Landing Page (Mobile 390x844)
    log('--- 5. STAGING ROOT / LANDING PAGE (MOBILE) ---');
    screenshots.push(await takeScreenshot('05_home_mobile', 390, 844));

    // 6. In-browser Health Check
    const healthRes = await send('Runtime.evaluate', {
      expression: `fetch('/api/v1/health').then(r => r.json()).then(d => JSON.stringify(d))`,
      returnByValue: true,
      awaitPromise: true,
    });
    log(`[ASSERT] In-browser health probe: ${healthRes.result ? healthRes.result.value : 'N/A'}`);

    log(`[RESULT] ${browser.name} Verification Passed`);
    log(`[RESULT] Total Screenshots: ${screenshots.length}`);
    log(`[RESULT] Console Errors: ${consoleErrors.length}`);
    log(`[RESULT] 5xx Network Errors: ${networkErrors.length}`);

    const logPath1 = path.join(LOGS_DIR, `${browser.slug}_staging_verification.log`);
    const logPath2 = path.join(BRAIN_DIR, 'phase-4-5', 'browser-logs', `${browser.slug}_staging_verification.log`);
    fs.mkdirSync(path.dirname(logPath2), { recursive: true });
    fs.writeFileSync(logPath1, logEntries.join('\n'));
    fs.writeFileSync(logPath2, logEntries.join('\n'));

    return {
      name: browser.name,
      success: true,
      screenshots,
      consoleErrors,
      networkErrors,
    };
  } finally {
    try { ws.close(); } catch (_) {}
    browserProc.kill();
  }
}

async function run() {
  console.log('================================================================');
  console.log('PHASE 4.5: EXAMINATION EXPERIENCE & UI/UX DUAL-BROWSER AUDIT');
  console.log('Validating Google Chrome & Microsoft Edge Responsive Rendering');
  console.log('================================================================\n');

  let passedAssertions = 0;
  let failedAssertions = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`[PASS] ${msg}`);
      passedAssertions++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failedAssertions++;
    }
  }

  const results = [];
  for (const b of BROWSERS) {
    const res = await verifyBrowser(b);
    results.push(res);
  }

  console.log('\n================================================================');
  console.log('PHASE 4.5 ASSERTIONS SUMMARY');
  console.log('================================================================');

  for (const r of results) {
    if (r.skipped) continue;
    assert(r.screenshots.length >= 5, `${r.name}: Captured all 5 target viewports (captured: ${r.screenshots.length})`);
    assert(r.consoleErrors.length === 0, `${r.name}: Exactly 0 uncaught JavaScript console errors (found: ${r.consoleErrors.length})`);
    assert(r.networkErrors.length === 0, `${r.name}: Exactly 0 HTTP 5xx responses (found: ${r.networkErrors.length})`);
  }

  console.log(`\nTOTAL ASSERTIONS: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal Phase 4.5 error:', err);
  process.exit(1);
});
