import re

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("const [annRes, msgRes, asgRes, subRes, attRes, liveRes, resRes, leadRes, anaRes, memRes] = await Promise.all([", "const [annRes, msgRes, asgRes, subRes, liveRes, resRes, leadRes, anaRes, memRes] = await Promise.all([")
content = content.replace("const [annData, msgData, asgData, subData, attData, liveData, resData, leadData, anaData, memData] = await Promise.all([", "const [annData, msgData, asgData, subData, liveData, resData, leadData, anaData, memData] = await Promise.all([")
content = content.replace("attRes.json().catch(() => ({})),", "")
content = content.replace("loadClassrooms", "fetchClassrooms")
content = content.replace("setSelectedClassroomId", "setSelectedClassroom")
content = content.replace(", AttendanceSession", "")

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)

