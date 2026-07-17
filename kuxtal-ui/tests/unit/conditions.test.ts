import { describe, it, expect } from 'vitest';
import { prefersLowInput, STRUCTURAL_CONDITIONS } from '../../src/lib/stores/conditions';

describe('structural conditions (ONB-06)', () => {
  it('declares the three condition ids', () => {
    expect(STRUCTURAL_CONDITIONS).toEqual([
      'supply-restricted',
      'intermittent-connection',
      'land-insecure'
    ]);
  });

  it('prefers low-input only when supply is restricted', () => {
    expect(prefersLowInput([])).toBe(false);
    expect(prefersLowInput(['land-insecure'])).toBe(false);
    expect(prefersLowInput(['supply-restricted'])).toBe(true);
    expect(prefersLowInput(['intermittent-connection', 'supply-restricted'])).toBe(true);
  });
});
