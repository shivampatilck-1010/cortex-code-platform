import re

with open('src/lib/classroom/durable-object.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''async onMessage(senderWs: any, msgStr: string, meta: SessionMeta) {
    // Rate Limiting & Abuse Prevention Configurations
    const MAX_PAYLOAD_SIZE = 64 * 1024; // 64 KB
    const MAX_YJS_UPDATE_SIZE = 512 * 1024; // 512 KB
    const RATE_LIMIT_MESSAGES = 100;
    const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds

    if (msgStr.length > MAX_YJS_UPDATE_SIZE) {
      console.warn([Security] Client  sent oversized message of  bytes. Dropping.);
      senderWs.send(JSON.stringify({ type: 'error', payload: { code: 'PAYLOAD_TOO_LARGE', message: 'Message size exceeds maximum allowed.' } }));
      return; // Drop message
    }

    const now = Date.now();
    if (!meta.messageCount) meta.messageCount = 0;
    if (!meta.windowStart) meta.windowStart = now;

    if (now - meta.windowStart > RATE_LIMIT_WINDOW_MS) {
      meta.messageCount = 0;
      meta.windowStart = now;
    }
    meta.messageCount++;

    if (meta.messageCount > RATE_LIMIT_MESSAGES) {
      console.warn([Security] Client  rate limited. Count: . Disconnecting.);
      senderWs.close(1008, 'Rate limit exceeded');
      return;
    }
'''

content = content.replace('async onMessage(senderWs: any, msgStr: string, meta: SessionMeta) {', replacement)

with open('src/lib/classroom/durable-object.ts', 'w', encoding='utf-8') as f:
    f.write(content)
