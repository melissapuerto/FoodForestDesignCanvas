import { describe, it, expect } from 'vitest';
import {
  computeFootprint,
  factorFor,
  litresToM3,
  showerEquivalents,
  carKmEquivalent
} from '../../src/lib/footprint/calc';
import { SPECIES_FACTORS, DEFAULT_FACTOR } from '../../src/lib/footprint/factors';

describe('factorFor', () => {
  it('prefers species-specific factors', () => {
    expect(factorFor('cafe', 'arbusto')).toBe(SPECIES_FACTORS.cafe);
  });
  it('falls back to growth-form, then default', () => {
    expect(factorFor('unknown-x', 'arbol-alto').co2KgPerYear).toBeGreaterThan(0);
    expect(factorFor('unknown-x', null)).toBe(DEFAULT_FACTOR);
  });
});

describe('computeFootprint', () => {
  it('is zero for an empty canvas', () => {
    const r = computeFootprint([]);
    expect(r.waterL).toBe(0);
    expect(r.co2Kg).toBe(0);
    expect(r.plants).toBe(0);
  });

  it('sums water and CO2 across species and counts', () => {
    const r = computeFootprint([
      { species_id: 'cafe', plant_type: 'arbusto', count: 2 },
      { species_id: 'aguacate', plant_type: 'arbol-alto', count: 1 }
    ]);
    const expected =
      SPECIES_FACTORS.cafe.wfLPerKg * SPECIES_FACTORS.cafe.yieldKgPerYear * 2 +
      SPECIES_FACTORS.aguacate.wfLPerKg * SPECIES_FACTORS.aguacate.yieldKgPerYear * 1;
    expect(r.waterL).toBeCloseTo(expected, 3);
    expect(r.plants).toBe(3);
  });

  it('sorts contributors by water footprint descending', () => {
    const r = computeFootprint([
      { species_id: 'cilantro', plant_type: 'herbaceo', count: 1 },
      { species_id: 'cafe', plant_type: 'arbusto', count: 1 }
    ]);
    expect(r.perSpecies[0].species_id).toBe('cafe');
  });
});

describe('interpretation conversions', () => {
  it('converts units sensibly', () => {
    expect(litresToM3(1000)).toBe(1);
    expect(showerEquivalents(650)).toBeCloseTo(10, 5);
    expect(carKmEquivalent(12)).toBeCloseTo(100, 5);
  });
});
