import { exec, selectAll, selectOne } from './sqlite';
import { newId, nowIso } from '../utils/id';

export type AnimalSpeciesRow = {
  id: string;
  common_name: string;
  scientific_name: string | null;
  emoji: string | null;
  notes: string | null;
  source: string | null;
  role: string | null;
  aliases: string | null;
  glyph: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type AnimalObservationRow = {
  id: string;
  land_id: string;
  species_id: string;
  zone_id: string | null;
  location_geojson: string | null;
  observed_at: string;
  notes: string | null;
  created_at: string;
};

export function listAnimalSpecies(): AnimalSpeciesRow[] {
  return selectAll<AnimalSpeciesRow>('SELECT * FROM animal_species ORDER BY common_name');
}

export function listObservations(landId: string): AnimalObservationRow[] {
  return selectAll<AnimalObservationRow>(
    'SELECT * FROM animal_observation WHERE land_id = ? ORDER BY observed_at DESC',
    [landId]
  );
}

export function addObservation(input: {
  landId: string;
  speciesId: string;
  zoneId?: string | null;
  notes?: string | null;
  lat?: number;
  lng?: number;
  observedAt?: string;
}): string {
  const id = newId('obs');
  const now = input.observedAt ?? nowIso();
  const loc =
    input.lat != null && input.lng != null
      ? JSON.stringify({ type: 'Point', coordinates: [input.lng, input.lat] })
      : null;
  exec(
    `INSERT INTO animal_observation (id, land_id, species_id, zone_id, location_geojson, observed_at, notes, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, input.landId, input.speciesId, input.zoneId ?? null, loc, now, input.notes ?? null, nowIso()]
  );
  return id;
}

export function deleteObservation(id: string): void {
  exec('DELETE FROM animal_observation WHERE id = ?', [id]);
}

export function speciesById(id: string): AnimalSpeciesRow | null {
  return selectOne<AnimalSpeciesRow>('SELECT * FROM animal_species WHERE id = ?', [id]);
}

export type AnimalImportReport = { added: number; updated: number; errors: number };

function unwrap(parsed: any): any[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.animals)) return parsed.animals;
    if (Array.isArray(parsed.species)) return parsed.species;
    if (Array.isArray(parsed.items)) return parsed.items;
  }
  return null;
}

function normalizeAnimalRow(r: any) {
  const commonName: unknown = r.commonName ?? r.common_name ?? r.n ?? r.name ?? r.nombre;
  if (!commonName || typeof commonName !== 'string') return null;
  const id = typeof r.id === 'string' && r.id.trim()
    ? r.id.trim()
    : commonName.toLowerCase().replaceAll(/[^a-z0-9]/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  let role: 'ayuda' | 'riesgo' | 'neutral' | null = null;
  if (r.role === 'ayuda' || r.role === 'riesgo' || r.role === 'neutral') role = r.role;
  let aliases: string[] | null = null;
  if (Array.isArray(r.aliases)) aliases = r.aliases.filter((x: unknown) => typeof x === 'string');
  else if (typeof r.aliases === 'string') aliases = r.aliases.split(',').map((s: string) => s.trim()).filter(Boolean);
  return {
    id,
    commonName,
    scientificName: r.scientific_name ?? r.scientificName ?? r.sci ?? null,
    notes: r.notes ?? null,
    role,
    aliases,
    glyph: typeof r.glyph === 'string' ? r.glyph : null
  };
}

export function importAnimalSpeciesFromJson(json: string): AnimalImportReport {
  let parsed: any;
  try { parsed = JSON.parse(json); }
  catch { return { added: 0, updated: 0, errors: 1 }; }
  const list = unwrap(parsed);
  if (!list) return { added: 0, updated: 0, errors: 1 };

  let added = 0, updated = 0, errors = 0;
  for (const raw of list) {
    try {
      const norm = normalizeAnimalRow(raw);
      if (!norm) { errors++; continue; }
      const exists = !!selectOne<{ id: string }>('SELECT id FROM animal_species WHERE id = ?', [norm.id]);
      if (exists) {
        exec(
          `UPDATE animal_species SET
             common_name = ?, scientific_name = ?, notes = ?,
             role = ?, aliases = ?, glyph = COALESCE(?, glyph),
             updated_at = ? WHERE id = ?`,
          [
            norm.commonName, norm.scientificName, norm.notes,
            norm.role, norm.aliases ? JSON.stringify(norm.aliases) : null,
            norm.glyph, nowIso(), norm.id
          ]
        );
        updated++;
      } else {
        insertAnimalSpecies({
          id: norm.id,
          commonName: norm.commonName,
          scientificName: norm.scientificName,
          notes: norm.notes,
          role: norm.role,
          aliases: norm.aliases,
          glyph: norm.glyph ?? 'Sparkle'
        });
        added++;
      }
    } catch (err) {
      console.warn('[import] animal row failed', err);
      errors++;
    }
  }
  return { added, updated, errors };
}

export function insertAnimalSpecies(input: {
  id?: string;
  commonName: string;
  scientificName?: string | null;
  notes?: string | null;
  role?: 'ayuda' | 'riesgo' | 'neutral' | null;
  aliases?: string[] | null;
  glyph?: string | null;
}): string {
  const id = input.id?.trim() || newId('an');
  const now = nowIso();
  exec(
    `INSERT INTO animal_species (
       id, common_name, scientific_name, emoji, notes, source,
       role, aliases, glyph, image_url,
       created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.commonName,
      input.scientificName ?? null,
      null,
      input.notes ?? null,
      'usuario',
      input.role ?? null,
      input.aliases ? JSON.stringify(input.aliases) : null,
      input.glyph ?? null,
      null, // image_url initially null
      now,
      now
    ]
  );
  return id;
}
