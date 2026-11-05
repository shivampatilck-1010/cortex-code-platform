const fs = require('fs');
const file = 'src/app/classroom/[roomId]/live/[sessionId]/LiveClassroomClient.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/export default function LiveClassroomClient\(\{ roomId, sessionId \}: \{ roomId: string, sessionId: string \}\) \{[\s\S]*?const router = useRouter\(\);/, `export default function LiveClassroomClient({ roomId, sessionId }: { roomId: string, sessionId: string }) {\n  const router = useRouter();\n\n  // Redirect to the new unified Arena interface\n  useEffect(() => {\n    router.push(\`/classroom/\${roomId}\`);\n  }, [roomId, router]);\n`);

fs.writeFileSync(file, content, 'utf8');
