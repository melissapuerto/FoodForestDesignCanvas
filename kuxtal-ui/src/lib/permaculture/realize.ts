// Turn a Plan into actual SQLite rows: concentric ring polygons around (lat,lng)
// representing each suggested permaculture zone. Polygons approximate rings with
// 32-segment circles in WGS84.

import { exec, selectAll } from '../db/sqlite';
import { newId, nowIso } from '../utils/id';
import { metersToDegLat, metersToDegLng } from '../map/geometry';
import type { Plan, ZoneProposal } from './types';

const STORAGE_KEY = 'permaculture.plan';

export function savePlan(plan: Plan): void {
  exec(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [STORAGE_KEY, JSON.stringify(plan)]
  );
}

export function loadPlan(): Plan | null {
  try {
    const rows = selectAll<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [STORAGE_KEY]
    );
    if (!rows[0]?.value) return null;
    return JSON.parse(rows[0].value) as Plan;
  } catch {
    return null;
  }
}

export function clearPlan(): void {
  exec('DELETE FROM app_settings WHERE key = ?', [STORAGE_KEY]);
}

function ringPolygon(centerLat: number, centerLng: number, radiusM: number, segments = 32): GeoJSON.Polygon {
  const dLat = metersToDegLat(radiusM);
  const dLng = metersToDegLng(radiusM, centerLat);
  const ring: number[][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI;
    ring.push([centerLng + Math.cos(a) * dLng, centerLat + Math.sin(a) * dLat]);
  }
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

function annulusPolygon(
  centerLat: number,
  centerLng: number,
  innerRadiusM: number,
  outerRadiusM: number,
  segments = 48
): GeoJSON.Polygon {
  const dLatOut = metersToDegLat(outerRadiusM);
  const dLngOut = metersToDegLng(outerRadiusM, centerLat);
  const dLatIn = metersToDegLat(innerRadiusM);
  const dLngIn = metersToDegLng(innerRadiusM, centerLat);
  const outer: number[][] = [];
  const inner: number[][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI;
    outer.push([centerLng + Math.cos(a) * dLngOut, centerLat + Math.sin(a) * dLatOut]);
    inner.push([centerLng + Math.cos(a) * dLngIn, centerLat + Math.sin(a) * dLatIn]);
  }
  outer.push(outer[0]);
  inner.push(inner[0]);
  return { type: 'Polygon', coordinates: [outer, inner.reverse()] };
}

/**
 * Materialize the plan's concentric zones around (lat,lng) as zone rows.
 * Zone 1 is a disc; zones 2..N are annuli around it.
 * Returns the number of zones inserted.
 */
export function materializeZones(plan: Plan, landId: string, centerLat: number, centerLng: number): number {
  if (!plan.zones.length) return 0;
  const now = nowIso();
  let prevR = 0;
  let inserted = 0;
  for (const z of plan.zones) {
    const polygon = prevR === 0
      ? ringPolygon(centerLat, centerLng, z.ringRadiusM)
      : annulusPolygon(centerLat, centerLng, prevR, z.ringRadiusM);

    exec(
      `INSERT INTO zone (
         id, land_id, name, polygon_geojson, elevation_m, soil_type, humidity_pct, notes, created_at, updated_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        newId('zone'),
        landId,
        `Zona ${z.zone} · ${z.name}`,
        JSON.stringify(polygon),
        null,
        plan.inputs.soil || null,
        null,
        `${z.intent}. Especies sugeridas: ${z.suggestedSpecies.join(', ') || '—'}`,
        now,
        now
      ]
    );
    prevR = z.ringRadiusM;
    inserted++;
  }
  return inserted;
}

export function approxBoundary(centerLat: number, centerLng: number, plan: Plan): GeoJSON.Polygon {
  const last = plan.zones[plan.zones.length - 1];
  const r = (last?.ringRadiusM ?? 30) + 2; // +2m padding
  return ringPolygon(centerLat, centerLng, r, 64);
}

export function setBoundaryFromPlan(landId: string, centerLat: number, centerLng: number, plan: Plan): void {
  const polygon = approxBoundary(centerLat, centerLng, plan);
  exec(
    `UPDATE land SET boundary_geojson = ?, boundary_closed = 1, updated_at = ? WHERE id = ?`,
    [JSON.stringify(polygon), nowIso(), landId]
  );
}

export type Materialization = {
  zonesCreated: number;
  boundaryCreated: boolean;
};

export function materializeFromPlan(opts: {
  plan: Plan;
  landId: string;
  centerLat: number;
  centerLng: number;
  createBoundary: boolean;
  createZones: boolean;
}): Materialization {
  let zonesCreated = 0;
  let boundaryCreated = false;
  if (opts.createBoundary) {
    setBoundaryFromPlan(opts.landId, opts.centerLat, opts.centerLng, opts.plan);
    boundaryCreated = true;
  }
  if (opts.createZones) {
    zonesCreated = materializeZones(opts.plan, opts.landId, opts.centerLat, opts.centerLng);
  }
  return { zonesCreated, boundaryCreated };
}

export type ZoneSummary = ZoneProposal & { layerName: string };
