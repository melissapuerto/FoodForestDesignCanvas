import { exec, selectOne } from '../db/sqlite';
import { nowIso, newId } from '../utils/id';
import { plantGlyph } from '../glyphs/mapping';
import { allPfafPlants, type PfafEntry } from './pfafPool';

function pfafSunToDb(sun: string): string {
  const s = sun.toLowerCase();
  if (s.includes('sombra') && !s.includes('parcial')) return 'sombra';
  if (s.includes('parcial') || s.includes('media')) return 'parcial';
  return 'completo';
}

function pfafTypeToDb(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('árbol') || t.includes('arbol')) return t.includes('alto') ? 'arbol-alto' : 'arbol-medio';
  if (t.includes('arbusto')) return 'arbusto';
  if (t.includes('enredadera') || t.includes('trepad')) return 'trepadora';
  if (t.includes('raíz') || t.includes('raiz')) return 'herbaceo';
  if (t.includes('cobertura')) return 'cobertura';
  return 'herbaceo';
}

function functionsFor(p: PfafEntry): string[] {
  const fns: string[] = [];
  if (p.edible >= 3) fns.push('comestible');
  if (p.med >= 3) fns.push('medicinal');
  if (p.other >= 3) fns.push('soporte');
  if (p.hab) fns.push(p.hab);
  return fns;
}

export function upsertPfafSpecies(p: PfafEntry): void {
  const now = nowIso();
  const exists = selectOne<{ id: string }>('SELECT id FROM plant_species WHERE id = ?', [p.id]);
  const bind = [
    p.n,
    p.sci,
    null,
    p.space,
    pfafSunToDb(p.sun),
    JSON.stringify([p.hard]),
    pfafTypeToDb(p.type),
    p.origin ?? 'adapted',
    p.regions?.length ? JSON.stringify(p.regions) : null,
    null,
    JSON.stringify(functionsFor(p)),
    `PFAF · ${p.f}. ${p.hab}. Agua: ${p.water}. Suelo: ${p.soil}.`,
    'pfaf',
    null,
    null,
    plantGlyph(p.id),
    null,
    now,
    now
  ];

  if (exists) {
    exec(
      `UPDATE plant_species SET
         common_name = ?, scientific_name = ?, spacing_m = ?, sun = ?, zones = ?,
         plant_type = ?, origin = ?, region = ?, functions = ?, notes = ?,
         source = ?, glyph = COALESCE(glyph, ?), updated_at = ?
       WHERE id = ?`,
      [
        bind[0], bind[1], bind[3], bind[4], bind[5], bind[6], bind[7], bind[8],
        bind[10], bind[11], bind[12], bind[15], bind[17], p.id
      ]
    );
    return;
  }

  exec(
    `INSERT INTO plant_species (
       id, common_name, scientific_name, emoji, spacing_m, sun, zones,
       plant_type, origin, region, microclimates, functions, notes, source,
       aliases, edible_parts, glyph, image_url, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [p.id, ...bind]
  );
}

/** Merge bundled PFAF records into plant_species (id = pfaf-*). */
export function syncAllPfafToCatalog(): number {
  let n = 0;
  for (const p of allPfafPlants()) {
    upsertPfafSpecies(p);
    n++;
  }
  return n;
}

export function ensureSpeciesIdForName(commonName: string): string | null {
  const pfaf = allPfafPlants().find((p) => p.n === commonName);
  if (!pfaf) {
    const byName = selectOne<{ id: string }>(
      'SELECT id FROM plant_species WHERE lower(common_name) = lower(?)',
      [commonName]
    );
    if (byName?.id) return byName.id;
    // Persist a minimal record so the species remains available offline
    const id = newId('sp');
    const now = nowIso();
    exec(
      `INSERT INTO plant_species (id, common_name, scientific_name, created_at, updated_at, source)
       VALUES (?,?,?,?,?,?)`,
      [id, commonName, null, now, now, 'user']
    );
    return id;
  }
  upsertPfafSpecies(pfaf);
  return pfaf.id;
}
