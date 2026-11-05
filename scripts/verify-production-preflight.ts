import { runPreflight } from './preflight-deployment-check.mjs';

async function main() {
  console.log('[PREFLIGHT] Testing production preflight with simulation flag...');
  const res = await runPreflight({ targetEnv: 'production', allowProduction: true });
  console.log(`[PREFLIGHT] Overall Passed: ${res.allPassed}`);
  if (!res.allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[PREFLIGHT ERROR]:', err);
  process.exit(1);
});
