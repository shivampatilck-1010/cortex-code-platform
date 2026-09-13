const fs = require('fs');

let code = fs.readFileSync('src/lib/classroom/db/index.ts', 'utf8');
const method = `
  async restoreClassroom(classroomId: string): Promise<any | null> {
    if (!(await this.getDb())) {
      const cls = this.memoryClassrooms.get(classroomId);
      if (cls) { cls.status = 'active'; cls.joinEnabled = true; return cls; }
      return null;
    }
    const stmt = await (await this.getDb()).prepare("UPDATE classrooms SET status = 'active', join_enabled = 1 WHERE id = ?");
    const result = await stmt.run(classroomId);
    if (result.changes === 0) return null;
    return this.getClassroom(classroomId);
  }
`;
code = code.replace(/async archiveClassroom\(id: string\): Promise<Classroom \| null> \{/, method + '\n  async archiveClassroom(id: string): Promise<Classroom | null> {');
fs.writeFileSync('src/lib/classroom/db/index.ts', code);
