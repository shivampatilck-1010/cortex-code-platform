import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

# Add to CREATE TABLE IF NOT EXISTS resources
content = content.replace("unit TEXT NOT NULL,\n        created_at INTEGER NOT NULL,", "unit TEXT NOT NULL,\n        created_at INTEGER NOT NULL,\n        pinned INTEGER DEFAULT 0,\n        visibility TEXT DEFAULT 'public',")

content = content.replace("INSERT OR REPLACE INTO resources (id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at)", "INSERT OR REPLACE INTO resources (id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility)")
content = content.replace("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
content = content.replace("res.description, res.unit, res.createdAt);", "res.description, res.unit, res.createdAt, res.pinned ? 1 : 0, res.visibility || 'public');")

# In listResources, read pinned and visibility
content = content.replace("createdAt: r.created_at,", "createdAt: r.created_at,\n      pinned: r.pinned === 1,\n      visibility: r.visibility || 'public',")

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)

