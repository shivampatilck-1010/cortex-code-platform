const fs = require('fs');
let code = fs.readFileSync('src/lib/classroom/db/index.ts', 'utf8');

// Fix chained methods
code = code.replace(/const members = this\.listMembers\(classroomId\)\.filter\(\(m\) => m\.role === 'student'\);/g, 
  "const members = (await this.listMembers(classroomId)).filter((m) => m.role === 'student');");

code = code.replace(/const assignments = this\.listAssignments\(classroomId\);/g, 
  "const assignments = await this.listAssignments(classroomId);");

code = code.replace(/const submissions = this\.listSubmissionsForClassroom\(classroomId\);/g, 
  "const submissions = await this.listSubmissionsForClassroom(classroomId);");

// In getStudentProgress:
code = code.replace(/const submissions = this\.listSubmissions\(classroomId\);/g,
  "const submissions = await this.listSubmissions(classroomId);");

// Let's replace 'return rows.map((row) => this.map' with 'return await Promise.all(rows.map(async (row) => await this.map'
// Actually wait! If map is sync, why would it return Promise?
// mapClassroom, mapMember, etc. are ASYNC because I changed their return type to `Promise<X>` globally!
// Are they really async? If they don't do `await`, they shouldn't be async.
// Let's change mapClassroom, mapMember, mapAssignment, mapSubmission back to NOT returning Promise!
code = code.replace(/async mapClassroom\(row: any\): Promise<Classroom>/g, "mapClassroom(row: any): Classroom");
code = code.replace(/async mapMember\(row: any\): Promise<ClassroomMember>/g, "mapMember(row: any): ClassroomMember");
code = code.replace(/async mapAssignment\(row: any\): Promise<Assignment>/g, "mapAssignment(row: any): Assignment");
code = code.replace(/async mapSubmission\(row: any\): Promise<Submission>/g, "mapSubmission(row: any): Submission");

fs.writeFileSync('src/lib/classroom/db/index.ts', code);
console.log('Fixed DB awaits');
