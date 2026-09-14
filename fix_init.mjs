import fs from 'fs';

let code = fs.readFileSync('src/lib/project/db/index.ts', 'utf8');

const initRegex = /private async init\(\) \{[\s\S]*?private async createTables\(\) \{/m;

const newInit = `private async init() {
    if (this.initialized) return;
    try {
        const dataDir = path.join(process.cwd(), 'data');
        this.dbPath = path.join(dataDir, 'cortex_classroom.db');
        this.db = await getDbInstance(this.dbPath);
    } catch(e) {
        console.warn('[ProjectDatabase] Failed to init DB:', e);
        this.db = null;
    }
    this.initialized = true;
    if (this.db) {
        await this.createTables();
    }
  }

  private async createTables() {`;

code = code.replace(initRegex, newInit);

fs.writeFileSync('src/lib/project/db/index.ts', code);
