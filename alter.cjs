const db = require('better-sqlite3')('cortex_dev.db');
try { db.exec('ALTER TABLE classroom_members ADD COLUMN suspended_at INTEGER'); } catch(e) {}
try { db.exec('ALTER TABLE classroom_members ADD COLUMN suspension_expires_at INTEGER'); } catch(e) {}
try { db.exec('ALTER TABLE classroom_members ADD COLUMN removed_at INTEGER'); } catch(e) {}
try { db.exec('ALTER TABLE submissions ADD COLUMN project_id TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE submissions ADD COLUMN snapshot_json TEXT'); } catch(e) {}
console.log('ALTERs done');
