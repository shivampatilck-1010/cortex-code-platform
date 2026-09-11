import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';

const NEXT_PORT = 3001;
const WS_PORT = 3002;
const GATEWAY_PORT = 3000;

const nextBin = './node_modules/.bin/next';

// Start Next.js dev server on 3001
const nextChild = spawn(nextBin, ['dev', '-p', String(NEXT_PORT), '-H', '127.0.0.1'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(NEXT_PORT),
  },
});

nextChild.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});

// Gateway server on port 3000
const gateway = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '2' });
      res.end('Classroom platform initializing, please wait a moment...');
    }
  });

  req.pipe(proxyReq, { end: true });
});

// Forward WebSocket upgrades
gateway.on('upgrade', (req, clientSocket, head) => {
  const url = req.url || '';
  const isClassroomWs =
    url.includes('/ws') ||
    url.includes('/events') ||
    url.includes('/classrooms/') ||
    url.includes('/classroom/');

  const targetPort = isClassroomWs ? WS_PORT : NEXT_PORT;

  const targetSocket = net.createConnection({ port: targetPort, host: '127.0.0.1' }, () => {
    targetSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      targetSocket.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
    }
    targetSocket.write('\r\n');
    if (head && head.length > 0) {
      targetSocket.write(head);
    }
    targetSocket.pipe(clientSocket);
    clientSocket.pipe(targetSocket);
  });

  targetSocket.on('error', () => {
    clientSocket.destroy();
  });
  clientSocket.on('error', () => {
    targetSocket.destroy();
  });
});

gateway.listen(GATEWAY_PORT, '0.0.0.0', () => {
  console.log(`[Cortex Classroom Gateway] Listening on port ${GATEWAY_PORT} (HTTP -> ${NEXT_PORT}, Classroom WS -> ${WS_PORT})`);
});

process.on('SIGINT', () => {
  nextChild.kill('SIGINT');
  gateway.close();
});
process.on('SIGTERM', () => {
  nextChild.kill('SIGTERM');
  gateway.close();
});
