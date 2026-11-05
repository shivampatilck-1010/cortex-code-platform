/**
 * LIVE PRODUCTION VERIFICATION - CORTEX PROJECT TEAMS PHASE 1
 * Production URL: https://cortex-code-platform.cortexbuild1.workers.dev
 */

const assert = require('assert');

const BASE_URL = 'https://cortex-code-platform.cortexbuild1.workers.dev';
const DEMO_CLASS_ID = 'CLS_DEMO_DSA_2026';

// Session cookie from verified teacher usr_mubernpn8x1dc
const TEACHER_COOKIE = 'cortex_session=cac0819cf530f20e9a072a84fa5e9bc4a93605927b1ab825e5dd334f63e20cce';

async function main() {
  console.log('------------------------------------------------------------');
  console.log('LIVE PRODUCTION VERIFICATION - CORTEX PROJECT TEAMS PHASE 1');
  console.log(`Target: ${BASE_URL}`);
  console.log('------------------------------------------------------------\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  // 1. Probe /classroom page
  await test('Production Web: GET /classroom returns HTTP 200 with HTML content', async () => {
    const res = await fetch(`${BASE_URL}/classroom`, {
      headers: {
        'Cookie': TEACHER_COOKIE,
      },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert.ok(html.includes('<!DOCTYPE html>') || html.includes('<html'), 'Must return HTML document');
  });

  // 2. Classroom Creation Permission Enforcement (Security check)
  await test('Security: POST /api/v1/classrooms without teacher session rejects unauthorized request', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Unauthorized Student Class',
      }),
    });
    assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error, 'Must return error message');
  });

  // 3. Team Settings Endpoint
  await test('API: GET /api/v1/classrooms/:id/teams/settings returns team formation configuration', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${DEMO_CLASS_ID}/teams/settings`, {
      headers: {
        'Cookie': TEACHER_COOKIE,
      },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.settings, 'Response must include settings');
  });

  // 4. Team Gallery Endpoint
  await test('API: GET /api/v1/classrooms/:id/teams/gallery returns project cards collection', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${DEMO_CLASS_ID}/teams/gallery`, {
      headers: {
        'Cookie': TEACHER_COOKIE,
      },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(Array.isArray(data.cards), 'Response must contain cards array');
  });

  // 5. Team Activity Log Endpoint
  await test('API: GET /api/v1/classrooms/:id/teams/activity returns project activity audit log', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${DEMO_CLASS_ID}/teams/activity`, {
      headers: {
        'Cookie': TEACHER_COOKIE,
      },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const actList = data.activities || data.activity;
    assert.ok(Array.isArray(actList), 'Response must contain activity list');
  });

  // 6. Team Formation Studio Endpoint
  await test('API: GET /api/v1/classrooms/:id/teams/studio returns aggregated stats and roster', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${DEMO_CLASS_ID}/teams/studio`, {
      headers: {
        'Cookie': TEACHER_COOKIE,
      },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.stats, 'Response must include stats');
    assert.ok(typeof data.stats.totalStudents === 'number', 'Must include totalStudents');
    assert.ok(Array.isArray(data.teams), 'Response must include teams array');
    assert.ok(Array.isArray(data.unassignedStudents), 'Response must include unassignedStudents array');
  });

  // 7. Auto-Assignment Balanced Distribution Preview
  let previewToken = null;
  await test('API: POST /api/v1/classrooms/:id/teams/auto-assign/preview returns equal-size distribution and HMAC token', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${DEMO_CLASS_ID}/teams/auto-assign/preview`, {
      method: 'POST',
      headers: {
        'Cookie': TEACHER_COOKIE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetCount: 3,
        strategy: 'reassign_all',
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.previewToken, 'Must return signed previewToken');
    assert.ok(data.proposedTeams || data.distribution, 'Must return proposed teams');
    previewToken = data.previewToken;
  });

  // 8. Create Project Team via Production API
  let createdTeamId = null;
  const uniqueSuffix = Date.now().toString().slice(-4);
  const teamName = `Team Beta-${uniqueSuffix}`;
  const projectTitle = 'Neural Architecture Search for Low-Power TPU';

  await test('API: POST /api/v1/classrooms/:id/teams creates a new project team with preset', async () => {
    const teamPayload = {
      name: teamName,
      projectTitle: projectTitle,
      description: 'Distributed training and benchmark evaluation of quantized neural models.',
      maxSize: 5,
      themePreset: 'neural',
      repoUrl: 'https://github.com/cortex-org/nas-lowpower-tpu',
    };

    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${DEMO_CLASS_ID}/teams`, {
      method: 'POST',
      headers: {
        'Cookie': TEACHER_COOKIE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamPayload),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.team, 'Must return created team object');
    assert.strictEqual(data.team.projectTitle, projectTitle);
    assert.strictEqual(data.team.themePreset, 'neural');
    createdTeamId = data.team.id;
  });

  // 9. Update Theme Preset via Theme Studio Endpoint
  await test('API: POST /api/v1/classrooms/:id/teams/:teamId/theme applies aurora preset', async () => {
    if (!createdTeamId) throw new Error('Team ID was not created');
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${DEMO_CLASS_ID}/teams/${createdTeamId}/theme`, {
      method: 'POST',
      headers: {
        'Cookie': TEACHER_COOKIE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        theme_preset_id: 'aurora',
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.theme_preset_id, 'aurora');
  });

  // 10. Verify Updated Gallery Cards reflect created team and theme
  await test('API: GET /api/v1/classrooms/:id/teams/gallery reflects new team with updated theme', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${DEMO_CLASS_ID}/teams/gallery`, {
      headers: {
        'Cookie': TEACHER_COOKIE,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const found = data.cards.find(c => c.id === createdTeamId);
    assert.ok(found, 'Created team must appear in gallery cards');
    const theme = found.themePreset || found.theme_preset_id;
    assert.strictEqual(theme, 'aurora', 'Theme preset must reflect aurora update');
  });

  console.log('\n------------------------------------------------------------');
  console.log(`LIVE PRODUCTION RESULT: ${passed} / ${total} tests passed.`);
  console.log('------------------------------------------------------------');

  if (passed !== total) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
