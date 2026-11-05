import { getAuthoritativeIceServers } from '../src/lib/classroom/ice-servers';

function runIceTurnTests() {
  console.log('================================================================');
  console.log('TASK 2 — WEBRTC STUN & TURN ICE CONFIGURATION TEST SUITE');
  console.log('Testing secure, ephemeral TURN credentials & STUN fallbacks');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  // Backup original environment variables
  const origTurnUrls = process.env.CORTEX_TURN_URLS;
  const origTurnSecret = process.env.CORTEX_TURN_SECRET;
  const origTtl = process.env.CORTEX_TURN_TTL_SECONDS;
  const origCustomJson = process.env.CORTEX_ICE_SERVERS_JSON;

  try {
    // Test 1: Unconfigured TURN returns STUN-only development mode
    delete process.env.CORTEX_TURN_URLS;
    delete process.env.CORTEX_TURN_SECRET;
    delete process.env.CORTEX_ICE_SERVERS_JSON;

    const devConfig = getAuthoritativeIceServers('usr_test_123');
    assert(
      devConfig.isTurnConfigured === false &&
        devConfig.mode === 'stun-only' &&
        devConfig.iceServers.length >= 1 &&
        devConfig.iceServers.some((s) => JSON.stringify(s.urls).includes('stun.l.google.com')),
      'Test 1: Unconfigured TURN returns graceful STUN-only mode with Google public STUN servers'
    );

    // Test 2: Valid TURN config generates dynamic HMAC-SHA1 ephemeral credentials
    process.env.CORTEX_TURN_URLS = 'turn:turn.cortex.edu:3478?transport=udp,turns:turn.cortex.edu:5349?transport=tcp';
    process.env.CORTEX_TURN_SECRET = 'production-very-secure-secret-key-999';
    process.env.CORTEX_TURN_TTL_SECONDS = '3600'; // 1 hour

    const turnConfig = getAuthoritativeIceServers('usr_teacher_shivam');
    assert(
      turnConfig.isTurnConfigured === true &&
        turnConfig.mode === 'stun-and-turn' &&
        turnConfig.iceServers.length >= 2,
      'Test 2: Configured TURN returns mode "stun-and-turn" with dynamic ICE entries'
    );

    // Test 3: Ephemeral username format and TTL expiration
    const turnServer = turnConfig.iceServers.find((s) => s.username && s.credential);
    assert(
      Boolean(turnServer && typeof turnServer.username === 'string' && typeof turnServer.credential === 'string'),
      'Test 3: Ephemeral username and credential generated'
    );

    const [expiryTimestamp, userIdInUsername] = (turnServer?.username || '').split(':');
    const expiryNum = Number(expiryTimestamp);
    const nowSec = Math.floor(Date.now() / 1000);

    assert(
      expiryNum > nowSec && expiryNum <= nowSec + 3605 && userIdInUsername === 'usr_teacher_shivam',
      'Test 4: Username contains valid Unix timestamp expiring in 1 hour and clean user ID'
    );

    // Test 5: Secret key is never returned or leaked in client payload
    const serialized = JSON.stringify(turnConfig);
    assert(
      !serialized.includes('production-very-secure-secret-key-999'),
      'Test 5: Shared TURN signing secret is strictly omitted from client-facing payload'
    );

    // Test 6: Managed custom ICE servers JSON parsing
    delete process.env.CORTEX_TURN_URLS;
    delete process.env.CORTEX_TURN_SECRET;
    process.env.CORTEX_ICE_SERVERS_JSON = JSON.stringify([
      { urls: 'turn:global.relay.metered.ca:80', username: 'managed_user', credential: 'managed_pass' },
    ]);

    const managedConfig = getAuthoritativeIceServers('usr_student_alex');
    assert(
      managedConfig.isTurnConfigured === true &&
        managedConfig.mode === 'stun-and-turn' &&
        managedConfig.iceServers.some((s) => s.username === 'managed_user'),
      'Test 6: Managed custom ICE servers JSON parsed and combined with STUN fallback'
    );

    // Test 7: Handles malformed JSON gracefully without crashing
    process.env.CORTEX_ICE_SERVERS_JSON = '{ not valid json';
    const recoveredConfig = getAuthoritativeIceServers('usr_student_alex');
    assert(
      recoveredConfig.mode === 'stun-only' && recoveredConfig.isTurnConfigured === false,
      'Test 7: Malformed custom JSON recovers gracefully to STUN-only development mode'
    );
    delete process.env.CORTEX_ICE_SERVERS_JSON;

    // Test 8: Static LIVE_CLASS_TURN_URL with USERNAME and CREDENTIAL
    process.env.LIVE_CLASS_TURN_URL = 'turn:turn.legacy.cortex.edu:3478';
    process.env.LIVE_CLASS_TURN_USERNAME = 'legacy_turn_user';
    process.env.LIVE_CLASS_TURN_CREDENTIAL = 'legacy_turn_credential_123';

    const staticTurnConfig = getAuthoritativeIceServers('usr_student_static');
    assert(
      staticTurnConfig.isTurnConfigured === true &&
        staticTurnConfig.mode === 'stun-and-turn' &&
        staticTurnConfig.iceServers.some((s) => s.username === 'legacy_turn_user' && s.credential === 'legacy_turn_credential_123'),
      'Test 8: Static LIVE_CLASS_TURN_URL, USERNAME, and CREDENTIAL alias parsed successfully'
    );
    delete process.env.LIVE_CLASS_TURN_URL;
    delete process.env.LIVE_CLASS_TURN_USERNAME;
    delete process.env.LIVE_CLASS_TURN_CREDENTIAL;
  } finally {
    // Restore original env
    if (origTurnUrls) process.env.CORTEX_TURN_URLS = origTurnUrls; else delete process.env.CORTEX_TURN_URLS;
    if (origTurnSecret) process.env.CORTEX_TURN_SECRET = origTurnSecret; else delete process.env.CORTEX_TURN_SECRET;
    if (origTtl) process.env.CORTEX_TURN_TTL_SECONDS = origTtl; else delete process.env.CORTEX_TURN_TTL_SECONDS;
    if (origCustomJson) process.env.CORTEX_ICE_SERVERS_JSON = origCustomJson; else delete process.env.CORTEX_ICE_SERVERS_JSON;
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runIceTurnTests();
