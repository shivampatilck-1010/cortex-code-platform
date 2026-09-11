import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

# Remove constructor body
content = re.sub(r'constructor\(\)\s*\{\s*this\.init\(\);\s*\}', 'constructor() {}', content)

# Change this.db. to this.getDb(). everywhere
content = content.replace('this.db.', 'this.getDb().')
content = content.replace('this.db!', 'this.getDb()')
content = content.replace('if (!this.db)', 'if (!this.getDb())')

# Add getDb() method
get_db = """
  private getDb() {
    this.init();
    return this.db!;
  }
"""
content = content.replace('private init() {', get_db + '\n  private init() {')

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)
