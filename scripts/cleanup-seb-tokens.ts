import { register } from 'node:module';

register(new URL('../node_modules/next/loader.mjs', import.meta.url));

async function run() {
  try {
    const { classroomDb } = await import('../src/lib/classroom/db/index.ts');
    const purged = await classroomDb.cleanupExpiredSebTokens(Date.now());
    console.log(`[SEB Maintenance] Purged ${purged} expired launch tokens at ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    console.error('[SEB Maintenance] Failed to cleanup expired tokens:', err);
    process.exit(1);
  }
}

run();
