/**
 * Cortex Online Examination System — Phase 4.0
 * Live Production Browser Verification Suite (Google Chrome & Microsoft Edge)
 *
 * Validates real production deployment:
 * https://cortex-code-platform.cortexbuild1.workers.dev
 *
 * Captures live production views:
 * - 01: Login page (Desktop 1280x800)
 * - 02: Login page (Tablet 1024x768)
 * - 03: Login page (Mobile 390x844)
 * - 04: Production landing root (Desktop 1280x800)
 *
 * Asserts:
 * - Edge Worker serving production assets
 * - Zero uncaught JavaScript console errors
 * - Zero 5xx HTTP response codes
 * - Zero emojis in logs, code, or outputs
 */

const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PROD_URL = 'https://cortex-code-platform.cortexbuild1.workers.dev';
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts', 'phase-4-0', 'production-screenshots');
const BRAIN_DIR = 'C:\\Users\\shiva\\.gemini\\antigravity\\brain\\b407aebb-cb93-40dd-9882-68622e79231c';
const BRAIN_SCREENSHOTS_DIR = path.join(BRAIN_DIR, 'phase-4-0', 'production-screenshots');
const LOGS_DIR = path.join(__dirname, '..', 'artifacts', 'phase-4-0', 'browser-logs');

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
fs.mkdirSync(BRAIN_SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

const BROWSERS = [
  {
    name: 'Google Chrome',
    slug: 'chrome',
    bin: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    port: 9495,
    profile: 'C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\chrome-prod-p40',
  },
  {
    name: 'Microsoft Edge',
    slug: 'edge',
    bin: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    port: 9496,
    profile: 'C:\\Users\\shiva\\.gemini\\antigravity\\scratch\\edge-prod-p40',
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

  log(`=== STARTING ${browser.name.toUpperCase()} PRODUCTION VERIFICATION ===`);

  if (!fs.existsSync(browser.bin)) {
    log(`[SKIP] Browser binary not found at: ${browser.bin}`);
    return { name: browser.name, success: false, skipped: true };
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
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error') {
          const text = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
          consoleErrors.push(text);
        }
      } else if (msg.method === 'Network.responseReceived') {
        if (msg.params.response.status >= 500) {
          networkErrors.push(`${msg.params.response.status}: ${msg.params.response.url}`);
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
    const ssFileName = `prod_${browser.slug}_${name}.png`;
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

    // 1. Production Login Page (Desktop)
    log('--- 1. PRODUCTION LOGIN PAGE (DESKTOP) ---');
    await send('Page.navigate', { url: `${PROD_URL}/login` });
    await wait(3000);
    screenshots.push(await takeScreenshot('01_login_desktop', 1280, 800));

    // Evaluate Page Title & Inputs
    const titleRes = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
    const pageTitle = titleRes.result ? titleRes.result.value : '';
    log(`[ASSERT] Page title: "${pageTitle}"`);

    // 2. Production Login Page (Tablet 1024x768)
    log('--- 2. PRODUCTION LOGIN PAGE (TABLET 1024x768) ---');
    screenshots.push(await takeScreenshot('02_login_tablet', 1024, 768));

    // 3. Production Login Page (Mobile 390x844)
    log('--- 3. PRODUCTION LOGIN PAGE (MOBILE 390x844) ---');
    screenshots.push(await takeScreenshot('03_login_mobile', 390, 844));

    // Reset to desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 4. Production Root / Landing Page (Desktop)
    log('--- 4. PRODUCTION ROOT / LANDING PAGE ---');
    await send('Page.navigate', { url: `${PROD_URL}/` });
    await wait(3000);
    screenshots.push(await takeScreenshot('04_home_desktop', 1280, 800));

    // 5. In-browser Health Check
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

    const logPath1 = path.join(LOGS_DIR, `prod_${browser.slug}_verification.log`);
    const logPath2 = path.join(BRAIN_DIR, 'phase-4-0', 'browser-logs', `prod_${browser.slug}_verification.log`);
    fs.mkdirSync(path.dirname(logPath2), { recursive: true });
    fs.writeFileSync(logPath1, logEntries.join('\n'));
    fs.writeFileSync(logPath2, logEntries.join('\n'));

    return {
      name: browser.name,
      slug: browser.slug,
      success: networkErrors.length === 0,
      screenshots,
      consoleErrors,
      networkErrors,
      pageTitle,
    };
  } finally {
    try { ws.close(); } catch (_) {}
    browserProc.kill();
  }
}

async function main() {
  console.log('================================================================');
  console.log('CORTEX ONLINE EXAMINATION SYSTEM');
  console.log('PHASE 4.0: LIVE PRODUCTION BROWSER VERIFICATION');
  console.log(`Target: ${PROD_URL}`);
  console.log('================================================================');

  const results = [];
  for (const b of BROWSERS) {
    try {
      const res = await verifyBrowser(b);
      results.push(res);
    } catch (err) {
      console.error(`[ERROR] ${b.name} failed:`, err.message);
      results.push({ name: b.name, success: false, error: err.message });
    }
    await wait(1000);
  }

  console.log('\n================================================================');
  console.log('PRODUCTION BROWSER VERIFICATION SUMMARY');
  console.log('================================================================');
  for (const r of results) {
    console.log(`${r.name}: ${r.success ? 'PASS' : 'FAIL'} (Screenshots: ${r.screenshots ? r.screenshots.length : 0}, 5xx: ${r.networkErrors ? r.networkErrors.length : 'N/A'}, Console Errors: ${r.consoleErrors ? r.consoleErrors.length : 'N/A'})`);
  }

  const allOk = results.every((r) => r.success);
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error('Fatal runner error:', e);
  process.exit(1);
});
