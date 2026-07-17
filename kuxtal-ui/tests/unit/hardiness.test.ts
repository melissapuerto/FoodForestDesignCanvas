import { describe, it, expect } from 'vitest';
import {
  estimateUsdaZoneFromLat,
  parseAltitudeM,
  adjustZoneForAltitude,
  climateToTypicalUsdaZone,
  inferClimateFromLat,
  siteUsdaZone,
  plantFitsUsdaZone
} from '../../src/lib/climate/hardiness';

describe('estimateUsdaZoneFromLat', () => {
  it('maps the tropics to the warmest zone', () => {
    expect(estimateUsdaZoneFromLat(0)).toBe(11);
    expect(estimateUsdaZoneFromLat(20)).toBe(11);
  });
  it('maps polar latitudes to the coldest zones', () => {
    expect(estimateUsdaZoneFromLat(70)).toBe(2);
    expect(estimateUsdaZoneFromLat(-70)).toBe(2); // symmetric across hemispheres
  });
  it('maps mid-latitudes sensibly', () => {
    expect(estimateUsdaZoneFromLat(46)).toBe(7);
    expect(estimateUsdaZoneFromLat(45)).toBe(8);
    expect(estimateUsdaZoneFromLat(50)).toBe(6);
  });
});

describe('parseAltitudeM', () => {
  it('extracts a number from a label', () => {
    expect(parseAltitudeM('1200 m')).toBe(1200);
    expect(parseAltitudeM('-50')).toBe(-50);
  });
  it('returns null for empty / non-numeric input', () => {
    expect(parseAltitudeM('')).toBeNull();
    expect(parseAltitudeM('   ')).toBeNull();
    expect(parseAltitudeM('abc')).toBeNull();
    expect(parseAltitudeM(null)).toBeNull();
  });
});

describe('adjustZoneForAltitude', () => {
  it('leaves low altitudes unchanged', () => {
    expect(adjustZoneForAltitude(10, null)).toBe(10);
    expect(adjustZoneForAltitude(10, 200)).toBe(10);
  });
  it('drops ~1 zone per 600 m above 200 m', () => {
    expect(adjustZoneForAltitude(10, 1400)).toBe(8); // floor((1400-200)/600) = 2
  });
  it('never drops below zone 1', () => {
    expect(adjustZoneForAltitude(3, 5000)).toBe(1);
  });
});

describe('climateToTypicalUsdaZone', () => {
  it('maps known climates', () => {
    expect(climateToTypicalUsdaZone('frio')).toBe(3);
    expect(climateToTypicalUsdaZone('templado')).toBe(6);
    expect(climateToTypicalUsdaZone('subtropical')).toBe(8);
    expect(climateToTypicalUsdaZone('tropical-humedo')).toBe(10);
  });
});

describe('inferClimateFromLat', () => {
  it('returns colder profiles toward the poles', () => {
    expect(inferClimateFromLat(60)).toBe('frio');
    expect(inferClimateFromLat(47)).toBe('templado');
    expect(inferClimateFromLat(35)).toBe('subtropical');
    expect(inferClimateFromLat(10)).toBe('tropical-humedo');
  });
});

describe('siteUsdaZone', () => {
  it('prefers latitude when present', () => {
    expect(siteUsdaZone({ lat: 0, lng: 0, altitude: '', climate: 'templado' } as any)).toBe(11);
  });
  it('falls back to climate without coordinates', () => {
    expect(siteUsdaZone({ lat: null, lng: null, altitude: '', climate: 'frio' } as any)).toBe(3);
  });
  it('applies altitude adjustment', () => {
    // lat 0 → zone 11, altitude 2600 m → drop floor(2400/600)=4 → 7
    expect(siteUsdaZone({ lat: 0, lng: 0, altitude: '2600 m', climate: 'tropical-humedo' } as any)).toBe(7);
  });
});

describe('plantFitsUsdaZone', () => {
  it('rejects invalid hardiness', () => {
    expect(plantFitsUsdaZone(0, 10)).toBe(false);
  });
  it('requires the site to meet the plant minimum', () => {
    expect(plantFitsUsdaZone(9, 10)).toBe(true);
    expect(plantFitsUsdaZone(9, 8)).toBe(false);
  });
  it('relaxes hardy annuals but never frost-tender species', () => {
    expect(plantFitsUsdaZone(5, 4, true)).toBe(true); // annual relaxed to min(5,4)=4
    expect(plantFitsUsdaZone(5, 4, false)).toBe(false);
    expect(plantFitsUsdaZone(9, 7, true)).toBe(false); // hard>=8 never relaxed
  });
});
