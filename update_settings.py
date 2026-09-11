import re

with open('src/lib/classroom/models.ts', 'r') as f:
    content = f.read()

content = content.replace("theme: string;", "theme: string;\n  leaderboardEnabled?: boolean;")

with open('src/lib/classroom/models.ts', 'w') as f:
    f.write(content)

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

content = content.replace("theme: 'dark',", "theme: 'dark',\n        leaderboardEnabled: true,")

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)

with open('src/app/api/v1/classroom/route.ts', 'r') as f:
    content = f.read()

content = content.replace("theme: 'dark',", "theme: 'dark',\n        leaderboardEnabled: true,")

with open('src/app/api/v1/classroom/route.ts', 'w') as f:
    f.write(content)
