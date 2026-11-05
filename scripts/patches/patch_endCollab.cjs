const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const handleEndCollaboration = async \(sessionId: string\) => \{[\s\S]*?fetchRoomState\(participantId\);\s*\};/;

const replacement = const handleEndCollaboration = async (sessionId: string) => {
    collabClientRef.current?.sendRaw({
      type: 'collaboration_ended',
      roomId,
      clientId: participantId,
      senderName: participantName,
      payload: { sessionId },
      timestamp: Date.now(),
    });
    
    // Optimistically update locally
    setRoom(prev => {
      if (!prev) return prev;
      const newSessions = { ...prev.collaborationSessions };
      delete newSessions[sessionId];
      return { ...prev, collaborationSessions: newSessions };
    });
    setSlotBUserId(null);
  };;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
