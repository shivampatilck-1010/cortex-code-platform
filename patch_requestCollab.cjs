const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const handleRequestCollaboration = async \(targetUserId: string\) => \{[\s\S]*?if \(data\.request\) \{/;

content = content.replace(regex, "const handleRequestCollaboration = async (targetUserId: string) => {\n    try {\n      const targetUser = room?.participants[targetUserId];\n      const request = {\n        id: 'collab_req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),\n        fromId: participantId,\n        toId: targetUserId,\n        status: 'pending',\n        requestedAt: Date.now(),\n      };\n      \n      showToast(Access request sent to ! Waiting for response...);\n      if (request) {");

fs.writeFileSync(file, content, 'utf8');
