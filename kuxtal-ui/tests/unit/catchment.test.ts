import { describe, it, expect } from 'vitest';
import {
  catchmentLitresPerYear,
  householdDays,
  litresToM3,
  RUNOFF_COEFFICIENTS
} from '../../src/lib/water/catchment';

describe('catchmentLitresPerYear', () => {
  it('1 mm over 1 m² at runoff 1 equals 1 litre', () => {
    expect(catchmentLitresPerYear({ areaM2: 1, annualRainfallMm: 1, runoff: 1 })).toBe(1);
  });
  it('scales with area, rainfall and runoff', () => {
    expect(catchmentLitresPerYear({ areaM2: 100, annualRainfallMm: 1200, runoff: 0.9 })).toBe(108_000);
  });
  it('clamps runoff to [0,1] and guards bad input', () => {
    expect(catchmentLitresPerYear({ areaM2: 10, annualRainfallMm: 100, runoff: 2 })).toBe(1000);
    expect(catchmentLitresPerYear({ areaM2: 0, annualRainfallMm: 100, runoff: 1 })).toBe(0);
    expect(catchmentLitresPerYear({ areaM2: 10, annualRainfallMm: -5, runoff: 1 })).toBe(0);
    expect(catchmentLitresPerYear({ areaM2: NaN, annualRainfallMm: 100, runoff: 1 })).toBe(0);
  });
});

describe('helpers', () => {
  it('converts litres to m³ and household days', () => {
    expect(litresToM3(108_000)).toBe(108);
    expect(householdDays(6000, 600)).toBe(10);
    expect(householdDays(100, 0)).toBe(0);
  });
  it('runoff coefficients are within (0,1]', () => {
    for (const v of Object.values(RUNOFF_COEFFICIENTS)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
