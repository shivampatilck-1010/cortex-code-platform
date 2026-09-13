const fs = require('fs');

const filesToFix = [
  'src/lib/classroom/node-ws-server.ts',
  'src/worker.ts',
  'src/lib/classroom/durable-object.ts'
];

for (const file of filesToFix) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/const membership = ClassroomAuth.verifyClassroomMembership/g, 'const membership = await ClassroomAuth.verifyClassroomMembership');
  code = code.replace(/const auth = ClassroomAuth.verifyAccess/g, 'const auth = await ClassroomAuth.verifyAccess');
  // Also getMember missing await?
  code = code.replace(/const member = classroomDb\.getMember/g, 'const member = await classroomDb.getMember');
  fs.writeFileSync(file, code);
}

// In worker.ts there is also `const user = ClassroomAuth.getCurrentUser(request)`? Wait.
// Let's replace `const user = await ClassroomAuth.getCurrentUser` just in case.
