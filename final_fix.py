import re

with open('src/app/api/v1/classrooms/[id]/assignments/[asgId]/submit/route.ts', 'r') as f:
    content = f.read()

# I will replace the erroneous block entirely
erroneous_block = """    if (assignment.attemptsAllowed > 0 && version > assignment.attemptsAllowed) {
      return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 400 });
    }
    const studentPrior = classroomDb.getStudentSubmission(asgId, user.id);
    const version = (studentPrior?.version || 0) + 1;

    if (assignment.attemptsAllowed > 0 && version > assignment.attemptsAllowed) {
      return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 400 });
    }"""

correct_block = """    const studentPrior = classroomDb.getStudentSubmission(asgId, user.id);
    const version = (studentPrior?.version || 0) + 1;

    if (assignment.attemptsAllowed > 0 && version > assignment.attemptsAllowed) {
      return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 400 });
    }"""

content = content.replace(erroneous_block, correct_block)

with open('src/app/api/v1/classrooms/[id]/assignments/[asgId]/submit/route.ts', 'w') as f:
    f.write(content)
