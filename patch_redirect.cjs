const fs = require('fs');
const file = 'src/app/classroom/[roomId]/live/[sessionId]/LiveClassroomClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// Inside the component, add a redirect
content = content.replace(/export default function LiveClassroomClient\(\{ roomId, sessionId \}: \{ roomId: string, sessionId: string \}\) \{/, `export default function LiveClassroomClient({ roomId, sessionId }: { roomId: string, sessionId: string }) {\n  const router = typeof window !== 'undefined' ? require('next/navigation').useRouter() : null;\n  if (typeof window !== 'undefined') {\n    router?.push(\`/classroom/\${roomId}\`);\n  }\n`);

fs.writeFileSync(file, content, 'utf8');
