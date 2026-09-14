const fs = require('fs');
let sql = '-- Cortex Phase 2H Initial Schema\n\n';
['src/lib/classroom/db/index.ts', 'src/lib/project/db/index.ts', 'src/lib/arena/db/index.ts'].forEach(f => {
    const c = fs.readFileSync(f, 'utf8');
    const matches = [...c.matchAll(/\.exec\(\`([\s\S]*?)\`\)/g)];
    matches.forEach(m => sql += m[1].trim() + ';\n\n');
    const alters = [...c.matchAll(/\.exec\(['"](ALTER TABLE.*?)['"]\)/g)];
    alters.forEach(a => sql += a[1].trim() + ';\n\n');
});
fs.mkdirSync('migrations', {recursive: true});
fs.writeFileSync('migrations/0001_initial_schema.sql', sql);
