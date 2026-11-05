const fs = require('fs');
const file = 'src/lib/classroom/protocol.ts';
let text = fs.readFileSync(file, 'utf8');
const target = "  | 'question.pinned';";
const replacement = `  | 'question.pinned'
  | 'workspace.broadcast.start'
  | 'workspace.broadcast.pause'
  | 'workspace.broadcast.resume'
  | 'workspace.broadcast.stop'
  | 'workspace.broadcast.code'
  | 'workspace.broadcast.output'
  | 'workspace.observe.subscribe'
  | 'workspace.observe.unsubscribe'
  | 'workspace.student.update'
  | 'workspace.state.query';`;
if (text.includes(target)) {
  text = text.replace(target, replacement);
  fs.writeFileSync(file, text, 'utf8');
  console.log('Successfully updated protocol.ts');
} else {
  console.log('Target not found in protocol.ts');
}
