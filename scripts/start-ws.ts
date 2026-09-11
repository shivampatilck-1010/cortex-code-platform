import { ensureNodeWsServer } from '../src/lib/classroom/node-ws-server';

async function main() {
  const port = await ensureNodeWsServer(3002);
  console.log(`[Classroom WS Daemon] Authoritative WebSocket server active on port ${port}`);
}

main().catch((err) => {
  console.error('[Classroom WS Daemon] Failed to start:', err);
  process.exit(1);
});
