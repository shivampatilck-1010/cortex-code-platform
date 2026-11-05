const fs = require('fs');
const file = 'src/app/classroom/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const handleLiveSessionClick = async \(\) => \{[\s\S]*?\n  \};/, `const handleLiveSessionClick = async () => {
    if (!selectedClassroom) return;
    router.push(\`/classroom/\${selectedClassroom.id}\`);
  };`);

fs.writeFileSync(file, content, 'utf8');
