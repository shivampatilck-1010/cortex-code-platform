import fs from 'fs';

const filePath = 'src/lib/classroom/db/index.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const target = '      candidates,\r\n    };\r\n  }\r\n}';
const replacement = `      candidates,\r\n    };\r\n  }\r\n\r\n  /**\r\n   * Health and readiness diagnostics probe.\r\n   */\r\n  async getHealthStats(): Promise<{ userCount: number; examCount: number; sessionCount: number }> {\r\n    const db = await this.getDb();\r\n    const userRow = (await db.prepare('SELECT COUNT(*) as cnt FROM users').get()) as any;\r\n    const examRow = (await db.prepare('SELECT COUNT(*) as cnt FROM exams').get()) as any;\r\n    const sessRow = (await db.prepare('SELECT COUNT(*) as cnt FROM exam_sessions').get()) as any;\r\n    return {\r\n      userCount: userRow?.cnt || 0,\r\n      examCount: examRow?.cnt || 0,\r\n      sessionCount: sessRow?.cnt || 0,\r\n    };\r\n  }\r\n}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Successfully added getHealthStats');
} else {
  console.error('Target not found in file');
}
