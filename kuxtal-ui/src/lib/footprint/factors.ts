/**
 * Ecological-footprint factors (EFT-01). Transparent, documented estimates —
 * NOT precision figures. Each plant on the canvas contributes:
 *   - an annual water footprint (litres/year), derived from the crop's water
 *     footprint per kg of product (green+blue+grey, global averages from
 *     Mekonnen & Hoekstra 2011) multiplied by a rough smallholder yield;
 *   - an annual CO2 drawdown estimate (kg/year), from agroforestry
 *     sequestration ranges by growth form.
 *
 * Every number here is an order-of-magnitude teaching estimate so a grower can
 * see the *relative* weight of their choices. Sources are linked in the UI.
 */
export type FootprintFactor = {
  /** Water footprint of the product, litres per kg (Mekonnen & Hoekstra 2011). */
  wfLPerKg: number;
  /** Rough annual yield per established plant, kg/year (smallholder estimate). */
  yieldKgPerYear: number;
  /** Net annual CO2 drawdown per established plant, kg CO2/year. */
  co2KgPerYear: number;
};

// Per-species factors for the bundled regional registry (ids match registry.ts).
export const SPECIES_FACTORS: Record<string, FootprintFactor> = {
  cafe:        { wfLPerKg: 18900, yieldKgPerYear: 0.5, co2KgPerYear: 5 },   // green coffee, very water-intensive
  cacao:       { wfLPerKg: 19900, yieldKgPerYear: 0.4, co2KgPerYear: 12 },
  aguacate:    { wfLPerKg: 1980,  yieldKgPerYear: 30,  co2KgPerYear: 22 },
  mango:       { wfLPerKg: 1800,  yieldKgPerYear: 40,  co2KgPerYear: 22 },
  platano:     { wfLPerKg: 790,   yieldKgPerYear: 18,  co2KgPerYear: 6 },
  guanabana:   { wfLPerKg: 1800,  yieldKgPerYear: 15,  co2KgPerYear: 12 },
  papaya:      { wfLPerKg: 460,   yieldKgPerYear: 25,  co2KgPerYear: 6 },
  guamo:       { wfLPerKg: 1500,  yieldKgPerYear: 8,   co2KgPerYear: 22 },
  chachafruto: { wfLPerKg: 1500,  yieldKgPerYear: 6,   co2KgPerYear: 22 },
  yuca:        { wfLPerKg: 560,   yieldKgPerYear: 3,   co2KgPerYear: 1.5 },
  maiz:        { wfLPerKg: 1222,  yieldKgPerYear: 0.15, co2KgPerYear: 0.3 },
  frijol:      { wfLPerKg: 5053,  yieldKgPerYear: 0.1, co2KgPerYear: 0.3 },
  aji:         { wfLPerKg: 370,   yieldKgPerYear: 0.5, co2KgPerYear: 0.5 },
  cilantro:    { wfLPerKg: 300,   yieldKgPerYear: 0.05, co2KgPerYear: 0.2 },
  girasol:     { wfLPerKg: 3366,  yieldKgPerYear: 0.1, co2KgPerYear: 0.3 },
  calabaza:    { wfLPerKg: 350,   yieldKgPerYear: 2,   co2KgPerYear: 0.5 }
};

// Fallback factors by growth form (plant_type) for species without a specific
// entry (e.g. the larger PFAF pool).
export const TYPE_FACTORS: Record<string, FootprintFactor> = {
  'arbol-alto':  { wfLPerKg: 1500, yieldKgPerYear: 25, co2KgPerYear: 22 },
  'arbol-medio': { wfLPerKg: 1200, yieldKgPerYear: 15, co2KgPerYear: 12 },
  'arbusto':     { wfLPerKg: 1000, yieldKgPerYear: 3,  co2KgPerYear: 5 },
  'herbaceo':    { wfLPerKg: 900,  yieldKgPerYear: 0.3, co2KgPerYear: 0.4 },
  'cobertura':   { wfLPerKg: 500,  yieldKgPerYear: 1,  co2KgPerYear: 0.4 },
  'vine':        { wfLPerKg: 800,  yieldKgPerYear: 1,  co2KgPerYear: 1 }
};

export const DEFAULT_FACTOR: FootprintFactor = { wfLPerKg: 1000, yieldKgPerYear: 1, co2KgPerYear: 2 };

export const FOOTPRINT_SOURCES: Array<{ name: string; url: string }> = [
  { name: 'Mekonnen & Hoekstra (2011), water footprint of crops', url: 'https://waterfootprint.org/resources/Report47-WaterFootprintCrops-Vol1.pdf' },
  { name: 'FAO — agroforestry & carbon sequestration', url: 'https://www.fao.org/forestry/agroforestry/en/' },
  { name: 'ecoinvent / FAOSTAT (reference databases)', url: 'https://www.fao.org/faostat/en/' }
];
