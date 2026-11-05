import sys

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("fetch(/api/v1/classrooms/?hard=true", "fetch(`/api/v1/classrooms/${selectedClassroom.id}?hard=true`")

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)

print("Patched successfully.")
