const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /case 'join': \{([\s\S]*?)const newP = event\.payload\?\.participant;/,
  "case 'student.joined':\n        case 'join': {\n          const newP = event.payload?.participant || {\n            id: event.payload?.userId,\n            name: event.payload?.userName,\n            role: event.payload?.role,\n            isOnline: true\n          };"
);

content = content.replace(
  /case 'leave': \{([\s\S]*?)const leftId = event\.payload\?\.userId;/,
  "case 'student.left':\n        case 'leave': {\n          const leftId = event.payload?.userId || event.actorId;"
);

fs.writeFileSync(file, content, 'utf8');
