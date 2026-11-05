const fs = require('fs');
const file = 'src/lib/classroom/db/index.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /INSERT OR REPLACE INTO users \([\s\S]*?password_hash\)\s*VALUES\s*\([\s\S]*?\)/,
  `INSERT OR REPLACE INTO users (id, name, email, role, avatar, status, created_at, updated_at, cortex_id, password_hash)\n        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

fs.writeFileSync(file, content, 'utf8');
