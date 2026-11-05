const fs = require('fs');
const file = 'src/components/classroom/TwoWorkspaceContainer.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<Editor\n            height="100%"\n            language={monacoLang}\n            defaultValue={user.activeCode}\n            theme="vs-dark"',
  '<Editor\n            path={currentKey}\n            height="100%"\n            language={monacoLang}\n            defaultValue={user.activeCode}\n            theme="vs-dark"'
);

fs.writeFileSync(file, content, 'utf8');
