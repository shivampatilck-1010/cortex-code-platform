import os, re
files = ['src/lib/classroom/db/index.ts', 'src/lib/project/db/index.ts', 'src/lib/arena/db/index.ts']
out_sql = '-- Migration generated for Cortex Phase 2H\n\n'
for f in files:
    content = open(f, 'r', encoding='utf-8').read()
    for b in re.findall(r'\.exec\((.*?)\)', content, re.DOTALL):
        out_sql += b.strip() + ';\n\n'
    for a in re.findall(r'\.exec\([\''\"](ALTER TABLE.*?)[\''\"]\)', content):
        out_sql += a.strip() + ';\n\n'
os.makedirs('migrations', exist_ok=True)
open('migrations/0001_initial_schema.sql', 'w', encoding='utf-8').write(out_sql)
