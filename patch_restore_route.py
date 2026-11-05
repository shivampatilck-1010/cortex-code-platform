import sys

with open('src/app/api/v1/classrooms/[id]/route.ts', 'r') as f:
    content = f.read()

target = '''    if (body.name !== undefined) updates.name = body.name.trim();'''

replacement = '''    if (body.action === 'restore') {
      const restored = await classroomDb.restoreClassroom(id);
      if (restored) {
        const user = auth.context?.user || (await ClassroomAuth.getCurrentUser(req));
        realtimeCoordinator.broadcast(
          id,
          'classroom.restored',
          { classroom: restored },
          { id: user.id, name: user.name }
        );
        return NextResponse.json({ success: true, classroom: restored });
      }
      return NextResponse.json({ error: 'Failed to restore classroom' }, { status: 500 });
    }

    if (body.name !== undefined) updates.name = body.name.trim();'''

content = content.replace(target, replacement)

with open('src/app/api/v1/classrooms/[id]/route.ts', 'w') as f:
    f.write(content)

print("Route patched.")
