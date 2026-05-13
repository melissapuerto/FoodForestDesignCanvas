import { exec, selectAll } from './sqlite';
import { newId, nowIso } from '../utils/id';

export type CosechaRow = {
  id: string;
  land_id: string;
  planted_id: string | null;
  amount_kg: number;
  quality: string | null;
  harvest_date: string;
  notes: string | null;
  created_at: string;
  author: string | null;
  location_geojson: string | null;
};

export function listCosechas(landId: string): CosechaRow[] {
  return selectAll<CosechaRow>(
    'SELECT * FROM cosecha_entry WHERE land_id = ? ORDER BY harvest_date DESC',
    [landId]
  );
}

export function addCosecha(input: {
  landId: string;
  amountKg: number;
  harvestDate: string;
  quality?: string | null;
  plantedId?: string | null;
  notes?: string | null;
  author?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  const id = newId('cos');
  const now = nowIso();
  const loc =
    input.lat != null && input.lng != null
      ? JSON.stringify({ type: 'Point', coordinates: [input.lng, input.lat] })
      : null;
  exec(
    `INSERT INTO cosecha_entry (id, land_id, planted_id, amount_kg, quality, harvest_date, notes, created_at, author, location_geojson)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.landId,
      input.plantedId ?? null,
      input.amountKg,
      input.quality ?? null,
      input.harvestDate,
      input.notes ?? null,
      now,
      input.author ?? null,
      loc
    ]
  );
  return id;
}

export function deleteCosecha(id: string): void {
  exec('DELETE FROM cosecha_entry WHERE id = ?', [id]);
}
