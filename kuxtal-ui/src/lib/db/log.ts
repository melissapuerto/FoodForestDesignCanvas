import { exec, selectAll } from './sqlite';
import { newId, nowIso } from '../utils/id';

export type LogRow = {
  id: string;
  land_id: string | null;
  kind: string;
  title: string | null;
  body: string | null;
  location_geojson: string | null;
  linked_plant_id: string | null;
  linked_zone_id: string | null;
  linked_species_id: string | null;
  media_blob_keys: string | null;
  recorded_at: string;
  created_at: string;
  author: string | null;
};

export function listLogs(landId: string, search?: string): LogRow[] {
  const q = search?.trim();
  if (q) {
    return selectAll<LogRow>(
      `SELECT * FROM log_entry WHERE (land_id = ? OR land_id IS NULL) AND body LIKE ? ORDER BY recorded_at DESC`,
      [landId, `%${q}%`]
    );
  }
  return selectAll<LogRow>(
    `SELECT * FROM log_entry WHERE land_id = ? OR land_id IS NULL ORDER BY recorded_at DESC LIMIT 200`,
    [landId]
  );
}

export function addLog(input: {
  landId: string;
  kind?: string;
  title?: string;
  body?: string;
  linkedPlantId?: string | null;
  linkedZoneId?: string | null;
  linkedSpeciesId?: string | null;
  mediaBlobKeys?: string[];
  lat?: number;
  lng?: number;
  recordedAt?: string;
  author?: string | null;
}): string {
  const id = newId('log');
  const now = nowIso();
  const loc =
    input.lat != null && input.lng != null
      ? JSON.stringify({ type: 'Point', coordinates: [input.lng, input.lat] })
      : null;
  exec(
    `INSERT INTO log_entry (
       id, land_id, kind, title, body, location_geojson,
       linked_plant_id, linked_zone_id, linked_species_id,
       media_blob_keys, recorded_at, created_at, author
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.landId,
      input.kind ?? 'note',
      input.title ?? null,
      input.body ?? null,
      loc,
      input.linkedPlantId ?? null,
      input.linkedZoneId ?? null,
      input.linkedSpeciesId ?? null,
      input.mediaBlobKeys?.length ? JSON.stringify(input.mediaBlobKeys) : null,
      input.recordedAt ?? now,
      now,
      input.author ?? null
    ]
  );
  return id;
}

export function deleteLog(id: string): void {
  exec('DELETE FROM log_entry WHERE id = ?', [id]);
}
