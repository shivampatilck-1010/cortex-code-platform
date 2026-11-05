const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const handleRequestCollaboration = async \(targetUserId: string\) => \{[\s\S]*?timestamp: Date\.now\(\),\s*\}\);/m;

const replacement = const handleRequestCollaboration = async (targetUserId: string) => {
    try {
      const targetUser = room?.participants[targetUserId];
      const request = {
        id: 'collab_req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        fromId: participantId,
        toId: targetUserId,
        status: 'pending',
        requestedAt: Date.now(),
      };
      
      const targetName = targetUser && targetUser.name ? targetUser.name : 'participant';
      showToast('Access request sent to ' + targetName + '! Waiting for response...');
      if (request) {
        collabClientRef.current?.sendRaw({
          type: 'collaboration_request',
          roomId,
          clientId: participantId,
          senderName: participantName,
          payload: request,
          timestamp: Date.now(),
        });;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
