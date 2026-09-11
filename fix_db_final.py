import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

content = re.sub(r'\s*this\.createAttendanceSession\(\{[\s\S]*?\}\);', '', content)
content = re.sub(r'\s*createAttendanceSession\([\s\S]*?closeAttendanceSession[\s\S]*?\}\n', '\n', content)
content = re.sub(r'export\s+interface\s+AttendanceSession[\s\S]*?\}', '', content)
content = re.sub(r'export\s+interface\s+AttendanceRecord[\s\S]*?\}', '', content)

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)
