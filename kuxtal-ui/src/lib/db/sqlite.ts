import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { runMigrations } from './schema';
import { seedDefaults } from './seed';

let _db: Database | null = null;
let _sqlite3: Sqlite3Static | null = null;
let _persistence: 'opfs' | 'memory' = 'memory';

const DB_FILENAME = 'kuxtal.sqlite3';

export type Persistence = 'opfs' | 'memory';

export async function initDb(): Promise<{ db: Database; persistence: Persistence }> {
  if (_db) return { db: _db, persistence: _persistence };

  const sqlite3 = await sqlite3InitModule({
    print: (msg) => console.log('[sqlite]', msg),
    printErr: (msg) => console.warn('[sqlite]', msg)
  });
  _sqlite3 = sqlite3;

  const hasOpfs = 'opfs' in sqlite3 && typeof (sqlite3 as any).oo1?.OpfsDb === 'function';

  let db: Database;
  if (hasOpfs) {
    try {
      db = new (sqlite3 as any).oo1.OpfsDb(`/${DB_FILENAME}`, 'c');
      _persistence = 'opfs';
    } catch (err) {
      console.warn('[sqlite] OPFS unavailable, falling back to in-memory', err);
      db = new sqlite3.oo1.DB(`:memory:`, 'c');
      _persistence = 'memory';
    }
  } else {
    db = new sqlite3.oo1.DB(`:memory:`, 'c');
    _persistence = 'memory';
  }

  db.exec('PRAGMA journal_mode=WAL;');
  db.exec('PRAGMA foreign_keys=ON;');

  await runMigrations(db);
  await seedDefaults(db);

  _db = db;
  return { db, persistence: _persistence };
}

export function getDb(): Database {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

export function exec(sql: string, bind?: any[]): void {
  getDb().exec({ sql, bind });
}

export function selectAll<T = Record<string, unknown>>(sql: string, bind?: any[]): T[] {
  const rows: T[] = [];
  getDb().exec({
    sql,
    bind,
    rowMode: 'object',
    callback: (row: any) => {
      rows.push(row as T);
    }
  });
  return rows;
}

export function selectOne<T = Record<string, unknown>>(sql: string, bind?: any[]): T | null {
  const rows = selectAll<T>(sql, bind);
  return rows[0] ?? null;
}

export function selectValue<T = unknown>(sql: string, bind?: any[]): T | null {
  let value: T | null = null;
  getDb().exec({
    sql,
    bind,
    rowMode: 'array',
    callback: (row: any) => {
      value = row[0] as T;
    }
  });
  return value;
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function persistenceMode(): Persistence {
  return _persistence;
}
