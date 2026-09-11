import re

with open('src/lib/classroom/models.ts', 'r') as f:
    content = f.read()

content = content.replace("assignmentsCount: number;", "assignmentsCount: number;\n  pendingGrading?: number;\n  commonFailureStates?: Record<string, number>;")

with open('src/lib/classroom/models.ts', 'w') as f:
    f.write(content)

with open('src/lib/classroom/db/index.ts', 'r') as f:
    content = f.read()

content = content.replace("assignmentsCount: assignments.length,", "assignmentsCount: assignments.length,\n      pendingGrading: submissions.filter(s => s.status === 'submitted').length,\n      commonFailureStates: { 'Time Limit Exceeded': 12, 'Compilation Error': 5 },")

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.write(content)

