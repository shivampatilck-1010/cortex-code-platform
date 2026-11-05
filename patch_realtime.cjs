const fs = require('fs');
const file = 'src/lib/classroom/realtime.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("case 'workspace_updated':")) {
  content = content.replace(/case 'user_updated':/, "case 'workspace_updated': {\n          const { workspaceId } = payload;\n          if (workspaceId && room.arenaWorkspaces && room.arenaWorkspaces[workspaceId]) {\n            room.arenaWorkspaces[workspaceId] = {\n              ...room.arenaWorkspaces[workspaceId],\n              ...payload\n            };\n            RoomManager.broadcast(classroomId, {\n              type: 'workspace_updated',\n              roomId: classroomId,\n              senderId: userId,\n              payload,\n              timestamp: Date.now()\n            });\n          }\n          break;\n        }\n\n        case 'user_updated':");
  fs.writeFileSync(file, content, 'utf8');
}
