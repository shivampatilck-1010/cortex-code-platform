const fs = require('fs');
const file = 'src/app/classroom/[roomId]/assignments/builder/[asgId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<div className="min-h-screen flex flex-col bg-[#0b0c0e] text-white">',
  '<div className="h-screen w-full flex flex-col bg-[#0b0c0e] text-white overflow-hidden">'
);

fs.writeFileSync(file, content, 'utf8');
