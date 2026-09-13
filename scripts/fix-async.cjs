const fs = require('fs');
let content = fs.readFileSync('src/lib/classroom/db/index.ts', 'utf8');

content = content.replace(/  (public |private )?([a-zA-Z0-9_]+)\(([^)]*)\) (:\s*[a-zA-Z0-9_<>|\[\]\s]+\s*)?\{/g, (match, access, name, params, ret) => {
  if (name === 'constructor') return match;
  if (match.includes('async ')) return match;
  return `  ${access || ''}async ${name}(${params})${ret || ''} {`;
});

// Fix one more syntax error: "await this.db.prepare('...').get()" which doesn't use getDb!
// line 510: const count = await this.db.prepare('SELECT COUNT(*) as c FROM classrooms').get() as { c: number };
content = content.replace(/await this\.db\.prepare/g, '(await this.getDb()).prepare');

fs.writeFileSync('src/lib/classroom/db/index.ts', content);
