import { describe, it, expect } from 'vitest';
import {
  FACTS,
  CHUNK_BYTES,
  ENERGY_KWH_PER_GB,
  estimateWh,
  formatBytes,
  pickFact
} from '../../src/lib/loading/facts';

describe('loading facts data', () => {
  it('every fact is bilingual and attributed (R10)', () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(8);
    for (const f of FACTS) {
      expect(f.es.length).toBeGreaterThan(0);
      expect(f.en.length).toBeGreaterThan(0);
      expect(f.source.length).toBeGreaterThan(0);
    }
  });

  it('has a positive byte estimate for the boot (map-engine) path', () => {
    expect(CHUNK_BYTES.boot).toBeGreaterThan(0);
  });
});

describe('pickFact', () => {
  it('is deterministic with a seed and wraps out-of-range seeds', () => {
    expect(pickFact(0)).toBe(FACTS[0]);
    expect(pickFact(FACTS.length)).toBe(FACTS[0]);
    expect(pickFact(-1)).toBe(FACTS[FACTS.length - 1]);
  });
  it('returns a real fact with no seed', () => {
    expect(FACTS).toContain(pickFact());
  });
});

describe('estimateWh', () => {
  it('converts 1 GB to ~810 Wh using the documented factor', () => {
    expect(ENERGY_KWH_PER_GB).toBeCloseTo(0.81, 5);
    expect(estimateWh(1_000_000_000)).toBeCloseTo(810, 3);
  });
  it('gives a small but non-zero figure for the map engine (~288 KB)', () => {
    const wh = estimateWh(288_000);
    expect(wh).toBeGreaterThan(0);
    expect(wh).toBeLessThan(1);
  });
});

describe('formatBytes', () => {
  it('formats KB and MB', () => {
    expect(formatBytes(288_000)).toBe('288 KB');
    expect(formatBytes(1_500_000)).toBe('1.5 MB');
    expect(formatBytes(512)).toBe('512 B');
  });
});
