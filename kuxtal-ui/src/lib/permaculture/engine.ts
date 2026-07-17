import {
  bucketPool,
  filterPfafForSite,
  pfafStratum,
  type PfafEntry
} from '../pfaf/pfafPool';
import {
  toM2,
  type Plan,
  type Stratum,
  type StratumId,
  type WizardInputs,
  type ZoneProposal,
  type ZoneNumber
} from './types';
import { tr, type TranslationKey } from '../i18n/translate';
import { localSpeciesName } from '../i18n/dataLocal';

const STRATUM_KEYS: Record<StratumId, { name: TranslationKey; role: TranslationKey }> = {
  canopy: { name: 'stratum_canopy_name', role: 'stratum_canopy_role' },
  'sub-canopy': { name: 'stratum_subcanopy_name', role: 'stratum_subcanopy_role' },
  shrub: { name: 'stratum_shrub_name', role: 'stratum_shrub_role' },
  herb: { name: 'stratum_herb_name', role: 'stratum_herb_role' },
  groundcover: { name: 'stratum_groundcover_name', role: 'stratum_groundcover_role' },
  vine: { name: 'stratum_vine_name', role: 'stratum_vine_role' },
  root: { name: 'stratum_root_name', role: 'stratum_root_role' }
};

/** Localized display name for a stratum/layer (also used by the recommender). */
export function stratumName(id: StratumId): string {
  return tr(STRATUM_KEYS[id].name);
}

function zoneCountForArea(m2: number): number {
  if (m2 < 300) return 2;
  if (m2 < 1500) return 3;
  if (m2 < 8000) return 4;
  return 5;
}

function distinctTake(entries: PfafEntry[], n: number, exclude: Set<string> = new Set()): PfafEntry[] {
  const out: PfafEntry[] = [];
  for (const p of entries) {
    if (out.length >= n) break;
    if (exclude.has(p.id)) continue;
    out.push(p);
  }
  return out;
}

function displayName(p: PfafEntry): string {
  return localSpeciesName(p.n, p.sci);
}

export function buildStrataFromPfaf(species: PfafEntry[]): Stratum[] {
  const buckets = new Map<StratumId, PfafEntry[]>();
  for (const p of species) {
    const s = pfafStratum(p);
    if (!buckets.has(s)) buckets.set(s, []);
    buckets.get(s)!.push(p);
  }
  const order: StratumId[] = ['canopy', 'sub-canopy', 'shrub', 'vine', 'herb', 'groundcover', 'root'];
  return order
    .map((id) => ({
      id,
      name: tr(STRATUM_KEYS[id].name),
      role: tr(STRATUM_KEYS[id].role),
      speciesIds: (buckets.get(id) ?? []).map(displayName)
    }))
    .filter((s) => s.speciesIds.length > 0);
}

function buildZones(inputs: WizardInputs, areaM2: number, pool: PfafEntry[]): ZoneProposal[] {
  const n = Math.min(zoneCountForArea(areaM2), 5);
  const totalRingRadius = Math.sqrt(areaM2 / Math.PI);
  const buckets = bucketPool(pool);

  const tiers: Array<{ pct: number; density: 'alta' | 'media' | 'baja'; intent: string; name: string }> = [
    { pct: 0.10, density: 'alta', name: tr('plan_zone1_name'), intent: tr('plan_zone1_intent') },
    { pct: 0.20, density: 'alta', name: tr('plan_zone2_name'), intent: tr('plan_zone2_intent') },
    { pct: 0.30, density: 'media', name: tr('plan_zone3_name'), intent: tr('plan_zone3_intent') },
    { pct: 0.25, density: 'media', name: tr('plan_zone4_name'), intent: tr('plan_zone4_intent') },
    { pct: 0.15, density: 'baja', name: tr('plan_zone5_name'), intent: tr('plan_zone5_intent') }
  ];

  const used = new Set<string>();
  const zones: ZoneProposal[] = [];

  for (let i = 0; i < n; i++) {
    const t = tiers[i];
    const ringR = totalRingRadius * Math.sqrt(tiers.slice(0, i + 1).reduce((a, b) => a + b.pct, 0));

    let picks: PfafEntry[] = [];
    if (i === 0) {
      picks = distinctTake([...buckets.herb, ...buckets.root], 4, used);
    } else if (i === 1) {
      picks = [
        ...distinctTake(buckets.shrub, 1, used),
        ...distinctTake(buckets.tree.filter((p) => pfafStratum(p) === 'sub-canopy'), 1, used),
        ...distinctTake(buckets.herb, 2, used)
      ];
    } else if (i === 2) {
      picks = [
        ...distinctTake(buckets.tree.filter((p) => pfafStratum(p) === 'canopy'), 2, used),
        ...distinctTake(buckets.tree.filter((p) => pfafStratum(p) === 'sub-canopy'), 1, used),
        ...distinctTake(buckets.shrub, 1, used)
      ];
    } else if (i === 3) {
      picks = distinctTake(
        [...buckets.herb, ...buckets.root, ...buckets.vine].filter((p) => p.edible >= 3),
        4,
        used
      );
    } else {
      picks = distinctTake(
        [...buckets.herb, ...buckets.shrub, ...buckets.other].filter((p) => p.other >= 2 || p.med >= 3),
        4,
        used
      );
    }

    for (const p of picks) used.add(p.id);

    zones.push({
      zone: (i + 1) as ZoneNumber,
      name: t.name,
      intent: t.intent,
      ringRadiusM: round1(ringR),
      areaPercent: Math.round(t.pct * 100),
      density: t.density,
      suggestedSpecies: picks.map(displayName),
      notes: noteForZone(i + 1, inputs)
    });
  }

  if (zones.length) {
    zones[zones.length - 1].ringRadiusM = round1(totalRingRadius);
  }
  return zones;
}

function noteForZone(z: number, inputs: WizardInputs): string {
  if (z === 1) return tr('plan_zone1_note');
  if (z === 2) return inputs.waterAccess === 'limitada' ? tr('plan_zone2_note_limited') : tr('plan_zone2_note');
  if (z === 3) return tr('plan_zone3_note');
  if (z === 4) return tr('plan_zone4_note');
  return tr('plan_zone5_note');
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Legacy helper — accepts common names or pfaf ids. */
export function buildStrata(speciesIds: string[]): Stratum[] {
  const want = new Set(speciesIds.map((s) => s.toLowerCase()));
  const all = filterPfafForSite({
    parcelName: '',
    location: '',
    lat: 55,
    lng: 0,
    areaValue: 1,
    areaUnit: 'ha',
    climate: 'templado',
    sunExposure: 'mixto',
    waterAccess: 'lluvia',
    region: '',
    microclimates: [],
    soil: '',
    humidity: '',
    altitude: '',
    goals: []
  }).pool;
  const matched = all.filter(
    (p) => want.has(p.id.toLowerCase()) || want.has(p.n.toLowerCase())
  );
  return buildStrataFromPfaf(matched);
}

export function suggestPlan(inputs: WizardInputs): Plan {
  const warnings: string[] = [];
  const m2 = toM2(inputs.areaValue, inputs.areaUnit);
  if (m2 < 25) warnings.push(tr('plan_warn_small'));
  if (inputs.waterAccess === 'nada') warnings.push(tr('plan_warn_no_water'));

  const { pool, siteZone, warnings: filterWarnings } = filterPfafForSite(inputs);
  warnings.push(...filterWarnings);

  if (siteZone != null) {
    warnings.push(tr('plan_warn_usda_filtered', { zone: String(siteZone) }));
  }

  const zones = buildZones(inputs, m2, pool);

  const pickedNames = new Set<string>();
  for (const z of zones) for (const s of z.suggestedSpecies) pickedNames.add(s);
  const pickedPlants = pool.filter((p) => pickedNames.has(p.n));

  const strata = buildStrataFromPfaf(pickedPlants);

  if (inputs.lat == null && inputs.climate === 'desconocido') {
    warnings.push(tr('plan_warn_place_map'));
  }

  return {
    inputs,
    totalAreaM2: m2,
    zones,
    strata,
    generatedAt: new Date().toISOString(),
    warnings
  };
}
