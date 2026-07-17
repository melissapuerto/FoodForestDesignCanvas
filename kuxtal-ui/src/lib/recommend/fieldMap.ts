import type { MoistureClass, NormalizedPlant } from '../pfaf/pfafSchema';
import type { Goal, SunExposure } from '../permaculture/types';

/** Normalize a PFAF sun string into a coarse light requirement. */
export function sunRequirement(sun: string): 'full' | 'partial' | 'shade' | 'any' {
  const s = sun.toLowerCase();
  if (s.includes('sombra') && !s.includes('parcial')) return 'shade';
  if (s.includes('parcial') || s.includes('media')) return 'partial';
  if (s.includes('pleno') || s.includes('completo')) return 'full';
  return 'any';
}

const MOISTURE_ORDER: MoistureClass[] = ['low', 'medium', 'high'];

/** 1.0 exact match, 0.5 adjacent, 0 opposite. */
export function moistureFit(plantMoisture: MoistureClass[], site: MoistureClass | null | undefined): number {
  if (!site) return 0.5; // unknown site moisture → neutral
  if (plantMoisture.includes(site)) return 1;
  const si = MOISTURE_ORDER.indexOf(site);
  const nearest = Math.min(...plantMoisture.map((m) => Math.abs(MOISTURE_ORDER.indexOf(m) - si)));
  if (nearest === 1) return 0.5;
  return 0;
}

const SOIL_SYNONYMS: Record<string, string[]> = {
  ligero: ['ligero', 'suelto', 'arenoso', 'drenado', 'seco'],
  rico: ['rico', 'húmedo', 'humedo', 'fértil', 'fertil', 'profundo'],
  ácido: ['ácido', 'acido'],
  calcáreo: ['calcáreo', 'calcareo', 'alcalino'],
  pobre: ['pobre', 'rocoso']
};

/** Rough soil compatibility: 1.0 keyword overlap, 0.3 mismatch, 0.5 unknown. */
export function soilFit(plantSoil: string, site: string | null | undefined): number {
  if (!site || !site.trim()) return 0.5;
  const p = plantSoil.toLowerCase();
  const s = site.toLowerCase();
  if (p.split(/[\s/]+/).some((tok) => tok && s.includes(tok))) return 1;
  for (const syns of Object.values(SOIL_SYNONYMS)) {
    const pHit = syns.some((x) => p.includes(x));
    const sHit = syns.some((x) => s.includes(x));
    if (pHit && sHit) return 1;
  }
  return 0.3;
}

/** Does a plant serve one of the user's onboarding goals? */
function plantServesGoal(p: NormalizedPlant, goal: Goal): boolean {
  switch (goal) {
    case 'alimento': return p.edible >= 3;
    case 'medicinal': return p.med >= 3;
    case 'comercio': return p.edible >= 4;
    case 'sanar-suelo': return p.fns.includes('nitrogen-fixer') || p.fns.includes('dynamic-accumulator') || p.other >= 3;
    case 'biodiversidad': return p.fns.includes('pollinator') || p.other >= 2;
    default: return false;
  }
}

/** Fraction of the user's goals this plant satisfies (1.0 when no goals set). */
export function goalFit(p: NormalizedPlant, goals: Goal[] | undefined): number {
  if (!goals?.length) return 1;
  const hits = goals.filter((g) => plantServesGoal(p, g)).length;
  return hits / goals.length;
}

const SUN_FIT: Record<Exclude<SunExposure, 'mixto'>, Record<'full' | 'partial' | 'shade' | 'any', number>> = {
  completo: { full: 1, partial: 0.6, shade: 0.3, any: 1 },
  parcial: { full: 0.6, partial: 1, shade: 0.6, any: 1 },
  sombra: { full: 0.2, partial: 0.6, shade: 1, any: 1 }
};

/** Soft fit between a plant's light need and the site-wide sun exposure. */
export function sunSiteFit(plantSun: string, exposure: SunExposure | undefined): number {
  if (!exposure || exposure === 'mixto') return 1;
  return SUN_FIT[exposure][sunRequirement(plantSun)];
}

type ChallengeScorerFn = (p: NormalizedPlant) => number;

const CHALLENGE_SCORERS: Record<string, ChallengeScorerFn> = {
  erosion: (p) =>
    (p.fns.includes('nitrogen-fixer') || p.fns.includes('biomass') ||
     p.layer === 'groundcover' || p.layer === 'root') ? 1 : 0.3,
  'suelo-pobre': (p) =>
    (p.fns.includes('nitrogen-fixer') || p.fns.includes('dynamic-accumulator')) ? 1 : 0.2,
  sequia: (p) =>
    p.moisture.includes('low') ? 1 : p.moisture.includes('medium') ? 0.5 : 0.1,
  inundacion: (p) =>
    p.moisture.includes('high') ? 1 : p.moisture.includes('medium') ? 0.5 : 0.1,
  plagas: (p) => p.fns.includes('pest-repellent') ? 1 : 0.3,
  viento: (p) =>
    (p.fns.includes('windbreak') || p.layer === 'canopy' || p.layer === 'sub-canopy') ? 1 : 0.4,
  espacio: (p) =>
    (['herb', 'groundcover', 'vine', 'root'] as const).includes(p.layer as 'herb') ? 1 : 0.4,
  tiempo: (p) => (!p.annual ? 1 : 0.3)
};

/** How well the plant addresses the user's stated site challenges (0..1). */
export function challengeFit(p: NormalizedPlant, challenges: string[] | undefined): number {
  if (!challenges?.length) return 0.5;
  const scoreable = challenges.filter((c) => c in CHALLENGE_SCORERS);
  if (!scoreable.length) return 0.5;
  const sum = scoreable.reduce((acc, c) => acc + CHALLENGE_SCORERS[c](p), 0);
  return sum / scoreable.length;
}

/** Mild preference for native/accessible plants when budget is tight (0..1). */
export function budgetFit(p: NormalizedPlant, budget: string | null | undefined): number {
  if (!budget || budget === 'medio' || budget === 'alto') return 0.5;
  // ninguno / bajo: prefer native and adapted origin (freely propagatable)
  return p.origin === 'native' || p.origin === 'adapted' ? 1 : 0.2;
}
