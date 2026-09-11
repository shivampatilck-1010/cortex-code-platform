import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

# We need to find `listResources(classroomId: string): ClassroomResource[] {`
# and the return map.
pattern = r'(listResources\([^)]+\): ClassroomResource\[\] \{[\s\S]*?)(createdAt: r\.created_at,)'
# replace the group 2 with `createdAt: r.created_at, pinned: r.pinned === 1, visibility: r.visibility || 'public',`

content = re.sub(pattern, r"\1\2\n      pinned: r.pinned === 1,\n      visibility: r.visibility || 'public',", content, count=1)

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)
