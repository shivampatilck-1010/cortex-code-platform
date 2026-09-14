import re

def fix(filepath, dbpath):
    with open(filepath, 'r', encoding='utf-8') as f:
        c = f.read()

    # Strip old DBInstance and wrappers
    c = re.sub(r'interface DBInstance \{[\s\S]*?\}\n', '', c)
    c = re.sub(r'class SqliteWrapper [\s\S]*?\}\n  \}\n\}', '', c)
    c = re.sub(r'class D1Wrapper [\s\S]*?\}\n  \}\n\}', '', c)

    c = "import { DBInstance, getDbInstance } from '@/lib/db';\n" + c

    # Regex to replace getDb
    c = re.sub(r'(?:private\s+)?(?:async\s+)?getDb\(\)\s*:\s*Promise<DBInstance\s*\|\s*null>\s*\{[\s\S]*?(?=\s*(?:private\s+)?async\s+init\(\))', 
f'''  async getDb(): Promise<DBInstance | null> {{
    if (this.db) return this.db;
    this.db = (await getDbInstance('{dbpath}')) as any;
    if (this.db) {{
      await this.init();
    }}
    return this.db;
  }}

''', c)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(c)

fix('src/lib/arena/db/index.ts', '.cortex/data/arena.db')
fix('src/lib/project/db/index.ts', '.cortex/data/projects.db')
fix('src/lib/classroom/db/index.ts', 'data/cortex_classroom.db')
