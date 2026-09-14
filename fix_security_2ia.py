"""Phase 2I-A security hardening patches."""
import os

CSRF_GUARD = '''    // CSRF: Validate Content-Type to reject cross-origin form posts
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid Content-Type. Expected application/json.' }, { status: 415 });
    }

'''

def patch_insert_after(path, find_str, insert_str):
    if not os.path.exists(path):
        print(f'  SKIP (not found): {path}')
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'Invalid Content-Type' in content:
        print(f'  SKIP (already patched): {path}')
        return
    if find_str not in content:
        print(f'  SKIP (pattern not found): {path}')
        return
    new_content = content.replace(find_str, find_str + insert_str, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'  PATCHED: {path}')

# 1. classrooms/route.ts — POST
patch_insert_after(
    r'src/app/api/v1/classrooms/route.ts',
    'export async function POST(req: NextRequest) {\n  try {\n',
    CSRF_GUARD
)

# 2. classrooms/join/route.ts
patch_insert_after(
    r'src/app/api/v1/classrooms/join/route.ts',
    'export async function POST(req: NextRequest) {\n  try {\n',
    CSRF_GUARD
)

# 3. projects/route.ts
patch_insert_after(
    r'src/app/api/v1/projects/route.ts',
    'export async function POST(req: NextRequest) {\n  try {\n',
    CSRF_GUARD
)

# 4. Submissions route: verify assignmentId belongs to the classroom
print('Patching submissions route assignmentId cross-classroom check...')
sub_path = r'src/app/api/v1/classrooms/[id]/submissions/route.ts'
with open(sub_path, 'r', encoding='utf-8') as f:
    sub_content = f.read()

OLD_ASID = "    const assignmentId = req.nextUrl.searchParams.get('assignmentId');\n    let submissions: Submission[] = assignmentId\n      ? await classroomDb.listSubmissions(assignmentId)\n      : await classroomDb.listSubmissionsForClassroom(id);"

NEW_ASID = "    const assignmentId = req.nextUrl.searchParams.get('assignmentId');\n    // Security: verify assignmentId belongs to this classroom (prevents cross-classroom IDOR)\n    if (assignmentId) {\n      const assignment = await classroomDb.getAssignment(assignmentId);\n      if (!assignment || assignment.classroomId !== id) {\n        return NextResponse.json({ error: 'Assignment not found in this classroom.' }, { status: 404 });\n      }\n    }\n    let submissions: Submission[] = assignmentId\n      ? await classroomDb.listSubmissions(assignmentId)\n      : await classroomDb.listSubmissionsForClassroom(id);"

if NEW_ASID in sub_content:
    print('  SKIP (already patched)')
elif OLD_ASID in sub_content:
    sub_content = sub_content.replace(OLD_ASID, NEW_ASID)
    with open(sub_path, 'w', encoding='utf-8') as f:
        f.write(sub_content)
    print(f'  PATCHED: {sub_path}')
else:
    print(f'  WARN: pattern not found in {sub_path}')

print('All patches done.')
