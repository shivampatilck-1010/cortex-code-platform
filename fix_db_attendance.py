import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

# Delete startAttendanceSession, getActiveAttendanceSession, markAttendance, closeAttendanceSession
content = re.sub(r'startAttendanceSession[\s\S]*?closeAttendanceSession[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n', '', content)

content = content.replace('private db: Database.Database | null = null;', 'public db: Database.Database | null = null;')

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)

