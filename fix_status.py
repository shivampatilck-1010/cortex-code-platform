import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

content = content.replace("s.status === 'submitted'", "s.status === 'pending'")

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)
