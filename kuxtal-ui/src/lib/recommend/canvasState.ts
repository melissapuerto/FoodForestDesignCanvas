import type { PlantedRow, SpeciesRow } from '../stores/appState';
import { allNormalizedPlants, type PlantFunction, type PlantLayer } from '../pfaf/pfafSchema';
import type { CanvasState, PlacedPlant } from './types';

function layerFromType(type: string | null | undefined): PlantLayer | null {
  switch (type) {
    case 'arbol-alto': return 'canopy';
    case 'arbol-medio': return 'sub-canopy';
    case 'arbusto': return 'shrub';
    case 'trepadora': return 'vine';
    case 'cobertura': return 'groundcover';
    case 'herbaceo': return 'herb';
    default: return null;
  }
}

const FN_FROM_DB: Record<string, PlantFunction> = {
  comestible: 'edible',
  medicinal: 'medicinal',
  'fija-n': 'nitrogen-fixer',
  polinizador: 'pollinator',
  soporte: 'biomass',
  madera: 'biomass',
  sombra: 'biomass'
};

function fnsFromDb(raw: string | null | undefined): PlantFunction[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out = new Set<PlantFunction>();
    for (const v of arr) {
      const mapped = FN_FROM_DB[String(v).toLowerCase()];
      if (mapped) out.add(mapped);
    }
    return [...out];
  } catch {
    return [];
  }
}

/**
 * Snapshot the current canvas into the shape the scoring engine consumes.
 * Resolves each placed plant to its layer/functions (via scientific-name match
 * to the normalized pool, falling back to the species row's own type/functions).
 */
export function buildCanvasState(
  planted: PlantedRow[],
  speciesRows: SpeciesRow[],
  candidatePoint?: { lat: number; lng: number } | null
): CanvasState {
  const byId = new Map(speciesRows.map((s) => [s.id, s]));
  const bySci = new Map(allNormalizedPlants().map((p) => [p.sci.toLowerCase(), p]));

  const placed: PlacedPlant[] = planted.map((row) => {
    const sp = byId.get(row.species_id) ?? null;
    const sci = sp?.scientific_name?.toLowerCase() ?? null;
    const norm = sci ? bySci.get(sci) ?? null : null;
    return {
      speciesId: row.species_id,
      sci,
      lat: row.lat,
      lng: row.lng,
      layer: norm?.layer ?? layerFromType(sp?.plant_type),
      fns: norm?.fns ?? fnsFromDb(sp?.functions)
    };
  });

  const layerCounts: Record<string, number> = {};
  const functionCounts: Record<string, number> = {};
  for (const p of placed) {
    if (p.layer) layerCounts[p.layer] = (layerCounts[p.layer] ?? 0) + 1;
    for (const f of p.fns) functionCounts[f] = (functionCounts[f] ?? 0) + 1;
  }

  return { placed, layerCounts, functionCounts, candidatePoint: candidatePoint ?? null };
}
