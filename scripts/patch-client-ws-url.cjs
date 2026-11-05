const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/live-class/services/realtime/WebSocketClient.ts');
let content = fs.readFileSync(filePath, 'utf8');

const oldMethod = `  private resolveDefaultUrl(): string {
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      return \`\${protocol}//\${host}:3006\`;
    }
    return 'ws://localhost:3006';
  }`;

const newMethod = `  private resolveDefaultUrl(): string {
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    if (typeof window !== 'undefined' && (window as any).__CORTEX_WS_URL__) {
      return (window as any).__CORTEX_WS_URL__;
    }
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      return \`\${protocol}//\${host}:3002\`;
    }
    return 'ws://localhost:3002';
  }`;

content = content.replace(oldMethod, newMethod);
// Handle CRLF if needed
if (!content.includes('process.env.NEXT_PUBLIC_WS_URL')) {
  const oldMethodCRLF = oldMethod.replace(/\n/g, '\r\n');
  const newMethodCRLF = newMethod.replace(/\n/g, '\r\n');
  content = content.replace(oldMethodCRLF, newMethodCRLF);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated WebSocketClient.ts default URL');
