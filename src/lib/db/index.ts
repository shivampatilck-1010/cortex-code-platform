import { createRequire } from 'module';
export interface DBInstance {
  exec(sql: string): Promise<void>;
  prepare(sql: string): {
    run: (...params: any[]) => Promise<{ changes?: number; lastInsertRowid?: number }>;
    get: (...params: any[]) => Promise<any>;
    all: (...params: any[]) => Promise<any[]>;
  };
}

export class D1Wrapper implements DBInstance {
  constructor(private d1: any) {}
  async exec(sql: string): Promise<void> {
    await this.d1.exec(sql);
  }
  prepare(sql: string) {
    return {
      run: async (...params: any[]) => {
        const res = await this.d1.prepare(sql).bind(...params).run();
        return { changes: res.meta.changes, lastInsertRowid: res.meta.last_row_id };
      },
      get: async (...params: any[]) => {
        return await this.d1.prepare(sql).bind(...params).first();
      },
      all: async (...params: any[]) => {
        const res = await this.d1.prepare(sql).bind(...params).all();
        return res.results;
      }
    };
  }
}

export async function getDbInstance(dbPath: string): Promise<DBInstance | null> {
  let d1Binding: any = null;
  if (typeof process !== 'undefined' && process.env && process.env.DB) {
    d1Binding = process.env.DB;
  } else if (typeof globalThis !== 'undefined' && (globalThis as any).env && (globalThis as any).env.DB) {
    d1Binding = (globalThis as any).env.DB;
  }

  if (d1Binding) {
    return new D1Wrapper(d1Binding);
  }

  // Fallback to node:sqlite in dev
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_ENV === 'test') {
    return null; 
  }

  try {
    const customReq = typeof (globalThis as any).__webpack_require__ !== 'undefined' 
      ? ((globalThis as any).__non_webpack_require__ || (typeof require !== "undefined" ? require : undefined)) 
      : (typeof require !== 'undefined' ? require : createRequire(import.meta.url));
    let DatabaseSync: any;
    try {
      DatabaseSync = customReq('node:sqlite').DatabaseSync;
    } catch {
      DatabaseSync = customReq('node:sqlite').DatabaseSync;
    }
    const fs = customReq('fs');
    const path = customReq('path');
    if (!fs.existsSync(path.dirname(dbPath))) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    const db = new DatabaseSync(dbPath);
    return {
      exec: async (sql: string) => db.exec(sql),
      prepare: (sql: string) => {
        const stmt = db.prepare(sql);
        return {
          run: async (...params: any[]) => {
            const res = stmt.run(...params);
            return { changes: res.changes, lastInsertRowid: res.lastInsertRowid };
          },
          get: async (...params: any[]) => stmt.get(...params),
          all: async (...params: any[]) => stmt.all(...params)
        };
      }
    };
  } catch (err) {
    console.warn('[DB] Failed to load node:sqlite', err);
    return null;
  }
}
