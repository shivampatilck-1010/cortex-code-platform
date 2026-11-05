const fs = require('fs');
const file = 'src/app/globals.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('overflow: hidden;', '');
content = content.replace('user-select: none;', '');

fs.writeFileSync(file, content, 'utf8');
