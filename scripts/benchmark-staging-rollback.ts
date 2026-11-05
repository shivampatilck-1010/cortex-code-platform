import { performance } from 'perf_hooks';
import { execSync } from 'child_process';

async function main() {
  console.log('[ROLLBACK BENCHMARK] Step 1: Querying current active deployment...');
  const listOut = execSync('npx wrangler deployments list --config dist/server/wrangler.json', { encoding: 'utf8' });
  console.log(listOut.split('\n').slice(-15).join('\n'));

  // Target previous version: 26d0c9e0-68eb-4925-a99a-902717dbe0f1
  const prevVersion = '26d0c9e0-68eb-4925-a99a-902717dbe0f1';
  // Hardened target version: c180eeaa-e0d6-4519-bd3a-7ffda0054e85
  const hardenedVersion = 'c180eeaa-e0d6-4519-bd3a-7ffda0054e85';

  console.log(`[ROLLBACK BENCHMARK] Step 2: Rolling back to previous version ${prevVersion}...`);
  const t0 = performance.now();
  const out1 = execSync(`npx wrangler rollback ${prevVersion} --config dist/server/wrangler.json -m "Phase 4.0 staging rollback timing test" -y`, { encoding: 'utf8' });
  const duration1 = Math.round(performance.now() - t0);
  console.log(`[ROLLBACK BENCHMARK] Rollback to previous version completed in ${duration1}ms:\n${out1}`);

  console.log(`[ROLLBACK BENCHMARK] Step 3: Rolling forward to hardened version ${hardenedVersion}...`);
  const t1 = performance.now();
  const out2 = execSync(`npx wrangler rollback ${hardenedVersion} --config dist/server/wrangler.json -m "Restore hardened Phase 4.0 build" -y`, { encoding: 'utf8' });
  const duration2 = Math.round(performance.now() - t1);
  console.log(`[ROLLBACK BENCHMARK] Rollback forward completed in ${duration2}ms:\n${out2}`);

  console.log(`[ROLLBACK BENCHMARK] SUMMARY:`);
  console.log(`- Rollback to prior version: ${duration1}ms`);
  console.log(`- Roll forward to hardened version: ${duration2}ms`);
  console.log(`- Mean rollback latency: ${Math.round((duration1 + duration2) / 2)}ms`);
}

main().catch((err) => {
  console.error('[ROLLBACK BENCHMARK] FAILED:', err);
  process.exit(1);
});
