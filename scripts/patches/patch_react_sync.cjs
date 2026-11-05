const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace handleCodeChangeA
content = content.replace(
  /const handleCodeChangeA = \(code: string\) => \{([\s\S]*?)setRoom\(\(prev\) => \{([\s\S]*?)\}\);/m,
  'const handleCodeChangeA = (code: string) => {// setRoom removed for performance; yjs handles sync directly'
);

// Replace handleCodeChangeB
content = content.replace(
  /const handleCodeChangeB = \(code: string\) => \{([\s\S]*?)setRoom\(\(prev\) => \{([\s\S]*?)\}\);/m,
  'const handleCodeChangeB = (code: string) => {// setRoom removed for performance; yjs handles sync directly'
);

fs.writeFileSync(file, content, 'utf8');
