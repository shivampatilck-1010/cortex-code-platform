import re

c = open('src/app/api/v1/classrooms/route.ts', 'r', encoding='utf-8').read()

conflict = '''<<<<<<< HEAD
    const user = await ClassroomAuth.getCurrentUser(req);
    if (user.role !== 'teacher') return NextResponse.json({ error: 'Only teachers can create classrooms' }, { status: 403 });
=======
    const auth = ClassroomAuth.verifyAccess(req, undefined, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Only professors can create classrooms.' }, { status: 403 });
    }

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
>>>>>>> origin/main'''

resolution = '''    const user = await ClassroomAuth.getCurrentUser(req);
    if (user.role !== 'teacher') return NextResponse.json({ error: 'Only professors can create classrooms.' }, { status: 403 });'''

c = c.replace(conflict, resolution)
open('src/app/api/v1/classrooms/route.ts', 'w', encoding='utf-8').write(c)
