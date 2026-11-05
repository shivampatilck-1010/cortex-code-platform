const fs = require('fs');
const file = 'src/components/classroom/TwoWorkspaceContainer.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update docId
const oldDocId = "const docId = user ? \user_\_\\ : '';";
const newDocId = "const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : 'room';\n  const docId = \oom_\_workspace_\_\\;";
content = content.replace(oldDocId, newDocId);

// currentKey
const oldKey = "const currentKey = user ? \\:\:\\ : '';";
const newKey = "const currentKey = \\:\:\\;";
content = content.replace(oldKey, newKey);

fs.writeFileSync(file, content, 'utf8');
