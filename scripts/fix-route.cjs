const fs = require('fs');
let code = fs.readFileSync('src/app/api/v1/classrooms/route.ts', 'utf8');
code = code.replace(/const user = await ClassroomAuth.getCurrentUser\(req\);\s+const body = await req.json\(\);/, 
  "const user = await ClassroomAuth.getCurrentUser(req);\n    if (user.role !== 'teacher') return NextResponse.json({ error: 'Only teachers can create classrooms' }, { status: 403 });\n    const body = await req.json();");
fs.writeFileSync('src/app/api/v1/classrooms/route.ts', code);
