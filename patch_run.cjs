const fs = require('fs');
const file = 'src/components/classroom/TwoWorkspaceContainer.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const handleRunA = async \(\) => \{[\s\S]*?setIsRunningA\(false\);\n  \};/, `const handleRunA = async () => {
    setIsRunningA(true);
    setResultA(null);
    try {
      const roomId = window.location.pathname.split('/')[2];
      const res = await fetch(\`/api/v1/classrooms/\${roomId}/arena/run\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'A' })
      });
      const data = await res.json();
      setResultA(data.result || { success: false, error: data.error || 'Execution failed' });
    } catch (e: any) {
      setResultA({ success: false, error: e.message || 'Execution error' });
    }
    setIsRunningA(false);
  };`);

content = content.replace(/const handleRunB = async \(\) => \{[\s\S]*?setIsRunningB\(false\);\n  \};/, `const handleRunB = async () => {
    setIsRunningB(true);
    setResultB(null);
    try {
      const roomId = window.location.pathname.split('/')[2];
      const res = await fetch(\`/api/v1/classrooms/\${roomId}/arena/run\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'B' })
      });
      const data = await res.json();
      setResultB(data.result || { success: false, error: data.error || 'Execution failed' });
    } catch (e: any) {
      setResultB({ success: false, error: e.message || 'Execution error' });
    }
    setIsRunningB(false);
  };`);

fs.writeFileSync(file, content, 'utf8');
