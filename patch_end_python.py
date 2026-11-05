import re

file_path = "src/app/classroom/[roomId]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = r"const handleEndCollaboration = async \(sessionId: string\) => \{[\s\S]*?fetchRoomState\(participantId\);\s*\};"
repl = """const handleEndCollaboration = async (sessionId: string) => {
    collabClientRef.current?.sendRaw({
      type: 'collaboration_ended',
      roomId,
      clientId: participantId,
      senderName: participantName,
      payload: { sessionId },
      timestamp: Date.now(),
    });
    
    setRoom(prev => {
      if (!prev) return prev;
      const newSessions = { ...prev.collaborationSessions };
      delete newSessions[sessionId];
      return { ...prev, collaborationSessions: newSessions };
    });
    setSlotBUserId(null);
  };"""

content = re.sub(pattern, repl, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
