const fs = require('fs');
const file = 'src/app/register/page.tsx';
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    '<div className="min-h-screen',
    '<div className="min-h-screen overflow-y-auto'
  );
  fs.writeFileSync(file, content, 'utf8');
}
