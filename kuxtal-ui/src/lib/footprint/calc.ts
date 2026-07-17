import { SPECIES_FACTORS, TYPE_FACTORS, DEFAULT_FACTOR, type FootprintFactor } from './factors';

export type PlantedAgg = { species_id: string; plant_type: string | null; count: number };
export type SpeciesFootprint = { species_id: string; count: number; waterL: number; co2Kg: number };
export type FootprintResult = {
  waterL: number;
  co2Kg: number;
  plants: number;
  perSpecies: SpeciesFootprint[];
};

export function factorFor(species_id: string, plant_type: string | null): FootprintFactor {
  return (
    SPECIES_FACTORS[species_id] ??
    (plant_type ? TYPE_FACTORS[plant_type] : undefined) ??
    DEFAULT_FACTOR
  );
}

/**
 * Estimate the annual water footprint (L/yr) and CO2 drawdown (kg/yr) of the
 * plants on the canvas. Pure and deterministic — the UI feeds it an aggregation
 * of planted species and renders the result with a plain-language reading.
 */
export function computeFootprint(items: PlantedAgg[]): FootprintResult {
  let waterL = 0;
  let co2Kg = 0;
  let plants = 0;
  const perSpecies: SpeciesFootprint[] = [];
  for (const it of items) {
    const f = factorFor(it.species_id, it.plant_type);
    const count = Math.max(0, it.count);
    const w = f.wfLPerKg * f.yieldKgPerYear * count;
    const c = f.co2KgPerYear * count;
    waterL += w;
    co2Kg += c;
    plants += count;
    perSpecies.push({ species_id: it.species_id, count, waterL: w, co2Kg: c });
  }
  perSpecies.sort((a, b) => b.waterL - a.waterL);
  return { waterL, co2Kg, plants, perSpecies };
}

// ---- Relatable conversions for the plain-language interpretation (EFT-03) ----

export function litresToM3(l: number): number {
  return l / 1000;
}

/** Number of ~65 L showers the annual water footprint is equivalent to. */
export function showerEquivalents(l: number): number {
  return l / 65;
}

/** Km of average-car driving (~0.12 kg CO2/km) the annual drawdown offsets. */
export function carKmEquivalent(co2Kg: number): number {
  return co2Kg / 0.12;
}
