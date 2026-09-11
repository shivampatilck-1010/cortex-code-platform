import re

with open('src/app/api/v1/notifications/route.ts', 'r') as f:
    content = f.read()

content = content.replace("classroomDb.db", "classroomDb.markAllNotificationsRead(user.id)")
content = content.replace("if (classroomDb.markAllNotificationsRead(user.id)) {\n        classroomDb.markAllNotificationsRead(user.id).prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')\n          .run(Date.now(), user.id);\n      }", "classroomDb.markAllNotificationsRead(user.id);")

with open('src/app/api/v1/notifications/route.ts', 'w') as f:
    f.write(content)
