import re

file_path = "src/app/classroom/[roomId]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Typing lag fix
content = re.sub(
    r"const handleCodeChangeA = \(code: string\) => \{([\s\S]*?)setRoom\(\(prev\) => \{([\s\S]*?)\}\);",
    r"const handleCodeChangeA = (code: string) => {\1// setRoom removed for performance; yjs handles sync directly",
    content
)

content = re.sub(
    r"const handleCodeChangeB = \(code: string\) => \{([\s\S]*?)setRoom\(\(prev\) => \{([\s\S]*?)\}\);",
    r"const handleCodeChangeB = (code: string) => {\1// setRoom removed for performance; yjs handles sync directly",
    content
)

# 2. Join/Leave fix
content = re.sub(
    r"case 'join': \{([\s\S]*?)const newP = event\.payload\?\.participant;",
    r"case 'student.joined':\n        case 'join': {\n          const newP = event.payload?.participant || {\n            id: event.payload?.userId,\n            name: event.payload?.userName,\n            role: event.payload?.role,\n            isOnline: true\n          };",
    content
)

content = re.sub(
    r"case 'leave': \{([\s\S]*?)const leavingId = event\.payload\?\.participantId \|\| event\.senderId;",
    r"case 'student.left':\n        case 'leave': {\n          const leavingId = event.payload?.userId || event.payload?.participantId || event.senderId || event.actorId;",
    content
)

# 3. Request Collaboration fix
request_collab_pattern = r"const handleRequestCollaboration = async \(targetUserId: string\) => \{[\s\S]*?timestamp: Date\.now\(\),\s*\}\);"

request_collab_repl = """const handleRequestCollaboration = async (targetUserId: string) => {
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
      
      collabClientRef.current?.sendRaw({
        type: 'collaboration_request',
        roomId,
        clientId: participantId,
        senderName: participantName,
        payload: request,
        timestamp: Date.now(),
      });"""

content = re.sub(request_collab_pattern, request_collab_repl, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
