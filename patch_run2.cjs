const fs = require('fs');
const file = 'src/components/classroom/TwoWorkspaceContainer.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldA = `const handleRunA = async () => {
    if (!userA || isRunningA) return;
    setIsRunningA(true);
    try {
      const activeFileName = userA.activeFileName || 'main.py';
      const liveCode = editorARef.current ? editorARef.current.getValue() : (userA.activeCode || '');
      const fileList =
        userA.files && userA.files.length > 0
          ? userA.files.map((f) => (f.name === activeFileName ? { ...f, content: liveCode } : f))
          : [{ id: '1', name: activeFileName, path: \`/\${activeFileName}\`, content: liveCode }];
      const res = await executeInCloudSandbox({
        language: userA.currentLanguage || 'python',
        files: fileList,
      });
      setResultA(res);
    } catch (err: any) {
      setResultA({
        status: 'runtime_error',
        stdout: '',
        stderr: err?.message || 'Execution error in Workspace A',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
    } finally {
      setIsRunningA(false);
    }
  };`;

const newA = `const handleRunA = async () => {
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
      setResultA({ success: false, error: e.message || 'Execution error' } as any);
    }
    setIsRunningA(false);
  };`;

content = content.replace(oldA, newA);

const oldB = `const handleRunB = async () => {
    if (!userB || isRunningB) return;
    setIsRunningB(true);
    try {
      const activeFileName = userB.activeFileName || 'main.py';
      const liveCode = editorBRef.current ? editorBRef.current.getValue() : (userB.activeCode || '');
      const fileList =
        userB.files && userB.files.length > 0
          ? userB.files.map((f) => (f.name === activeFileName ? { ...f, content: liveCode } : f))
          : [{ id: '2', name: activeFileName, path: \`/\${activeFileName}\`, content: liveCode }];
      const res = await executeInCloudSandbox({
        language: userB.currentLanguage || 'python',
        files: fileList,
      });
      setResultB(res);
    } catch (err: any) {
      setResultB({
        status: 'runtime_error',
        stdout: '',
        stderr: err?.message || 'Execution error in Workspace B',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
    } finally {
      setIsRunningB(false);
    }
  };`;

const newB = `const handleRunB = async () => {
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
      setResultB({ success: false, error: e.message || 'Execution error' } as any);
    }
    setIsRunningB(false);
  };`;

content = content.replace(oldB, newB);

fs.writeFileSync(file, content, 'utf8');
