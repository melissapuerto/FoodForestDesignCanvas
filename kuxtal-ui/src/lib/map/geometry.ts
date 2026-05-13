const EARTH_R = 6_371_000;

export type LngLat = { lng: number; lat: number };

export function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function metersToDegLng(meters: number, lat: number): number {
  return meters / (111_320 * Math.cos((lat * Math.PI) / 180));
}

export function metersToDegLat(meters: number): number {
  return meters / 110_540;
}

export function pointInPolygon(point: LngLat, polygon: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonToGeoJson(points: LngLat[]): GeoJSON.Polygon {
  const ring = points.map((p) => [p.lng, p.lat]);
  if (ring.length > 0) {
    const [first] = ring;
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function geoJsonToPolygon(geo: GeoJSON.Polygon | null | undefined): LngLat[] {
  if (!geo || geo.type !== 'Polygon' || !geo.coordinates?.[0]) return [];
  const ring = geo.coordinates[0];
  const closed = ring.length >= 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const used = closed ? ring.slice(0, -1) : ring;
  return used.map((c) => ({ lng: c[0], lat: c[1] }));
}
