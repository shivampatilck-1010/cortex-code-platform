const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /case 'leave': \{([\s\S]*?)const leavingId = event\.payload\?\.participantId \|\| event\.senderId;/,
  "case 'student.left':\n        case 'leave': {\n          const leavingId = event.payload?.userId || event.payload?.participantId || event.senderId || event.actorId;"
);

fs.writeFileSync(file, content, 'utf8');
