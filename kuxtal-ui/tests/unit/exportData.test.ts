import { describe, it, expect } from 'vitest';
import { buildInsertStatement, isValidExport, EXPORT_FORMAT } from '../../src/lib/db/exportData';

describe('buildInsertStatement', () => {
  it('builds a parameterised insert from the row keys', () => {
    const { sql, bind } = buildInsertStatement('land', { id: 'a', name: 'Finca', boundary_closed: 1 });
    expect(sql).toBe('INSERT INTO "land" ("id", "name", "boundary_closed") VALUES (?, ?, ?)');
    expect(bind).toEqual(['a', 'Finca', 1]);
  });

  it('coerces null, boolean and object binds for SQLite', () => {
    const { bind } = buildInsertStatement('t', { a: null, b: true, c: false, d: { x: 1 } });
    expect(bind).toEqual([null, 1, 0, '{"x":1}']);
  });
});

describe('isValidExport', () => {
  it('accepts a well-formed export', () => {
    expect(isValidExport({ format: EXPORT_FORMAT, version: 1, exportedAt: '', tables: {}, blobs: [] })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidExport(null)).toBe(false);
    expect(isValidExport({ format: 'nope', tables: {} })).toBe(false);
    expect(isValidExport({ format: EXPORT_FORMAT })).toBe(false);
  });
});
