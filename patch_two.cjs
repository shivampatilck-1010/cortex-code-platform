const fs = require('fs');
const file = 'src/components/classroom/TwoWorkspaceContainer.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update Props interface
content = content.replace(/userB\?: ClassroomParticipant \| null;/, "userB?: ClassroomParticipant | null;\n  arenaWorkspaces?: any;");

// Update Component signature
content = content.replace(/userB,\s+currentUserId,/, "userB,\n  arenaWorkspaces,\n  currentUserId,");

// Update execution handles to hit /api/v1/classrooms/[roomId]/arena/run
content = content.replace(/const handleRunA = async \(\) => \{[\s\S]*?setIsRunningA\(false\);\n  \};/, "const handleRunA = async () => {\n    setIsRunningA(true);\n    setResultA(null);\n    try {\n      const roomId = window.location.pathname.split('/')[2];\n      const res = await fetch(`/api/v1/classrooms/${roomId}/arena/run`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ workspaceId: 'A' })\n      });\n      const data = await res.json();\n      setResultA(data.result || { success: false, error: data.error || 'Execution failed' });\n    } catch (e: any) {\n      setResultA({ success: false, error: e.message || 'Execution error' });\n    }\n    setIsRunningA(false);\n  };");

content = content.replace(/const handleRunB = async \(\) => \{[\s\S]*?setIsRunningB\(false\);\n  \};/, "const handleRunB = async () => {\n    setIsRunningB(true);\n    setResultB(null);\n    try {\n      const roomId = window.location.pathname.split('/')[2];\n      const res = await fetch(`/api/v1/classrooms/${roomId}/arena/run`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ workspaceId: 'B' })\n      });\n      const data = await res.json();\n      setResultB(data.result || { success: false, error: data.error || 'Execution failed' });\n    } catch (e: any) {\n      setResultB({ success: false, error: e.message || 'Execution error' });\n    }\n    setIsRunningB(false);\n  };");

// Add Run Both button
content = content.replace(/<div className="flex items-center space-x-2">/g, "<div className=\"flex items-center space-x-2\">\n          {/* Run Both button if both workspaces exist */}\n          {(userA || userB) && (\n            <button\n              onClick={async () => {\n                setIsRunningA(true);\n                setIsRunningB(true);\n                try {\n                  const roomId = window.location.pathname.split('/')[2];\n                  const res = await fetch(`/api/v1/classrooms/${roomId}/arena/run`, {\n                    method: 'POST',\n                    headers: { 'Content-Type': 'application/json' },\n                    body: JSON.stringify({ workspaceId: 'BOTH' })\n                  });\n                  const data = await res.json();\n                  setResultA(data.resultA || { success: false, error: 'Execution failed' });\n                  setResultB(data.resultB || { success: false, error: 'Execution failed' });\n                } catch (e: any) {\n                  setResultA({ success: false, error: e.message });\n                  setResultB({ success: false, error: e.message });\n                }\n                setIsRunningA(false);\n                setIsRunningB(false);\n              }}\n              className=\"px-3 py-1 bg-[#ff9100] text-black font-bold rounded text-xs hover:bg-[#ffaa33] transition\"\n            >\n              Run Both\n            </button>\n          )}\n");

// Update WorkspaceColumn to use arenaWorkspaces
// 1. Pass workspace to WorkspaceColumn
content = content.replace(/user=\{userA\}/, "user={userA}\n          workspace={arenaWorkspaces?.A}");
content = content.replace(/user=\{userB\}/, "user={userB}\n          workspace={arenaWorkspaces?.B}");
content = content.replace(/slotLabel="Workspace A"/, "slotLabel=\"Workspace A\"\n          workspaceId=\"A\"");
content = content.replace(/slotLabel="Workspace B"/, "slotLabel=\"Workspace B\"\n          workspaceId=\"B\"");

// 2. Add workspace to WorkspaceColumnProps
content = content.replace(/user\?: ClassroomParticipant \| null;/, "user?: ClassroomParticipant | null;\n  workspace?: any;\n  workspaceId: 'A' | 'B';");
content = content.replace(/user,\n  currentUserId/, "user,\n  workspace,\n  workspaceId,\n  currentUserId");

// 3. Update docId in WorkspaceColumn
const oldDocId = "const docId = user ? `user_${user.id}_${user?.activeFileName || 'main.py'}` : '';";
const newDocId = "const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : 'room';\n  const docId = `room_${roomId}_workspace_${workspaceId}_${workspace?.activeFileName || 'main.py'}`;";
content = content.replace(oldDocId, newDocId);

// 4. Update currentKey
const oldKey = "const currentKey = user ? `${user.id}:${user.activeFileName || 'main.py'}:${docId}` : '';";
const newKey = "const currentKey = `${workspaceId}:${workspace?.activeFileName || 'main.py'}:${docId}`;";
content = content.replace(oldKey, newKey);

// 5. Update localEmittedCodeRef and getOrCreateDoc to use workspace.activeCode
content = content.replace(/localEmittedCodeRef.current = user.activeCode \|\| '';/, "localEmittedCodeRef.current = workspace?.activeCode || '';");
content = content.replace(/editor.setValue\(user.activeCode \|\| ''\);/, "editor.setValue(workspace?.activeCode || '');");
content = content.replace(/collabClient.getOrCreateDoc\(docId, user.activeCode \|\| ''\);/g, "collabClient.getOrCreateDoc(docId, workspace?.activeCode || '');");
content = content.replace(/const incomingCode = user.activeCode \?\? '';/g, "const incomingCode = workspace?.activeCode ?? '';");
content = content.replace(/const localEmittedCodeRef = useRef<string>\(user\?.activeCode \|\| ''\);/, "const localEmittedCodeRef = useRef<string>(workspace?.activeCode || '');");

// 6. Update user?.activeCode to workspace?.activeCode in useEffect dependencies
content = content.replace(/\[user\?.activeCode, canEdit, isSelf, docId, collabClient\]/, "[workspace?.activeCode, canEdit, isSelf, docId, collabClient]");

// 7. Update language to use workspace.currentLanguage
content = content.replace(/const lang = user\?.currentLanguage \|\| 'python';/, "const lang = workspace?.currentLanguage || 'python';");

fs.writeFileSync(file, content, 'utf8');
