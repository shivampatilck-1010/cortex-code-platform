/**
 * Cortex Lockdown: Live Staging Environment HTTP Verification Suite
 *
 * Executes live HTTPS requests against https://cortex-code-platform-staging.cortexbuild1.workers.dev
 * to verify actual edge deployment of download pages, streaming APIs, static assets, and security boundaries.
 *
 * Strictly zero emojis.
 */

import crypto from 'node:crypto';

const BASE_URL = 'https://cortex-code-platform-staging.cortexbuild1.workers.dev';

const EXPECTED_ZIP_SHA256 = '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30';
const EXPECTED_EXE_SHA256 = '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895';
const EXPECTED_ZIP_BYTES = 18700;
const EXPECTED_EXE_BYTES = 35840;

interface TestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(id: string, name: string, category: string, passed: boolean, details: string) {
  results.push({ id, name, category, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${id}: ${name} (${category})`);
  console.log(`       Details: ${details}`);
}

async function runLiveTests() {
  console.log('================================================================');
  console.log(`CORTEX LOCKDOWN: LIVE STAGING HTTP DEPLOYMENT VERIFICATION`);
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  // Test 1: Download Web Page
  console.log('--- Test Group 1: Website Download Page ---');
  try {
    const pageRes = await fetch(`${BASE_URL}/lockdown/download`);
    const pageHtml = await pageRes.text();
    const pageValid =
      pageRes.status === 200 &&
      pageHtml.includes('Cortex Lockdown') &&
      pageHtml.includes('CortexLockdown-Windows-x64.zip') &&
      pageHtml.includes(EXPECTED_ZIP_SHA256) &&
      pageHtml.includes(EXPECTED_EXE_SHA256);
    record(
      'STAGE-WEB-01',
      'Live Download Page HTTP 200 & Cortex Lockdown Identity',
      'Category C: Integration Test (Live Staging HTTP)',
      pageValid,
      `HTTP ${pageRes.status}, Content-Length: ${pageHtml.length} bytes, SHA-256 strings verified in HTML`
    );
  } catch (err: any) {
    record('STAGE-WEB-01', 'Live Download Page HTTP 200', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // Test 2: Operational Version API
  console.log('\n--- Test Group 2: Operational Version API ---');
  try {
    const verRes = await fetch(`${BASE_URL}/api/v1/version`);
    const verJson = await verRes.json();
    const verValid =
      verRes.status === 200 &&
      verJson.version === '1.0.0-rc1.2' &&
      verJson.protocol === 'cortex-lockdown://' &&
      verJson.codeSigningStatus === 'UNSIGNED';
    record(
      'STAGE-VER-01',
      'Operational Version Endpoint (/api/v1/version) Integrity',
      'Category C: Integration Test (Live Staging HTTP)',
      verValid,
      `HTTP ${verRes.status}, Version: ${verJson.version}, Protocol: ${verJson.protocol}, Signing: ${verJson.codeSigningStatus}`
    );
  } catch (err: any) {
    record('STAGE-VER-01', 'Operational Version Endpoint', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // Test 3: Metadata Endpoint
  console.log('\n--- Test Group 3: Download Metadata Endpoint ---');
  try {
    const metaRes = await fetch(`${BASE_URL}/api/v1/lockdown/downloads`);
    const metaJson = await metaRes.json();
    const metaValid =
      metaRes.status === 200 &&
      metaJson.version === '1.0.0-rc1.2' &&
      metaJson.artifacts?.portableZip?.sha256 === EXPECTED_ZIP_SHA256 &&
      metaJson.artifacts?.hardenedExe?.sha256 === EXPECTED_EXE_SHA256;
    record(
      'STAGE-META-01',
      'Download Metadata Route (/api/v1/lockdown/downloads) Verification',
      'Category C: Integration Test (Live Staging HTTP)',
      metaValid,
      `HTTP ${metaRes.status}, Metadata version: ${metaJson.version}, Hashes: [Portable ZIP & Hardened EXE matched]`
    );
  } catch (err: any) {
    record('STAGE-META-01', 'Download Metadata Route', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // Test 4: Live Binary Streaming: Portable ZIP
  console.log('\n--- Test Group 4: Live Binary Download: Portable ZIP ---');
  try {
    const zipRes = await fetch(`${BASE_URL}/api/v1/lockdown/downloads/CortexLockdown-Windows-x64.zip`);
    const zipArrayBuf = await zipRes.arrayBuffer();
    const zipBuf = Buffer.from(zipArrayBuf);
    const zipHash = crypto.createHash('sha256').update(zipBuf).digest('hex').toUpperCase();

    const zipValid =
      zipRes.status === 200 &&
      zipBuf.length === EXPECTED_ZIP_BYTES &&
      zipHash === EXPECTED_ZIP_SHA256 &&
      zipRes.headers.get('content-type')?.includes('application/zip');

    record(
      'STAGE-DL-01',
      'Live Streaming Download: CortexLockdown-Windows-x64.zip',
      'Category C: Integration Test (Live Staging HTTP)',
      zipValid,
      `HTTP ${zipRes.status}, Size: ${zipBuf.length} bytes (expected ${EXPECTED_ZIP_BYTES}), SHA-256: ${zipHash} (Match: ${zipHash === EXPECTED_ZIP_SHA256})`
    );
  } catch (err: any) {
    record('STAGE-DL-01', 'Live Streaming Download: Portable ZIP', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // Test 5: Live Binary Streaming: Hardened EXE
  console.log('\n--- Test Group 5: Live Binary Download: Hardened EXE ---');
  try {
    const exeRes = await fetch(`${BASE_URL}/api/v1/lockdown/downloads/CortexLockdown-Hardened.exe`);
    const exeArrayBuf = await exeRes.arrayBuffer();
    const exeBuf = Buffer.from(exeArrayBuf);
    const exeHash = crypto.createHash('sha256').update(exeBuf).digest('hex').toUpperCase();

    const exeValid =
      exeRes.status === 200 &&
      exeBuf.length === EXPECTED_EXE_BYTES &&
      exeHash === EXPECTED_EXE_SHA256;

    record(
      'STAGE-DL-02',
      'Live Streaming Download: CortexLockdown-Hardened.exe',
      'Category C: Integration Test (Live Staging HTTP)',
      exeValid,
      `HTTP ${exeRes.status}, Size: ${exeBuf.length} bytes (expected ${EXPECTED_EXE_BYTES}), SHA-256: ${exeHash} (Match: ${exeHash === EXPECTED_EXE_SHA256})`
    );
  } catch (err: any) {
    record('STAGE-DL-02', 'Live Streaming Download: Hardened EXE', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // Test 6: Static Asset Route: Portable ZIP
  console.log('\n--- Test Group 6: Static Asset Edge Delivery: Portable ZIP ---');
  try {
    const staticZipRes = await fetch(`${BASE_URL}/downloads/CortexLockdown-Windows-x64.zip`);
    const staticZipArrayBuf = await staticZipRes.arrayBuffer();
    const staticZipBuf = Buffer.from(staticZipArrayBuf);
    const staticZipHash = crypto.createHash('sha256').update(staticZipBuf).digest('hex').toUpperCase();

    const staticZipValid =
      staticZipRes.status === 200 &&
      staticZipBuf.length === EXPECTED_ZIP_BYTES &&
      staticZipHash === EXPECTED_ZIP_SHA256;

    record(
      'STAGE-ASSET-01',
      'Cloudflare Edge Static Asset Cache: CortexLockdown-Windows-x64.zip',
      'Category C: Integration Test (Live Staging HTTP)',
      staticZipValid,
      `HTTP ${staticZipRes.status}, Size: ${staticZipBuf.length} bytes, SHA-256: ${staticZipHash} (Match: ${staticZipHash === EXPECTED_ZIP_SHA256})`
    );
  } catch (err: any) {
    record('STAGE-ASSET-01', 'Static Asset Edge Delivery: Portable ZIP', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // Test 7: Static Asset Route: Hardened EXE
  console.log('\n--- Test Group 7: Static Asset Edge Delivery: Hardened EXE ---');
  try {
    const staticExeRes = await fetch(`${BASE_URL}/downloads/CortexLockdown-Hardened.exe`);
    const staticExeArrayBuf = await staticExeRes.arrayBuffer();
    const staticExeBuf = Buffer.from(staticExeArrayBuf);
    const staticExeHash = crypto.createHash('sha256').update(staticExeBuf).digest('hex').toUpperCase();

    const staticExeValid =
      staticExeRes.status === 200 &&
      staticExeBuf.length === EXPECTED_EXE_BYTES &&
      staticExeHash === EXPECTED_EXE_SHA256;

    record(
      'STAGE-ASSET-02',
      'Cloudflare Edge Static Asset Cache: CortexLockdown-Hardened.exe',
      'Category C: Integration Test (Live Staging HTTP)',
      staticExeValid,
      `HTTP ${staticExeRes.status}, Size: ${staticExeBuf.length} bytes, SHA-256: ${staticExeHash} (Match: ${staticExeHash === EXPECTED_EXE_SHA256})`
    );
  } catch (err: any) {
    record('STAGE-ASSET-02', 'Static Asset Edge Delivery: Hardened EXE', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // Test 8: Invalid Filename Rejection (HTTP 404)
  console.log('\n--- Test Group 8: Invalid Filename Rejection ---');
  try {
    const invRes = await fetch(`${BASE_URL}/api/v1/lockdown/downloads/unauthorized-payload.exe`);
    const invValid = invRes.status === 404;
    record(
      'STAGE-SEC-01',
      'Arbitrary Filename Download Rejection (HTTP 404)',
      'Category C: Integration Test (Live Staging HTTP)',
      invValid,
      `HTTP ${invRes.status} (Expected 404 for non-whitelisted payload)`
    );
  } catch (err: any) {
    record('STAGE-SEC-01', 'Arbitrary Filename Download Rejection', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // Test 9: Path Traversal Rejection
  console.log('\n--- Test Group 9: Path Traversal Security Defense ---');
  try {
    const travRes = await fetch(`${BASE_URL}/api/v1/lockdown/downloads/..%2f..%2fpackage.json`);
    const travValid = travRes.status === 404;
    record(
      'STAGE-SEC-02',
      'Path Traversal Defense: Encoded Dot-Dot Rejection (HTTP 404)',
      'Category C: Integration Test (Live Staging HTTP)',
      travValid,
      `HTTP ${travRes.status} (Arbitrary file traversal blocked by edge router)`
    );
  } catch (err: any) {
    record('STAGE-SEC-02', 'Path Traversal Defense', 'Category C: Integration Test (Live Staging HTTP)', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL LIVE STAGING TESTS: ${total}`);
  console.log(`PASSED:                   ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`FAILED:                   ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveTests().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
