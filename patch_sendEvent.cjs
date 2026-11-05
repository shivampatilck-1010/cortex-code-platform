const fs = require('fs');
const file = 'src/lib/classroom/collab-sync.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /public async sendEvent\(event: Partial<ClassroomEventMessage>\) \{[\s\S]*?await this\.sendRaw\(\{[\s\S]*?type: \(event\.type \|\| 'presence'\) as any,[\s\S]*?roomId: this\.roomId,[\s\S]*?clientId: this\.participantId,[\s\S]*?senderName: this\.participantName,[\s\S]*?payload: event\.payload,[\s\S]*?timestamp: Date\.now\(\),[\s\S]*?\}\);[\s\S]*?\}/,
  "public async sendEvent(event: Partial<ClassroomEventMessage>) {\n    await this.sendRaw({\n      type: 'event',\n      roomId: this.roomId,\n      clientId: this.participantId,\n      senderName: this.participantName,\n      payload: { event },\n      timestamp: Date.now(),\n    });\n  }"
);

fs.writeFileSync(file, content, 'utf8');
