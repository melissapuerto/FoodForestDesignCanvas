import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { runMigrations } from './schema';

let _db: Database | null = null;
let _sqlite3: Sqlite3Static | null = null;
let _persistence: 'opfs' | 'idb' | 'memory' = 'memory';
let _persistenceError: string | null = null;

/* ── IDB sync state (only active when _persistence === 'idb') ── */
let _idbDirty = false;
let _idbTimer: ReturnType<typeof setTimeout> | null = null;
const IDB_FLUSH_MS = 1200;

const DB_FILENAME = 'kuxtal.sqlite3';
const IDB_NAME = 'kuxtal-persist';
const IDB_STORE = 'databases';
const IDB_KEY = 'main';

export type Persistence = 'opfs' | 'idb' | 'memory';

/**
 * Test-only reset hatch. Returns true only when the page was opened with a
 * `?e2e_reset` query flag, in which case initDb wipes any persisted database
 * before opening a fresh one. This makes the end-to-end journey deterministic
 * (it persists to OPFS, which survives across runs) without ever touching a real
 * user's data — production is never loaded with that flag.
 */
function e2eResetRequested(): boolean {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('e2e_reset');
  } catch {
    return false;
  }
}

/* ── IndexedDB helpers ─────────────────────────────────────────── */

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIdb(): Promise<Uint8Array | null> {
  try {
    const idb = await openIdb();
    return await new Promise<Uint8Array | null>((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const get = tx.objectStore(IDB_STORE).get(IDB_KEY);
      get.onsuccess = () => {
        const v = get.result;
        resolve(v instanceof Uint8Array ? v : (v instanceof ArrayBuffer ? new Uint8Array(v) : null));
      };
      get.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveToIdb(data: Uint8Array): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function markDirty(): void {
  if (_persistence !== 'idb' || !_db || !_sqlite3) return;
  _idbDirty = true;
  if (_idbTimer) clearTimeout(_idbTimer);
  _idbTimer = setTimeout(flushToIdb, IDB_FLUSH_MS);
}

/** Export the in-memory DB to IndexedDB.  Safe to call at any time. */
export async function flushToIdb(): Promise<void> {
  if (!_idbDirty || !_db || !_sqlite3 || _persistence !== 'idb') return;
  try {
    const bytes: Uint8Array = (_sqlite3.capi as any).sqlite3_js_db_export(_db.pointer);
    await saveToIdb(bytes);
    _idbDirty = false;
    console.debug('[sqlite] flushed to IndexedDB');
  } catch (err) {
    console.warn('[sqlite] IDB flush failed', err);
  }
}

/* ── Initialisation ────────────────────────────────────────────── */

export async function initDb(): Promise<{ db: Database; persistence: Persistence }> {
  if (_db) return { db: _db, persistence: _persistence };

  // The SQLite WASM glue (~40 KB gz of JS before the .wasm itself) loads as its
  // own chunk so the shell paints first; it downloads in parallel during boot.
  const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm');
  const sqlite3 = await sqlite3InitModule({
    print: (msg) => console.log('[sqlite]', msg),
    printErr: (msg) => console.warn('[sqlite]', msg)
  });
  _sqlite3 = sqlite3;

  // OPFS SAHPool is unreliable for *installed* PWAs on iOS (it can fail to
  // persist across relaunches), so on an iOS home-screen app we skip straight
  // to the IndexedDB-backed path, which persists reliably there.
  const isIosStandalone =
    typeof navigator !== 'undefined' && (navigator as any).standalone === true;

  // ── Tier 1: OPFS SAHPool (native file persistence) ──────────
  let db: Database;
  try {
    if (isIosStandalone) throw new Error('ios-standalone-prefers-indexeddb');
    const pool = await (sqlite3 as any).installOpfsSAHPoolVfs({ name: 'kuxtal-opfs' });
    // Tests opt in to a clean slate; the pool's own wipe is handle-safe.
    if (e2eResetRequested()) {
      try { await pool.wipeFiles(); console.info('[sqlite] e2e reset: wiped OPFS pool'); } catch {}
    }
    db = new pool.OpfsSAHPoolDb(`/${DB_FILENAME}`);
    _persistence = 'opfs';
    console.info('[sqlite] persistence=opfs');
  } catch (opfsErr) {
    if (isIosStandalone) {
      console.info('[sqlite] iOS standalone PWA — using IndexedDB persistence');
    } else {
      _persistenceError = opfsErr instanceof Error ? opfsErr.message : String(opfsErr);
      console.warn('[sqlite] OPFS SAHPool unavailable:', _persistenceError);
    }

    // ── Tier 2: in-memory + IndexedDB sync ──────────────────────
    try {
      const saved = e2eResetRequested() ? null : await loadFromIdb();
      db = new sqlite3.oo1.DB(':memory:', 'c');

      if (saved && saved.length > 100) {
        // Restore saved database via sqlite3_deserialize
        const capi = sqlite3.capi as any;
        const wasm = (sqlite3 as any).wasm;
        if (typeof capi.sqlite3_deserialize === 'function') {
          const n = saved.length;
          const pData = wasm.alloc(n);
          wasm.heap8u().set(saved, pData);
          const FREEONCLOSE = 1; // SQLITE_DESERIALIZE_FREEONCLOSE
          const RESIZEABLE = 2;  // SQLITE_DESERIALIZE_RESIZEABLE
          const rc = capi.sqlite3_deserialize(
            db.pointer, 'main', pData, n, n, FREEONCLOSE | RESIZEABLE
          );
          if (rc !== 0) {
            wasm.dealloc(pData);
            console.warn('[sqlite] deserialize failed rc=', rc, '— starting fresh');
          } else {
            console.info('[sqlite] restored from IndexedDB');
          }
        } else {
          console.warn('[sqlite] sqlite3_deserialize not available — starting fresh');
        }
      } else {
        console.info('[sqlite] no saved DB in IndexedDB — fresh start');
      }

      _persistence = 'idb';
      console.info('[sqlite] persistence=idb');
    } catch (idbErr) {
      // ── Tier 3: pure in-memory (no persistence) ─────────────────
      console.warn('[sqlite] IndexedDB fallback failed, pure in-memory', idbErr);
      db = new sqlite3.oo1.DB(':memory:', 'c');
      _persistence = 'memory';
      console.info('[sqlite] persistence=memory');
    }
  }

  db.exec('PRAGMA foreign_keys=ON;');

  await runMigrations(db);
  _db = db;
  // The seed module carries the full species/animal datasets — load it only
  // when there is actually something to seed (fresh or upgraded DB).
  const { seedDefaults } = await import('./seed');
  await seedDefaults(db);

  // Kick off an initial IDB save so even the first session persists
  if (_persistence === 'idb') {
    markDirty();
    // Save eagerly on page-hide / beforeunload — iOS fires visibilitychange
    // reliably, desktop fires beforeunload.
    const eagleFlush = () => { if (document.visibilityState === 'hidden') flushToIdb(); };
    document.addEventListener('visibilitychange', eagleFlush);
    window.addEventListener('pagehide', () => flushToIdb());
    window.addEventListener('beforeunload', () => flushToIdb());
  }

  return { db, persistence: _persistence };
}

/* ── Query helpers (unchanged API surface) ─────────────────────── */

export function isDbReady(): boolean {
  return _db != null;
}

export function getDb(): Database {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

export function exec(sql: string, bind?: any[]): void {
  getDb().exec({ sql, bind });
  markDirty();
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
    markDirty();
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function persistenceMode(): Persistence {
  return _persistence;
}

export function persistenceError(): string | null {
  return _persistenceError;
}
