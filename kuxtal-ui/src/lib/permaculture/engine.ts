import { PDB, type PdbEntry } from '../pfaf/seed-data';
import {
  toM2,
  type Plan,
  type Stratum,
  type StratumId,
  type WizardInputs,
  type ZoneProposal,
  type ZoneNumber
} from './types';

// Map plant types in the seed data to food-forest strata.
// PDB types: arbol-alto, arbol-medio, arbusto, herbaceo
// Strata: canopy, sub-canopy, shrub, herb, groundcover, vine, root
function stratumOf(p: PdbEntry, id: string): StratumId {
  if (p.type === 'arbol-alto') return 'canopy';
  if (p.type === 'arbol-medio') return 'sub-canopy';
  if (p.type === 'arbusto') return id === 'yuca' ? 'root' : 'shrub';
  if (id === 'frijol') return 'vine';
  if (id === 'cilantro' || id === 'girasol') return 'groundcover';
  return 'herb';
}

const STRATUM_DEFS: Record<StratumId, { name: string; role: string }> = {
  canopy: { name: 'Dosel alto', role: 'Sombra principal y frutos grandes (10–15 m).' },
  'sub-canopy': { name: 'Dosel medio', role: 'Frutos accesibles y sombra parcial (4–8 m).' },
  shrub: { name: 'Arbustos', role: 'Frutos pequeños, especias y barrera viva (1–3 m).' },
  herb: { name: 'Herbáceas', role: 'Hortalizas y aromáticas (0.3–1 m).' },
  groundcover: { name: 'Cobertura', role: 'Tapiza el suelo, retiene humedad, atrae polinizadores.' },
  vine: { name: 'Trepadoras', role: 'Aprovechan vertical y fijan nitrógeno.' },
  root: { name: 'Raíces', role: 'Tubérculos y carbohidratos del subsuelo.' }
};

export function buildStrata(speciesIds: string[]): Stratum[] {
  const buckets = new Map<StratumId, string[]>();
  for (const id of speciesIds) {
    const p = PDB[id];
    if (!p) continue;
    const s = stratumOf(p, id);
    if (!buckets.has(s)) buckets.set(s, []);
    buckets.get(s)!.push(id);
  }
  const order: StratumId[] = ['canopy', 'sub-canopy', 'shrub', 'vine', 'herb', 'groundcover', 'root'];
  return order
    .map((id) => ({ id, name: STRATUM_DEFS[id].name, role: STRATUM_DEFS[id].role, speciesIds: buckets.get(id) ?? [] }))
    .filter((s) => s.speciesIds.length > 0);
}

// Decide which zones (1–5) the parcel can support based on area.
function zoneCountForArea(m2: number): number {
  if (m2 < 300) return 2;
  if (m2 < 1500) return 3;
  if (m2 < 8000) return 4;
  return 5;
}

// Filter PDB by climate / sun / origin / goal preferences.
function speciesPool(inputs: WizardInputs): string[] {
  const all = Object.entries(PDB);

  const climateFavors = (id: string): boolean => {
    if (inputs.climate === 'desconocido') return true;
    const tropicalFriendly = ['aguacate', 'mango', 'guanabana', 'platano', 'cafe', 'yuca', 'aji', 'frijol', 'maiz', 'cilantro', 'chachafruto'];
    const dryFriendly = ['yuca', 'frijol', 'maiz', 'aji', 'girasol', 'mango'];
    const wetFriendly = ['platano', 'aguacate', 'guanabana', 'cafe', 'cilantro'];
    if (inputs.climate === 'tropical-humedo') return wetFriendly.includes(id) || tropicalFriendly.includes(id);
    if (inputs.climate === 'tropical-seco') return dryFriendly.includes(id);
    if (inputs.climate === 'subtropical') return tropicalFriendly.includes(id);
    return true;
  };

  const sunOk = (p: PdbEntry): boolean => {
    if (inputs.sunExposure === 'mixto') return true;
    if (inputs.sunExposure === 'sombra') return p.sun === 'parcial' || p.sun === 'sombra';
    if (inputs.sunExposure === 'parcial') return p.sun !== 'completo' || p.type !== 'arbol-alto';
    return p.sun === 'completo' || p.sun === 'parcial';
  };

  return all
    .filter(([id, p]) => climateFavors(id) && sunOk(p))
    .map(([id]) => id);
}

function distinctTake<T>(arr: T[], n: number, exclude: Set<T> = new Set()): T[] {
  const out: T[] = [];
  for (const x of arr) {
    if (out.length >= n) break;
    if (exclude.has(x)) continue;
    out.push(x);
  }
  return out;
}

// Build proposals for zones 1..N. Density follows traditional permaculture:
// zone 1 = high (kitchen garden), zone 5 = low (wild edge).
function buildZones(inputs: WizardInputs, areaM2: number, pool: string[]): ZoneProposal[] {
  const n = Math.min(zoneCountForArea(areaM2), 5);
  const totalRingRadius = Math.sqrt(areaM2 / Math.PI);

  const tiers: Array<{ pct: number; density: 'alta' | 'media' | 'baja'; intent: string; name: string }> = [
    { pct: 0.10, density: 'alta', name: 'Cocina viva', intent: 'huerta y aromáticas a un paso de la casa' },
    { pct: 0.20, density: 'alta', name: 'Frutales cercanos', intent: 'frutales medianos y cobertura comestible' },
    { pct: 0.30, density: 'media', name: 'Bosque comestible', intent: 'dosel y guilds productivos' },
    { pct: 0.25, density: 'media', name: 'Cultivo extensivo', intent: 'maíz, frijol, calabaza · milpa' },
    { pct: 0.15, density: 'baja', name: 'Borde silvestre', intent: 'biodiversidad, polinizadores, refugio' }
  ];

  const usedSpecies = new Set<string>();
  const herbs = pool.filter((id) => ['cilantro', 'aji', 'frijol', 'girasol', 'maiz'].includes(id));
  const shrubs = pool.filter((id) => ['cafe', 'yuca'].includes(id));
  const subcanopy = pool.filter((id) => ['platano', 'guanabana'].includes(id));
  const canopy = pool.filter((id) => ['aguacate', 'mango', 'chachafruto'].includes(id));

  const zones: ZoneProposal[] = [];
  let runningR = 0;
  for (let i = 0; i < n; i++) {
    const t = tiers[i];
    const newR = totalRingRadius * Math.sqrt((tiers.slice(0, i + 1).reduce((a, b) => a + b.pct, 0)));
    const ringRadius = newR;
    runningR = newR;

    let zoneSuggested: string[] = [];
    if (i === 0) zoneSuggested = distinctTake(herbs, 4, usedSpecies);
    else if (i === 1) zoneSuggested = [...distinctTake(shrubs, 1, usedSpecies), ...distinctTake(subcanopy, 1, usedSpecies), ...distinctTake(herbs, 2, usedSpecies)];
    else if (i === 2) zoneSuggested = [...distinctTake(canopy, 2, usedSpecies), ...distinctTake(subcanopy, 1, usedSpecies), ...distinctTake(shrubs, 1, usedSpecies)];
    else if (i === 3) zoneSuggested = distinctTake(['maiz', 'frijol', 'yuca', 'aji'].filter((s) => pool.includes(s)), 4, usedSpecies);
    else zoneSuggested = distinctTake(['girasol', 'cilantro', 'chachafruto', 'frijol'].filter((s) => pool.includes(s)), 4, usedSpecies);

    for (const s of zoneSuggested) usedSpecies.add(s);

    zones.push({
      zone: (i + 1) as ZoneNumber,
      name: t.name,
      intent: t.intent,
      ringRadiusM: round1(ringRadius),
      areaPercent: Math.round(t.pct * 100),
      density: t.density,
      suggestedSpecies: zoneSuggested,
      notes: noteForZone(i + 1, inputs)
    });
  }

  // Snap last zone radius to total to avoid floating drift
  if (zones.length) {
    zones[zones.length - 1].ringRadiusM = round1(totalRingRadius);
    void runningR;
  }
  return zones;
}

function noteForZone(z: number, inputs: WizardInputs): string {
  if (z === 1) return 'Visítala todos los días. Mantillo grueso y riego cercano.';
  if (z === 2) return inputs.waterAccess === 'limitada' ? 'Prioriza zanjas a nivel y mantillo.' : 'Riego puntual; agrupa especies con necesidades similares.';
  if (z === 3) return 'Dosel alto da sombra al sotobosque. Fija nitrógeno con frijol y chachafruto.';
  if (z === 4) return 'Manejo trimestral. Aquí encajan los granos básicos y la milpa.';
  return 'Deja que crezca. Hábitat para polinizadores y aves.';
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function gatherSuggested(zones: ZoneProposal[]): string[] {
  const set = new Set<string>();
  for (const z of zones) for (const s of z.suggestedSpecies) set.add(s);
  return [...set];
}

export function suggestPlan(inputs: WizardInputs): Plan {
  const warnings: string[] = [];
  const m2 = toM2(inputs.areaValue, inputs.areaUnit);
  if (m2 < 25) warnings.push('Tu área es muy pequeña para un bosque comestible completo. Concéntrate en zona 1.');
  if (inputs.waterAccess === 'nada') warnings.push('Sin acceso al agua: prioriza captación de lluvia y especies tolerantes a sequía.');
  if (inputs.climate === 'desconocido') warnings.push('Indica el clima cuando puedas — afina mejor las especies sugeridas.');

  const pool = speciesPool(inputs);
  const zones = buildZones(inputs, m2, pool);
  const strata = buildStrata(gatherSuggested(zones));

  return {
    inputs,
    totalAreaM2: m2,
    zones,
    strata,
    generatedAt: new Date().toISOString(),
    warnings
  };
}
