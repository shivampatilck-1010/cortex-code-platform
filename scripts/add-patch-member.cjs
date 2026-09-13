const fs = require('fs');
const path = 'src/app/api/v1/classrooms/[id]/members/[userId]/route.ts';
let content = fs.readFileSync(path, 'utf8');
content += `
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
    const body = await req.json();
    const action = body.action;

    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only teachers can suspend students.' }, { status: 403 });
    }

    const member = await classroomDb.getMember(id, userId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this classroom.' }, { status: 404 });
    }

    if (member.role === 'teacher') {
      return NextResponse.json({ error: 'Cannot suspend the primary instructor.' }, { status: 400 });
    }
    
    const newStatus = action === 'suspend' ? 'suspended' : 'active';
    await classroomDb.addMember({
        ...member,
        status: newStatus
    });

    const user = auth.context?.user || (await ClassroomAuth.getCurrentUser(req));
    realtimeCoordinator.broadcast(
      id,
      newStatus === 'suspended' ? 'student.removed' : 'student.joined',
      {
        userId,
        userName: member.userName,
        removedBy: user.name,
      },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({
      success: true,
      status: newStatus
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update member' }, { status: 500 });
  }
}
`;
fs.writeFileSync(path, content);
