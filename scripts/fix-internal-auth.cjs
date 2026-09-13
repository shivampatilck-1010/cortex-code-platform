const fs = require('fs');

let code = fs.readFileSync('src/lib/classroom/auth.ts', 'utf8');

const missingMethods = `
  /**
   * Internal Auth token creation for Worker -> Durable Object communication.
   */
  static createInternalAuthToken(user: any): string {
    // Basic base64 payload for DO internal auth. In production, sign this securely.
    return Buffer.from(JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      cortex_id: user.cortex_id
    })).toString('base64');
  }

  static verifyInternalAuthToken(token: string): any {
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
`;

code = code.replace(/export class ClassroomAuth \{/, 'export class ClassroomAuth {\n' + missingMethods);
fs.writeFileSync('src/lib/classroom/auth.ts', code);
