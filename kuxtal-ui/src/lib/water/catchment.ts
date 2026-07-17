/**
 * Rainwater catchment estimate (WA-02). The harvestable volume is:
 *   litres/year = area(m²) × annual rainfall(mm) × runoff coefficient
 * (1 mm of rain over 1 m² == 1 litre.) A transparent teaching estimate.
 */
export type SurfaceKind = 'roof_metal' | 'roof_tile' | 'concrete' | 'soil' | 'vegetation';

/** Typical runoff coefficients (fraction of rain that can be collected). */
export const RUNOFF_COEFFICIENTS: Record<SurfaceKind, number> = {
  roof_metal: 0.9,
  roof_tile: 0.8,
  concrete: 0.8,
  soil: 0.4,
  vegetation: 0.2
};

export type CatchmentInput = {
  areaM2: number;
  annualRainfallMm: number;
  runoff: number;
};

export function catchmentLitresPerYear(input: CatchmentInput): number {
  const { areaM2, annualRainfallMm } = input;
  if (!Number.isFinite(areaM2) || !Number.isFinite(annualRainfallMm)) return 0;
  if (areaM2 <= 0 || annualRainfallMm <= 0) return 0;
  const runoff = Math.min(1, Math.max(0, input.runoff));
  return areaM2 * annualRainfallMm * runoff;
}

export function litresToM3(l: number): number {
  return l / 1000;
}

/** How many days of a household's water this covers (default ~600 L/day, family of 4). */
export function householdDays(litres: number, dailyLitres = 600): number {
  if (dailyLitres <= 0) return 0;
  return litres / dailyLitres;
}

export const CATCHMENT_SOURCE = {
  name: 'Texas A&M / FAO rainwater harvesting guidelines (runoff coefficients)',
  url: 'https://www.fao.org/4/x5744e/x5744e0e.htm'
};
