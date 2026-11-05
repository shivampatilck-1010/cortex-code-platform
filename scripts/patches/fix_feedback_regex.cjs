const fs = require('fs');
const file = 'src/lib/classroom/db/index.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /INSERT INTO platform_feedback \([\s\S]*?user_id\)\s*VALUES\s*\([\s\S]*?\)/,
  `INSERT INTO platform_feedback (id, type, title, description, email, severity, category, diagnostics_json, status, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

fs.writeFileSync(file, content, 'utf8');
