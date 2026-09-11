import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

func = """
  markAllNotificationsRead(userId: string) {
    this.getDb().prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(Date.now(), userId);
  }
"""

content = content.replace("markNotificationRead(id: string) {", func + "\n  markNotificationRead(id: string) {")

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)
