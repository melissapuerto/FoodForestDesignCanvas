import { writable, type Writable } from 'svelte/store';
import { selectAll, selectOne, exec, persistenceMode } from '../db/sqlite';
import { newId, nowIso } from '../utils/id';

const AUTOLOG_KEY = 'kuxtal.autolog_plants';
export const autoLogPlants = writable<boolean>(
  typeof localStorage !== 'undefined' && localStorage.getItem(AUTOLOG_KEY) === '1'
);
autoLogPlants.subscribe((v) => {
  try { localStorage.setItem(AUTOLOG_KEY, v ? '1' : '0'); } catch {}
});

function isAutoLogEnabled(): boolean {
  try { return localStorage.getItem(AUTOLOG_KEY) === '1'; } catch { return false; }
}

function autoLogPlantOp(kind: 'plant-added' | 'plant-removed', input: { landId: string; speciesId: string; lat: number; lng: number; plantedId?: string | null }): void {
  if (!isAutoLogEnabled()) return;
  try {
    const sp = selectOne<SpeciesRow>('SELECT * FROM plant_species WHERE id = ?', [input.speciesId]);
    const name = sp?.common_name ?? input.speciesId;
    const verb = kind === 'plant-added' ? 'Sembrada' : 'Removida';
    const id = newId('log');
    const now = nowIso();
    const loc = JSON.stringify({ type: 'Point', coordinates: [input.lng, input.lat] });
    exec(
      `INSERT INTO log_entry (
         id, land_id, kind, title, body, location_geojson,
         linked_plant_id, linked_zone_id, linked_species_id,
         media_blob_keys, recorded_at, created_at, author
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, input.landId, kind, `${verb} ${name}`,
        `${verb} ${name} en ${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}.`,
        loc, input.plantedId ?? null, null, input.speciesId, null, now, now, null
      ]
    );
  } catch (err) {
    console.warn('[autolog] failed', err);
  }
}

export type LandRow = {
  id: string;
  name: string;
  boundary_geojson: string | null;
  boundary_closed: number;
  center_lat: number | null;
  center_lng: number | null;
  created_at: string;
  updated_at: string;
};

export type ZoneRow = {
  id: string;
  land_id: string;
  name: string;
  polygon_geojson: string;
  elevation_m: number | null;
  soil_type: string | null;
  humidity_pct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlantedRow = {
  id: string;
  land_id: string;
  zone_id: string | null;
  species_id: string;
  lat: number;
  lng: number;
  planted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SpeciesRow = {
  id: string;
  common_name: string;
  scientific_name: string | null;
  emoji: string | null;
  spacing_m: number;
  sun: string | null;
  zones: string | null;
  plant_type: string | null;
  origin: string | null;
  functions: string | null;
  notes: string | null;
  source: string | null;
  aliases: string | null;
  edible_parts: string | null;
  glyph: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export const activeLandId: Writable<string> = writable('land-default');
export const persistence = writable<'opfs' | 'memory'>('memory');
export const dbReady = writable<boolean>(false);

export const lands = writable<LandRow[]>([]);
export const zones = writable<ZoneRow[]>([]);
export const planted = writable<PlantedRow[]>([]);
export const species = writable<SpeciesRow[]>([]);
export const waterFeatures = writable<WaterFeatureRow[]>([]);

export type WaterFeatureRow = {
  id: string;
  land_id: string;
  name: string;
  type: string; // pond | river | channel | well | spring
  geometry_geojson: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function reloadFromDb(landId: string): void {
  lands.set(selectAll<LandRow>('SELECT * FROM land ORDER BY created_at'));
  zones.set(selectAll<ZoneRow>('SELECT * FROM zone WHERE land_id = ? ORDER BY created_at', [landId]));
  planted.set(selectAll<PlantedRow>('SELECT * FROM planted WHERE land_id = ? ORDER BY created_at', [landId]));
  species.set(selectAll<SpeciesRow>('SELECT * FROM plant_species ORDER BY common_name'));
  try {
    waterFeatures.set(selectAll<WaterFeatureRow>('SELECT * FROM water_feature WHERE land_id = ? ORDER BY created_at', [landId]));
  } catch { /* table might not exist yet on first load before migration */ }
  persistence.set(persistenceMode());
}

export function getLand(landId: string): LandRow | null {
  return selectOne<LandRow>('SELECT * FROM land WHERE id = ?', [landId]);
}

export function updateLandBoundary(landId: string, boundaryGeoJson: GeoJSON.Polygon | null, closed: boolean): void {
  exec(
    `UPDATE land SET boundary_geojson = ?, boundary_closed = ?, updated_at = ? WHERE id = ?`,
    [boundaryGeoJson ? JSON.stringify(boundaryGeoJson) : null, closed ? 1 : 0, nowIso(), landId]
  );
  reloadFromDb(landId);
}

export function insertZone(input: {
  landId: string;
  name: string;
  polygon: GeoJSON.Polygon;
  elevationM?: number | null;
  soilType?: string | null;
  humidityPct?: number | null;
  notes?: string | null;
}): string {
  const id = newId('zone');
  const now = nowIso();
  exec(
    `INSERT INTO zone (id, land_id, name, polygon_geojson, elevation_m, soil_type, humidity_pct, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.landId,
      input.name,
      JSON.stringify(input.polygon),
      input.elevationM ?? null,
      input.soilType ?? null,
      input.humidityPct ?? null,
      input.notes ?? null,
      now,
      now
    ]
  );
  reloadFromDb(input.landId);
  return id;
}

export function updateZone(id: string, patch: Partial<Omit<ZoneRow, 'id' | 'land_id' | 'created_at' | 'updated_at'>>): void {
  const fields: string[] = [];
  const bind: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    bind.push(v);
  }
  if (!fields.length) return;
  fields.push('updated_at = ?');
  bind.push(nowIso(), id);
  exec(`UPDATE zone SET ${fields.join(', ')} WHERE id = ?`, bind);
  const row = selectOne<ZoneRow>('SELECT * FROM zone WHERE id = ?', [id]);
  if (row) reloadFromDb(row.land_id);
}

export function deleteZone(id: string, landId: string): ZoneRow | null {
  const row = selectOne<ZoneRow>('SELECT * FROM zone WHERE id = ?', [id]);
  exec('DELETE FROM zone WHERE id = ?', [id]);
  reloadFromDb(landId);
  return row;
}

export function insertPlanted(input: {
  landId: string;
  zoneId?: string | null;
  speciesId: string;
  lat: number;
  lng: number;
  plantedAt?: string | null;
  notes?: string | null;
}): string {
  const id = newId('plt');
  const now = nowIso();
  exec(
    `INSERT INTO planted (id, land_id, zone_id, species_id, lat, lng, planted_at, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, input.landId, input.zoneId ?? null, input.speciesId, input.lat, input.lng, input.plantedAt ?? null, input.notes ?? null, now, now]
  );
  autoLogPlantOp('plant-added', { landId: input.landId, speciesId: input.speciesId, lat: input.lat, lng: input.lng, plantedId: id });
  reloadFromDb(input.landId);
  return id;
}

export function deletePlanted(id: string, landId: string): PlantedRow | null {
  const row = selectOne<PlantedRow>('SELECT * FROM planted WHERE id = ?', [id]);
  exec('DELETE FROM planted WHERE id = ?', [id]);
  if (row) {
    autoLogPlantOp('plant-removed', { landId: row.land_id, speciesId: row.species_id, lat: row.lat, lng: row.lng, plantedId: id });
  }
  reloadFromDb(landId);
  return row;
}

export function restorePlanted(row: PlantedRow): void {
  exec(
    `INSERT OR REPLACE INTO planted (id, land_id, zone_id, species_id, lat, lng, planted_at, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      row.id,
      row.land_id,
      row.zone_id,
      row.species_id,
      row.lat,
      row.lng,
      row.planted_at,
      row.notes,
      row.created_at,
      nowIso()
    ]
  );
  reloadFromDb(row.land_id);
}

export function restoreZone(row: ZoneRow): void {
  exec(
    `INSERT OR REPLACE INTO zone (id, land_id, name, polygon_geojson, elevation_m, soil_type, humidity_pct, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      row.id,
      row.land_id,
      row.name,
      row.polygon_geojson,
      row.elevation_m,
      row.soil_type,
      row.humidity_pct,
      row.notes,
      row.created_at,
      nowIso()
    ]
  );
  reloadFromDb(row.land_id);
}

export function insertPlantSpecies(input: {
  id?: string;
  commonName: string;
  scientificName?: string | null;
  spacingM: number;
  sun?: string | null;
  plantType?: string | null;
  origin?: string | null;
  functions?: string[] | null;
  notes?: string | null;
  aliases?: string[] | null;
  ediblePartsList?: string[] | null;
  glyph?: string | null;
}): string {
  const id = input.id?.trim() || newId('sp');
  const now = nowIso();
  exec(
    `INSERT INTO plant_species (
       id, common_name, scientific_name, emoji, spacing_m, sun, zones,
       plant_type, origin, functions, notes, source,
       aliases, edible_parts, glyph, image_url,
       created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.commonName,
      input.scientificName ?? null,
      null,
      input.spacingM,
      input.sun ?? null,
      JSON.stringify([]),
      input.plantType ?? null,
      input.origin ?? null,
      JSON.stringify(input.functions ?? []),
      input.notes ?? null,
      'usuario',
      input.aliases ? JSON.stringify(input.aliases) : null,
      input.ediblePartsList ? JSON.stringify(input.ediblePartsList) : null,
      input.glyph ?? null,
      null, // image_url
      now,
      now
    ]
  );
  species.set(selectAll<SpeciesRow>('SELECT * FROM plant_species ORDER BY common_name'));
  return id;
}

export type SpeciesImportReport = { added: number; updated: number; errors: number };

function asList(raw: any, ...keys: string[]): string[] | null {
  for (const k of keys) {
    const v = raw?.[k];
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
    if (typeof v === 'string') {
      return v.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return null;
}

function pickList(raw: any[]): any[] | null {
  if (Array.isArray(raw)) return raw;
  return null;
}

function unwrapImportPayload(parsed: any): any[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.species)) return parsed.species;
    if (Array.isArray(parsed.plants)) return parsed.plants;
    if (Array.isArray(parsed.animals)) return parsed.animals;
    if (Array.isArray(parsed.items)) return parsed.items;
  }
  return null;
}

function normalizePlantRow(r: any) {
  const commonName: unknown = r.commonName ?? r.common_name ?? r.n ?? r.name ?? r.nombre;
  if (!commonName || typeof commonName !== 'string') return null;
  const idRaw = r.id;
  const id = typeof idRaw === 'string' && idRaw.trim()
    ? idRaw.trim()
    : commonName.toLowerCase().replaceAll(/[^a-z0-9]/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  return {
    id,
    commonName,
    scientificName: r.scientific_name ?? r.scientificName ?? r.sci ?? null,
    spacingM: Number(r.spacing_m ?? r.spacingM ?? r.sp ?? r.spacing) || 1,
    sun: r.sun ?? null,
    plantType: r.plant_type ?? r.plantType ?? r.type ?? null,
    origin: r.origin ?? null,
    functions: asList(r, 'functions') ?? [],
    notes: r.notes ?? null,
    aliases: asList(r, 'aliases'),
    edibleParts: asList(r, 'edible_parts', 'ediblePartsList'),
    glyph: typeof r.glyph === 'string' ? r.glyph : null
  };
}

function upsertPlantRow(p: ReturnType<typeof normalizePlantRow> & object): 'added' | 'updated' {
  const exists = !!selectOne<{ id: string }>('SELECT id FROM plant_species WHERE id = ?', [p.id]);
  if (exists) {
    exec(
      `UPDATE plant_species SET
         common_name = ?, scientific_name = ?, spacing_m = ?, sun = ?, plant_type = ?,
         origin = ?, functions = ?, notes = ?, aliases = ?, edible_parts = ?,
         glyph = COALESCE(?, glyph), updated_at = ? WHERE id = ?`,
      [
        p.commonName, p.scientificName, p.spacingM, p.sun, p.plantType,
        p.origin, JSON.stringify(p.functions), p.notes,
        p.aliases ? JSON.stringify(p.aliases) : null,
        p.edibleParts ? JSON.stringify(p.edibleParts) : null,
        p.glyph, nowIso(), p.id
      ]
    );
    return 'updated';
  }
  insertPlantSpecies({
    id: p.id,
    commonName: p.commonName,
    scientificName: p.scientificName,
    spacingM: p.spacingM,
    sun: p.sun,
    plantType: p.plantType,
    origin: p.origin ?? 'adapted',
    functions: p.functions,
    notes: p.notes,
    aliases: p.aliases,
    ediblePartsList: p.edibleParts,
    glyph: p.glyph ?? 'Seed'
  });
  return 'added';
}

export function importPlantSpeciesFromJson(json: string): SpeciesImportReport {
  let parsed: any;
  try { parsed = JSON.parse(json); }
  catch { return { added: 0, updated: 0, errors: 1 }; }
  const list = pickList(parsed) ?? unwrapImportPayload(parsed);
  if (!list) return { added: 0, updated: 0, errors: 1 };

  let added = 0, updated = 0, errors = 0;
  for (const raw of list) {
    try {
      const norm = normalizePlantRow(raw);
      if (!norm) { errors++; continue; }
      if (upsertPlantRow(norm) === 'added') added++;
      else updated++;
    } catch (err) {
      console.warn('[import] species row failed', err);
      errors++;
    }
  }
  if (added || updated) {
    species.set(selectAll<SpeciesRow>('SELECT * FROM plant_species ORDER BY common_name'));
  }
  return { added, updated, errors };
}

export function speciesById(id: string): SpeciesRow | null {
  return selectOne<SpeciesRow>('SELECT * FROM plant_species WHERE id = ?', [id]);
}

// ---- Water features ----

export function insertWaterFeature(input: {
  landId: string;
  name: string;
  type: string;
  geometry: GeoJSON.Polygon | GeoJSON.LineString | GeoJSON.Point;
  notes?: string | null;
}): string {
  const id = newId('wtr');
  const now = nowIso();
  exec(
    `INSERT INTO water_feature (id, land_id, name, type, geometry_geojson, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, input.landId, input.name, input.type, JSON.stringify(input.geometry), input.notes ?? null, now, now]
  );
  reloadFromDb(input.landId);
  return id;
}

export function deleteWaterFeature(id: string, landId: string): WaterFeatureRow | null {
  const row = selectOne<WaterFeatureRow>('SELECT * FROM water_feature WHERE id = ?', [id]);
  exec('DELETE FROM water_feature WHERE id = ?', [id]);
  reloadFromDb(landId);
  return row;
}

export function restoreWaterFeature(row: WaterFeatureRow): void {
  exec(
    `INSERT OR REPLACE INTO water_feature (id, land_id, name, type, geometry_geojson, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [row.id, row.land_id, row.name, row.type, row.geometry_geojson, row.notes, row.created_at, nowIso()]
  );
  reloadFromDb(row.land_id);
}
