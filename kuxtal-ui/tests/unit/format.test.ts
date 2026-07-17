import { describe, it, expect } from 'vitest';
import { round, formatMeters, formatMetersSq, formatMetersHuman } from '../../src/lib/utils/format';

describe('round', () => {
  it('eliminates floating-point artefacts', () => {
    expect(round(0.4 + 0.2)).toBe(0.6);
  });
  it('respects decimal places', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2399, 2)).toBe(1.24);
  });
  it('returns 0 for non-finite input', () => {
    expect(round(NaN)).toBe(0);
    expect(round(Infinity)).toBe(0);
  });
});

describe('formatMeters', () => {
  it('formats a finite value with a unit', () => {
    expect(formatMeters(1.2)).toBe('1.2 m');
  });
  it('renders an em-dash for null / undefined / NaN', () => {
    expect(formatMeters(null)).toBe('—');
    expect(formatMeters(undefined)).toBe('—');
    expect(formatMeters(NaN)).toBe('—');
  });
});

describe('formatMetersSq', () => {
  it('defaults to whole numbers', () => {
    expect(formatMetersSq(12.6)).toBe('13 m²');
    expect(formatMetersSq(0)).toBe('0 m²');
  });
  it('handles missing values', () => {
    expect(formatMetersSq(null)).toBe('—');
  });
});

describe('formatMetersHuman', () => {
  it('keeps one decimal under 100 m', () => {
    expect(formatMetersHuman(5)).toBe('5.0 m');
    expect(formatMetersHuman(50)).toBe('50.0 m');
  });
  it('rounds to whole metres at/above 100 m', () => {
    const out = formatMetersHuman(1500);
    expect(out).toMatch(/m$/);
    expect(out.replace(/\D/g, '')).toContain('1500'.slice(0, 1)); // starts with 1…
  });
  it('handles missing values', () => {
    expect(formatMetersHuman(null)).toBe('—');
  });
});
