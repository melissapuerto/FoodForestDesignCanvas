import { selectAll, exec, transaction } from './sqlite';
import { blobsDb, type BlobRecord } from './blobs';

/**
 * Knowledge-sovereignty data portability (KSC-05): export every byte the app
 * has stored locally to a single JSON file the user owns, and re-import it to
 * restore state. Works fully offline — it only touches the local SQLite
 * database and the Dexie blob store; nothing is sent anywhere.
 */

// All durable SQLite tables. `schema_version` is intentionally excluded — the
// importer relies on the running app's own migrations, not the file's.
export const EXPORT_TABLES = [
  'app_settings', 'onboarding', 'land', 'zone', 'plant_species', 'planted',
  'animal_species', 'animal_observation', 'rule', 'log_entry',
  'biodiversity_note', 'resource_item', 'calendar_event', 'area_characteristic',
  'goal', 'feedback_entry', 'water_feature', 'task', 'cosecha_entry'
] as const;

export const EXPORT_FORMAT = 'kuxtal-export';
export const EXPORT_VERSION = 1;

export type ExportedBlob = {
  key: string;
  kind: BlobRecord['kind'];
  mime: string;
  createdAt: string;
  dataUrl: string;
};

export type KuxtalExport = {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  blobs: ExportedBlob[];
};

/**
 * Build a parameterised INSERT for one row. Pure — exported for unit testing.
 * Column names come from the row's own keys, so the file round-trips against
 * the schema it was written from.
 */
export function buildInsertStatement(
  table: string,
  row: Record<string, unknown>
): { sql: string; bind: unknown[] } {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  const quotedCols = cols.map((c) => `"${c}"`).join(', ');
  const bind = cols.map((c) => {
    const v = row[c];
    // SQLite bind accepts string/number/null; coerce objects/booleans.
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  return { sql: `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`, bind };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Collect the full local dataset (SQLite tables + media blobs) into one object. */
export async function exportAllData(): Promise<KuxtalExport> {
  const tables: KuxtalExport['tables'] = {};
  for (const table of EXPORT_TABLES) {
    try {
      tables[table] = selectAll<Record<string, unknown>>(`SELECT * FROM ${table}`);
    } catch {
      tables[table] = [];
    }
  }

  const blobs: ExportedBlob[] = [];
  try {
    const all = await blobsDb.blobs.toArray();
    for (const b of all) {
      try {
        blobs.push({
          key: b.key,
          kind: b.kind,
          mime: b.mime,
          createdAt: b.createdAt,
          dataUrl: await blobToDataUrl(b.data)
        });
      } catch {
        /* skip a blob that can't be serialised rather than fail the whole export */
      }
    }
  } catch {
    /* blob store unavailable — export SQLite only */
  }

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    blobs
  };
}

/** Trigger a browser download of the export as a timestamped .json file. */
export async function downloadExport(): Promise<void> {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kuxtal-export-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RFC-4180-ish CSV cell: quote when needed, double internal quotes. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

function tableToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

/**
 * CSV export (Integrate Rather than Segregate: spreadsheet-openable interop
 * next to the JSON round-trip format). One file per non-empty table.
 */
export async function downloadCsvExport(): Promise<void> {
  const data = await exportAllData();
  const stamp = new Date().toISOString().slice(0, 10);
  for (const [table, rows] of Object.entries(data.tables)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const csv = tableToCsv(rows as Record<string, unknown>[]);
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kuxtal-${table}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function isValidExport(data: unknown): data is KuxtalExport {
  const d = data as KuxtalExport | null;
  return !!d && d.format === EXPORT_FORMAT && typeof d.tables === 'object' && d.tables !== null;
}

/** Replace all local data with the contents of an export file. */
export async function importAllData(data: unknown): Promise<void> {
  if (!isValidExport(data)) {
    throw new Error('Not a valid Kuxtal export file.');
  }
  transaction(() => {
    for (const table of EXPORT_TABLES) {
      const rows = data.tables[table];
      if (!Array.isArray(rows)) continue;
      exec(`DELETE FROM ${table}`);
      for (const row of rows) {
        const { sql, bind } = buildInsertStatement(table, row);
        exec(sql, bind);
      }
    }
  });

  // Restore media blobs (outside the SQLite transaction — Dexie is async).
  if (Array.isArray(data.blobs)) {
    try {
      await blobsDb.blobs.clear();
      for (const b of data.blobs) {
        try {
          const blob = await (await fetch(b.dataUrl)).blob();
          await blobsDb.blobs.put({
            key: b.key,
            kind: b.kind,
            mime: b.mime,
            size: blob.size,
            data: blob,
            createdAt: b.createdAt
          });
        } catch {
          /* skip an unrestorable blob */
        }
      }
    } catch {
      /* blob store unavailable */
    }
  }
}
