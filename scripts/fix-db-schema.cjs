const fs = require('fs');
let code = fs.readFileSync('src/lib/classroom/db/index.ts', 'utf8');

code = code.replace(/CREATE TABLE IF NOT EXISTS users \([\s\S]*?updated_at INTEGER NOT NULL\n        \);/,
  `CREATE TABLE IF NOT EXISTS users (
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
        );`);

code = code.replace(/CREATE TABLE IF NOT EXISTS users \([\s\S]*?\);/, `$&

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
        );`);

fs.writeFileSync('src/lib/classroom/db/index.ts', code);
console.log('Fixed tables');
