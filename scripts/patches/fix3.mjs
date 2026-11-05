import fs from 'fs';
let code = fs.readFileSync('src/lib/project/db/index.ts', 'utf8');

code = code.replace(/run\(p\.id, p\.ownerId, p\.name, p\.description, p\.language, p\.status, p\.createdAt, p\.updatedAt\)/g, 
"run(p.id || '', p.ownerId || '', p.name || '', p.description || '', p.language || '', p.status || '', p.createdAt || 0, p.updatedAt || 0)");

code = code.replace(/run\(f\.id, f\.projectId, f\.name, f\.path, f\.content, f\.isFolder \? 1 : 0, f\.createdAt, f\.updatedAt\)/g,
"run(f.id || '', f.projectId || '', f.name || '', f.path || '', f.content || '', f.isFolder ? 1 : 0, f.createdAt || 0, f.updatedAt || 0)");

fs.writeFileSync('src/lib/project/db/index.ts', code);
