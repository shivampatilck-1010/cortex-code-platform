import re
import os

with open('src/app/api/v1/classroom/route.ts', 'r') as f:
    content = f.read()
content = re.sub(r"\s*attendanceMode:\s*'self_checkin',", "", content)
with open('src/app/api/v1/classroom/route.ts', 'w') as f:
    f.write(content)

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()
content = re.sub(r"\s*AttendanceSession,\s*AttendanceRecord,", "", content)
content = re.sub(r"\s*attendanceMode:\s*'self_checkin',", "", content)
content = re.sub(r"\s*attendanceRate:\s*95,", "", content)
with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)

