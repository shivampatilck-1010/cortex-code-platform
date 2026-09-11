import re

with open('src/app/api/v1/classrooms/[id]/assignments/[asgId]/submit/route.ts', 'r') as f:
    content = f.read()

# Just remove the first occurrence of `if (assignment.attemptsAllowed > 0 && version > assignment.attemptsAllowed)`
bad_str = """    if (assignment.attemptsAllowed > 0 && version > assignment.attemptsAllowed) {
      return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 400 });
    }"""
content = content.replace(bad_str, "", 1)

with open('src/app/api/v1/classrooms/[id]/assignments/[asgId]/submit/route.ts', 'w') as f:
    f.write(content)
