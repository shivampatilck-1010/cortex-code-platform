const fs = require('fs');
const file = 'src/components/classroom/TwoWorkspaceContainer.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'language={monacoLang}',
  'path={currentKey}\n              language={monacoLang}'
);

fs.writeFileSync(file, content, 'utf8');
