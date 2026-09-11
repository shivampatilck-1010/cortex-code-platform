import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

# I will replace exactly what was injected:
#       createdAt: r.created_at,
#       pinned: r.pinned === 1,
#       visibility: r.visibility || 'public',
# 
# with just:
#       createdAt: r.created_at,

content = content.replace("createdAt: r.created_at,\n      pinned: r.pinned === 1,\n      visibility: r.visibility || 'public',", "createdAt: r.created_at,")

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)

