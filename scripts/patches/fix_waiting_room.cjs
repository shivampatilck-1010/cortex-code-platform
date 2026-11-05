const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-[#1e202b]">',
  '<div className="pt-4 mt-2 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs border-t border-[#1e202b]">'
);

content = content.replace(
  '<span className="font-mono text-gray-500">Room: <strong className="text-[#ff9100] font-bold">{roomId}</strong></span>',
  '<span className="font-mono text-gray-500 shrink-0">Room: <strong className="text-[#ff9100] font-bold">{roomId}</strong></span>'
);

content = content.replace(
  '<div className="flex items-center space-x-2">',
  '<div className="flex flex-wrap items-center justify-center lg:justify-end gap-2">'
);

fs.writeFileSync(file, content, 'utf8');
