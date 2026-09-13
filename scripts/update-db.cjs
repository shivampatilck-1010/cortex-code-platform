const fs = require('fs');
const path = 'src/lib/classroom/db/index.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Update createTables
const newTables = `
      await (await this.getDb()).exec(\`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          cortex_id TEXT UNIQUE,
          password_hash TEXT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL,
          avatar TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Defensive alter for existing db
        -- We ignore errors if columns already exist
      \`);
      try {
        await (await this.getDb()).exec(\`ALTER TABLE users ADD COLUMN cortex_id TEXT;\`);
        await (await this.getDb()).exec(\`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cortex_id ON users(cortex_id);\`);
      } catch (e) {}
      try {
        await (await this.getDb()).exec(\`ALTER TABLE users ADD COLUMN password_hash TEXT;\`);
      } catch (e) {}

      await (await this.getDb()).exec(\`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
`;

content = content.replace(/await \(await this\.getDb\(\)\)\.exec\(`[\s\S]*?CREATE TABLE IF NOT EXISTS users \([\s\S]*?updated_at INTEGER NOT NULL\n        \);/, newTables);

// 2. Add auth methods to ClassroomDB class
const authMethods = `
  // --- AUTH & SESSIONS ---

  async getUserByEmail(email: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  async getUserByCortexId(cortexId: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM users WHERE cortex_id = ?').get(cortexId);
  }

  async createSession(id: string, userId: string, expiresAt: number): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare(
      'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, userId, expiresAt, Date.now());
  }

  async getSession(id: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  }

  async deleteSession(id: string): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  async createResetToken(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare(
      'INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).run(tokenHash, userId, expiresAt, Date.now());
  }

  async getResetToken(tokenHash: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(tokenHash);
  }

  async markResetTokenUsed(tokenHash: string): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ?').run(tokenHash);
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  }

  // --- END AUTH ---
`;

// Insert the methods before `async getUser(id: string)`
content = content.replace(/  async getUser\(id: string\)/, authMethods + '\n  async getUser(id: string)');

// We also need to update `createUser` to accept cortex_id and password_hash
const createUserRegex = /async createUser\(user: User\): Promise<User> {[\s\S]*?await \(await this\.getDb\(\)\)\.prepare\([\s\S]*?VALUES \(\?, \?, \?, \?, \?, \?, \?, \?\)`[\s\S]*?\.run\([\s\S]*?\);[\s\S]*?return user;\n  }/;
const newCreateUser = `
  async createUser(user: any): Promise<any> {
    if (!(await this.getDb())) return user;
    await (await this.getDb()).prepare(
      \`INSERT INTO users (id, cortex_id, password_hash, name, email, role, avatar, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
    ).run(
      user.id,
      user.cortex_id || null,
      user.password_hash || null,
      user.name,
      user.email,
      user.role,
      user.avatar || null,
      user.status,
      user.createdAt,
      user.updatedAt
    );
    return user;
  }
`;
content = content.replace(createUserRegex, newCreateUser);

fs.writeFileSync(path, content);
console.log("DB update complete");
