import type { Database } from '@sqlite.org/sqlite-wasm';
import { ANIMAL_SEED, PDB } from '../pfaf/seed-data';
import { plantGlyph, animalGlyph } from '../glyphs/mapping';
import { newId, nowIso } from '../utils/id';
import { syncAllPfafToCatalog } from '../pfaf/syncSpecies';
import { allPfafPlants } from '../pfaf/pfafPool';

export async function seedDefaults(db: Database): Promise<void> {
  if (countRows(db, 'plant_species') === 0) seedSpecies(db);
  // Only sync when the local catalog is behind the bundled dataset (first run or data bump).
  const pfafInDb = countRows(db, "plant_species WHERE id LIKE 'pfaf-%'");
  if (pfafInDb < allPfafPlants().length) syncAllPfafToCatalog();
  if (countRows(db, 'animal_species') === 0) seedAnimals(db);
  if (countRows(db, 'rule') === 0) seedRules(db);
  if (countRows(db, 'land') === 0) seedDefaultLand(db);
}

function countRows(db: Database, table: string): number {
  let n = 0;
  db.exec({
    sql: `SELECT COUNT(*) AS n FROM ${table}`,
    rowMode: 'object',
    callback: (row: any) => {
      n = row.n as number;
    }
  });
  return n;
}

function seedSpecies(db: Database): void {
  const now = nowIso();
  db.exec('BEGIN');
  try {
    for (const [id, p] of Object.entries(PDB)) {
      db.exec({
        sql: `INSERT INTO plant_species (
                id, common_name, scientific_name, emoji, spacing_m, sun, zones,
                plant_type, origin, region, microclimates, functions, notes, source,
                aliases, edible_parts, glyph,
                created_at, updated_at
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        bind: [
          id,
          p.n,
          p.sci,
          p.e,
          p.sp,
          p.sun,
          JSON.stringify(p.zn),
          p.type,
          p.origin,
          (p as any).region ?? null,
          (p as any).microclimates ? JSON.stringify((p as any).microclimates) : null,
          JSON.stringify(p.functions),
          p.notes,
          'kuxtal-prototype',
          p.aliases ? JSON.stringify(p.aliases) : null,
          p.edible_parts ? JSON.stringify(p.edible_parts) : null,
          plantGlyph(id),
          now,
          now
        ]
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedAnimals(db: Database): void {
  const now = nowIso();
  db.exec('BEGIN');
  try {
    for (const a of ANIMAL_SEED) {
      db.exec({
        sql: `INSERT INTO animal_species (
                id, common_name, scientific_name, emoji, notes, source,
                role, aliases, glyph,
                created_at, updated_at
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        bind: [
          a.id, a.n, a.sci, a.emoji, a.notes, 'kuxtal-prototype',
          a.role,
          a.aliases ? JSON.stringify(a.aliases) : null,
          animalGlyph(a.id),
          now, now
        ]
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedRules(db: Database): void {
  const now = nowIso();
  db.exec('BEGIN');
  try {
    for (const [aId, p] of Object.entries(PDB)) {
      for (const bId of p.companions) {
        if (PDB[bId]) insertRule(db, aId, bId, 'companion', `${p.n} y ${PDB[bId].n} suelen ayudarse cuando comparten espacio.`, now);
      }
      for (const bId of p.clash) {
        if (PDB[bId]) insertRule(db, aId, bId, 'incompatible', `${p.n} y ${PDB[bId].n} compiten cuando se siembran muy cerca.`, now);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function insertRule(
  db: Database,
  aId: string,
  bId: string,
  relationship: 'companion' | 'incompatible',
  message: string,
  now: string
): void {
  const triggerM = Math.max(0.5, Math.min(PDB[aId].sp, PDB[bId].sp) * 1.5);
  db.exec({
    sql: `INSERT INTO rule (
            id, entity_a, entity_b, entity_a_kind, entity_b_kind,
            relationship, trigger_distance_m, message,
            source, provenance_tag, attribution, retractable, is_user_owned,
            created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    bind: [
      newId('rule'),
      aId,
      bId,
      'plant',
      'plant',
      relationship,
      triggerM,
      message,
      'kuxtal-prototype',
      'practica-campo',
      null,
      1,
      0,
      now,
      now
    ]
  });
}

function seedDefaultLand(db: Database): void {
  const now = nowIso();
  db.exec({
    sql: `INSERT INTO land (id, name, boundary_geojson, boundary_closed, created_at, updated_at)
          VALUES (?,?,?,?,?,?)`,
    bind: ['land-default', 'Mi finca', null, 0, now, now]
  });
}
