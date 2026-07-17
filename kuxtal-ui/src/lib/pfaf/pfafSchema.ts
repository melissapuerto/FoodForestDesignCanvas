import { allPfafPlants, pfafStratum, type PfafEntry } from './pfafPool';

/**
 * Canonical recommendation schema. `pfafDb.json` is the merged source of truth
 * (recommendation-logic.json was an identical draft). Rather than hand-annotate
 * every entry, we derive the richer scoring fields the engine needs from the
 * existing PFAF fields. Bump this when the dataset shape changes (used by the
 * optional backend catalog refresh — see backend /plants/version).
 */
export const PFAF_SCHEMA_VERSION = 1;

export type PlantLayer =
  | 'canopy' | 'sub-canopy' | 'shrub' | 'herb' | 'groundcover' | 'vine' | 'root';

export type PlantFunction =
  | 'nitrogen-fixer' | 'dynamic-accumulator' | 'windbreak' | 'pollinator'
  | 'biomass' | 'edible' | 'medicinal' | 'living-mulch' | 'pest-repellent' | 'fodder';

export type MoistureClass = 'low' | 'medium' | 'high';

/** A PFAF entry with the derived fields the scoring engine relies on. */
export type NormalizedPlant = PfafEntry & {
  layer: PlantLayer;
  fns: PlantFunction[];
  moisture: MoistureClass[];
  frostTender: boolean;
  invasive: boolean;
};

const NITROGEN_FIXER_FAMILIES = new Set(['Fabaceae', 'Leguminosae']);

function deriveMoisture(water: string): MoistureClass[] {
  const w = water.toLowerCase();
  const out = new Set<MoistureClass>();
  if (w.includes('baja')) out.add('low');
  if (w.includes('media')) out.add('medium');
  if (w.includes('alta')) out.add('high');
  return out.size ? [...out] : ['medium'];
}

function deriveFunctions(p: PfafEntry): PlantFunction[] {
  const fns = new Set<PlantFunction>();
  const hab = (p.hab ?? '').toLowerCase();
  if (p.edible >= 3) fns.add('edible');
  if (p.med >= 3) fns.add('medicinal');
  if (NITROGEN_FIXER_FAMILIES.has(p.f) || /fija|nitr[oó]geno/.test(hab)) fns.add('nitrogen-fixer');
  if (/acumulador/.test(hab)) fns.add('dynamic-accumulator');
  if (/poliniz/.test(hab)) fns.add('pollinator');
  if (/cortaviento|cerca viva|windbreak/.test(hab)) fns.add('windbreak');
  if (p.other >= 3 && !fns.has('nitrogen-fixer')) fns.add('biomass');
  if (fns.size === 0) fns.add('edible'); // every plant yields *something*; avoids empty function set
  return [...fns];
}

/** Fill the derived scoring fields. Pure; safe to call per render. */
export function normalizeEntry(p: PfafEntry): NormalizedPlant {
  return {
    ...p,
    layer: pfafStratum(p),
    fns: deriveFunctions(p),
    moisture: deriveMoisture(p.water),
    // hard zone >= 9 ≈ subtropical/tropical species that won't survive a frost pocket.
    frostTender: p.hard >= 9,
    invasive: p.origin === 'invasive'
  };
}

let _normalized: NormalizedPlant[] | null = null;

/** All bundled plants, normalized for the recommendation engine. Memoized. */
export function allNormalizedPlants(): NormalizedPlant[] {
  if (!_normalized) _normalized = allPfafPlants().map(normalizeEntry);
  return _normalized;
}

/** Drop the memoized pool so the next read re-normalizes (after a catalog refresh). */
export function invalidateNormalized(): void {
  _normalized = null;
}
