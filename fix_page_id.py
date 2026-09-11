import re

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("setSelectedClassroom(c.id)", "setSelectedClassroom(c)")
content = content.replace("import { Classroom, ClassroomMember, ClassroomAssignment, ClassroomSubmission, ClassroomSession, ClassroomResource, AttendanceSession } from '@/lib/classroom/models';", "import { Classroom, ClassroomMember, ClassroomAssignment, ClassroomSubmission, ClassroomSession, ClassroomResource } from '@/lib/classroom/models';")

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)

