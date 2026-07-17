import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  metersToDegLat,
  metersToDegLng,
  pointInPolygon,
  polygonToGeoJson,
  geoJsonToPolygon,
  type LngLat
} from '../../src/lib/map/geometry';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters({ lng: 0, lat: 0 }, { lng: 0, lat: 0 })).toBe(0);
  });

  it('measures ~111.2 km for one degree of latitude', () => {
    const d = haversineMeters({ lng: 0, lat: 0 }, { lng: 0, lat: 1 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('is symmetric', () => {
    const a = { lng: -99.1, lat: 19.4 };
    const b = { lng: -98.2, lat: 19.0 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe('meters <-> degrees', () => {
  it('converts latitude meters to ~1 degree', () => {
    expect(metersToDegLat(110_540)).toBeCloseTo(1, 5);
  });
  it('accounts for longitude convergence with latitude', () => {
    const atEquator = metersToDegLng(111_320, 0);
    const at60 = metersToDegLng(111_320, 60);
    expect(atEquator).toBeCloseTo(1, 5);
    // cos(60°) = 0.5 → same metres span twice the degrees
    expect(at60).toBeCloseTo(2, 4);
  });
});

describe('pointInPolygon', () => {
  const square: LngLat[] = [
    { lng: 0, lat: 0 },
    { lng: 0, lat: 2 },
    { lng: 2, lat: 2 },
    { lng: 2, lat: 0 }
  ];
  it('detects an interior point', () => {
    expect(pointInPolygon({ lng: 1, lat: 1 }, square)).toBe(true);
  });
  it('rejects an exterior point', () => {
    expect(pointInPolygon({ lng: 3, lat: 3 }, square)).toBe(false);
  });
});

describe('polygon <-> GeoJSON round-trip', () => {
  const ring: LngLat[] = [
    { lng: 0, lat: 0 },
    { lng: 0, lat: 1 },
    { lng: 1, lat: 1 }
  ];
  it('closes the ring when serialising', () => {
    const geo = polygonToGeoJson(ring);
    const coords = geo.coordinates[0];
    expect(coords[0]).toEqual(coords[coords.length - 1]); // first === last
    expect(coords.length).toBe(ring.length + 1);
  });
  it('drops the closing vertex when parsing back', () => {
    const geo = polygonToGeoJson(ring);
    const back = geoJsonToPolygon(geo);
    expect(back).toEqual(ring);
  });
  it('handles null / malformed input safely', () => {
    expect(geoJsonToPolygon(null)).toEqual([]);
    expect(geoJsonToPolygon(undefined)).toEqual([]);
  });
});
