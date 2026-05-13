import { exec } from './sqlite';
import { newId, nowIso } from '../utils/id';

const LEGACY_KEY = 'kuxtal-prototype-v1';
const FLAG_KEY = 'kuxtal-prototype-imported';

type LegacyState = {
  onboarding?: any;
  biodiversity?: Array<{ id?: string; text: string; createdAt?: string }>;
  logEntries?: Array<{
    id?: string;
    body?: string;
    text?: string;
    kind?: string;
    createdAt?: string;
    recordedAt?: string;
    linkedPlant?: string;
    linkedZone?: string;
  }>;
  feedbackEntries?: Array<{ id?: string; category?: string; message: string; contact?: string; createdAt?: string }>;
  canvas?: {
    boundary?: number[][];
    boundaryClosed?: boolean;
    zones?: Array<{ id?: string; name?: string; points: number[][] }>;
    plants?: Array<{ id?: string; type: string; lat: number; lng: number }>;
  };
};

export type LegacyImportReport = {
  imported: boolean;
  zones: number;
  plants: number;
  biodiversity: number;
  logs: number;
  feedback: number;
  hadBoundary: boolean;
};

export function runLegacyImport(landId: string): LegacyImportReport {
  const empty: LegacyImportReport = {
    imported: false,
    zones: 0,
    plants: 0,
    biodiversity: 0,
    logs: 0,
    feedback: 0,
    hadBoundary: false
  };
  if (typeof localStorage === 'undefined') return empty;
  if (localStorage.getItem(FLAG_KEY)) return empty;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return empty;

  let state: LegacyState;
  try {
    state = JSON.parse(raw);
  } catch {
    localStorage.setItem(FLAG_KEY, nowIso());
    return empty;
  }

  const report: LegacyImportReport = { ...empty, imported: true };
  const now = nowIso();

  if (state.canvas?.boundary?.length) {
    const ring = state.canvas.boundary.map((p) => [p[1], p[0]]);
    if (ring.length >= 3 && state.canvas.boundaryClosed) {
      ring.push(ring[0]);
      const geo: GeoJSON.Polygon = { type: 'Polygon', coordinates: [ring] };
      exec(
        `UPDATE land SET boundary_geojson = ?, boundary_closed = 1, updated_at = ? WHERE id = ?`,
        [JSON.stringify(geo), now, landId]
      );
      report.hadBoundary = true;
    }
  }

  if (state.canvas?.zones?.length) {
    for (const z of state.canvas.zones) {
      const ring = z.points.map((p) => [p[1], p[0]]);
      if (ring.length < 3) continue;
      ring.push(ring[0]);
      const geo: GeoJSON.Polygon = { type: 'Polygon', coordinates: [ring] };
      exec(
        `INSERT INTO zone (id, land_id, name, polygon_geojson, created_at, updated_at)
         VALUES (?,?,?,?,?,?)`,
        [z.id || newId('zone'), landId, z.name || 'Zona', JSON.stringify(geo), now, now]
      );
      report.zones++;
    }
  }

  if (state.canvas?.plants?.length) {
    for (const p of state.canvas.plants) {
      exec(
        `INSERT OR IGNORE INTO planted (id, land_id, zone_id, species_id, lat, lng, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [p.id || newId('plt'), landId, null, p.type, p.lat, p.lng, now, now]
      );
      report.plants++;
    }
  }

  if (state.biodiversity?.length) {
    for (const b of state.biodiversity) {
      exec(
        `INSERT INTO biodiversity_note (id, text, created_at) VALUES (?,?,?)`,
        [b.id || newId('bio'), b.text, b.createdAt || now]
      );
      report.biodiversity++;
    }
  }

  if (state.logEntries?.length) {
    for (const l of state.logEntries) {
      exec(
        `INSERT INTO log_entry (id, land_id, kind, body, recorded_at, created_at)
         VALUES (?,?,?,?,?,?)`,
        [
          l.id || newId('log'),
          landId,
          l.kind || 'note',
          l.body || l.text || '',
          l.recordedAt || l.createdAt || now,
          now
        ]
      );
      report.logs++;
    }
  }

  if (state.feedbackEntries?.length) {
    for (const f of state.feedbackEntries) {
      exec(
        `INSERT INTO feedback_entry (id, category, message, contact, created_at)
         VALUES (?,?,?,?,?)`,
        [f.id || newId('fb'), f.category || null, f.message, f.contact || null, f.createdAt || now]
      );
      report.feedback++;
    }
  }

  if (state.onboarding) {
    const o = state.onboarding;
    exec(
      `INSERT OR REPLACE INTO onboarding (
         id, location, size_value, size_unit, climate, climate_note,
         goals, goal_note, challenges, challenge_note,
         structural, reminder, budget, updated_at
       ) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        o.location || null,
        o.sizeValue || null,
        o.sizeUnit || null,
        JSON.stringify(o.climate || []),
        o.climateNote || null,
        JSON.stringify(o.goals || []),
        o.goalNote || null,
        JSON.stringify(o.challenges || []),
        o.challengeNote || null,
        JSON.stringify(o.structural || []),
        o.reminder || null,
        o.budget || null,
        now
      ]
    );
  }

  localStorage.setItem(FLAG_KEY, now);
  return report;
}
