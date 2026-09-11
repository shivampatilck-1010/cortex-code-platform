import re

with open('src/lib/classroom/models.ts', 'r') as f:
    content = f.read()

content = content.replace("codingActivityHours: number;", "codingActivityHours: number;\n  assignmentsAttempted?: number;\n  questionsAsked?: number;\n  liveSessionsJoined?: number;")

with open('src/lib/classroom/models.ts', 'w') as f:
    f.write(content)

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

content = content.replace("codingActivityHours: 14.5,", "codingActivityHours: 14.5,\n      assignmentsAttempted: studentSubs.length,\n      questionsAsked: 4,\n      liveSessionsJoined: 2,")

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)

