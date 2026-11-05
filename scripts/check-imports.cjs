const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) results = results.concat(walk(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) results.push(full);
  });
  return results;
}

const targetDir = path.resolve(__dirname, '../src/components/live-class');
const files = walk(targetDir);
const imports = new Set();
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const regex = /from\s+['"](@\/[^'"]+)['"]/g;
  let m;
  while ((m = regex.exec(c)) !== null) {
    imports.add(m[1]);
  }
});
console.log(JSON.stringify(Array.from(imports), null, 2));
