import { selectAll, exec } from '../db/sqlite';

export function migrateCoordinates(
  landId: string,
  oldCenter: { lat: number; lng: number },
  newCenter: { lat: number; lng: number }
): void {
  const dLat = newCenter.lat - oldCenter.lat;
  const dLng = newCenter.lng - oldCenter.lng;

  // Helper to shift a point
  const shiftPoint = (p: [number, number]) => [p[0] + dLng, p[1] + dLat];

  // Shift Planted
  const plants = selectAll<{ id: string; lat: number; lng: number }>(
    `SELECT id, lat, lng FROM planted WHERE land_id = ?`,
    [landId]
  );
  for (const p of plants) {
    exec(`UPDATE planted SET lat = ?, lng = ? WHERE id = ?`, [p.lat + dLat, p.lng + dLng, p.id]);
  }

  // Shift Zones
  const zones = selectAll<{ id: string; polygon_geojson: string }>(
    `SELECT id, polygon_geojson FROM zone WHERE land_id = ?`,
    [landId]
  );
  for (const z of zones) {
    try {
      const geo = JSON.parse(z.polygon_geojson);
      if (geo.type === 'Polygon') {
        geo.coordinates = geo.coordinates.map((ring: any) => ring.map(shiftPoint));
        exec(`UPDATE zone SET polygon_geojson = ? WHERE id = ?`, [JSON.stringify(geo), z.id]);
      }
    } catch {}
  }

  // Shift Water Features
  const waters = selectAll<{ id: string; geometry_geojson: string }>(
    `SELECT id, geometry_geojson FROM water_feature WHERE land_id = ?`,
    [landId]
  );
  for (const w of waters) {
    try {
      const geo = JSON.parse(w.geometry_geojson);
      if (geo.type === 'Polygon') {
        geo.coordinates = geo.coordinates.map((ring: any) => ring.map(shiftPoint));
      } else if (geo.type === 'LineString') {
        geo.coordinates = geo.coordinates.map(shiftPoint);
      } else if (geo.type === 'Point') {
        geo.coordinates = shiftPoint(geo.coordinates);
      }
      exec(`UPDATE water_feature SET geometry_geojson = ? WHERE id = ?`, [JSON.stringify(geo), w.id]);
    } catch {}
  }

  // Shift Boundary
  const lands = selectAll<{ id: string; boundary_geojson: string | null }>(
    `SELECT id, boundary_geojson FROM land WHERE id = ?`,
    [landId]
  );
  for (const l of lands) {
    if (l.boundary_geojson) {
      try {
        const geo = JSON.parse(l.boundary_geojson);
        if (geo.type === 'Polygon') {
          geo.coordinates = geo.coordinates.map((ring: any) => ring.map(shiftPoint));
          exec(`UPDATE land SET boundary_geojson = ? WHERE id = ?`, [JSON.stringify(geo), l.id]);
        }
      } catch {}
    }
  }
}
