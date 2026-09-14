import fs from 'fs';

function fixFile(filepath, dbpath) {
  let content = fs.readFileSync(filepath, 'utf-8');
  
  // replace getDb
  content = content.replace(/(?:private\s+)?(?:async\s+)?getDb\(\)\s*:\s*Promise<DBInstance\s*\|\s*null>\s*\{[\s\S]*?(?=\s*(?:private\s+)?async\s+init\(\))/m, 
\  async getDb(): Promise<DBInstance | null> {
    if (this.db) return this.db;
    this.db = (await getDbInstance('\')) as any;
    if (this.db) {
      await this.init();
    }
    return this.db;
  }\);
  
  fs.writeFileSync(filepath, content, 'utf-8');
}

fixFile('src/lib/arena/db/index.ts', '.cortex/data/arena.db');
fixFile('src/lib/project/db/index.ts', '.cortex/data/projects.db');
fixFile('src/lib/classroom/db/index.ts', 'data/cortex_classroom.db');
