const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("case 'workspace_updated':")) {
  content = content.replace(/case 'user_updated':/, "case 'workspace_updated': {\n          const { workspaceId, activeCode, currentLanguage, activeFileName, isRunning, result } = event.payload || {};\n          if (workspaceId && (workspaceId === 'A' || workspaceId === 'B')) {\n            setRoom((prev) => {\n              if (!prev || !prev.arenaWorkspaces) return prev;\n              const ws = prev.arenaWorkspaces[workspaceId as 'A' | 'B'];\n              if (!ws) return prev;\n              const updated = {\n                ...prev,\n                arenaWorkspaces: {\n                  ...prev.arenaWorkspaces,\n                  [workspaceId]: {\n                    ...ws,\n                    ...(activeCode !== undefined ? { activeCode } : {}),\n                    ...(currentLanguage !== undefined ? { currentLanguage } : {}),\n                    ...(activeFileName !== undefined ? { activeFileName } : {}),\n                    ...(isRunning !== undefined ? { isRunning } : {}),\n                    ...(result !== undefined ? { result } : {}),\n                  },\n                },\n              };\n              roomRef.current = updated;\n              return updated;\n            });\n          }\n          break;\n        }\n\n        case 'user_updated':");
  fs.writeFileSync(file, content, 'utf8');
}
