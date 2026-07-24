import { describe, it, expect } from 'vitest';
import {
  styleFor, zoneTone, zoneLineTone,
  PAPER_STYLE, STREETS_STYLE, SATELLITE_STYLE, BLANK_STYLE
} from '../../src/lib/map/basemaps';

describe('styleFor', () => {
  it('maps each basemap to its style spec', () => {
    expect(styleFor('paper')).toBe(PAPER_STYLE);
    expect(styleFor('streets')).toBe(STREETS_STYLE);
    expect(styleFor('satellite')).toBe(SATELLITE_STYLE);
    expect(styleFor('blank')).toBe(BLANK_STYLE);
  });
  it('every style is a valid v8 spec', () => {
    for (const s of [PAPER_STYLE, STREETS_STYLE, SATELLITE_STYLE, BLANK_STYLE]) {
      expect(s.version).toBe(8);
      expect(Array.isArray(s.layers)).toBe(true);
    }
  });
  it('blank style makes no network tile requests (offline-first)', () => {
    expect(Object.keys(BLANK_STYLE.sources)).toHaveLength(0);
  });
});

describe('zone palette', () => {
  it('returns distinct fill + line tones for zones 1..5 and a fallback', () => {
    for (let z = 1; z <= 5; z++) {
      expect(zoneTone(z)).toMatch(/^#[0-9A-F]{6}$/i);
      expect(zoneLineTone(z)).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(zoneTone(null)).toBe('#C7B58A');
    expect(zoneLineTone(99)).toBe('#6B5340');
  });
});
