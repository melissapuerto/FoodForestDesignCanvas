import { tr } from '../i18n/translate';
import type { Goal, SunExposure, WizardInputs } from '../permaculture/types';
import { plantFitsUsdaZone, siteUsdaZone } from '../climate/hardiness';
import { inferBioregion, speciesMatchesBioregion } from '../climate/region';
import pfafDb from './pfafDb.json';

export type PfafEntry = {
  id: string;
  n: string;
  sci: string;
  f: string;
  type: string;
  space: number;
  sun: string;
  water: string;
  soil: string;
  /** Minimum USDA hardiness zone required (PFAF). */
  hard: number;
  edible: number;
  med: number;
  other: number;
  hab: string;
  /** Summer annual — still filtered by hard when hard >= 8 (frost-tender). */
  annual?: boolean;
  /** Bioregions where this species is ecologically relevant (see climate/region.ts). */
  regions?: string[];
  origin?: 'native' | 'adapted' | 'invasive';
};

let cached: PfafEntry[] | null = null;

/** All PFAF records bundled for offline recommendations. */
export function allPfafPlants(): PfafEntry[] {
  if (!cached) cached = pfafDb as PfafEntry[];
  return cached;
}

/** Replace the in-memory pool with a refreshed catalog (see catalogSync.ts). */
export function setCatalogOverride(plants: PfafEntry[]): void {
  cached = plants;
}

function sunPref(sun: string): 'full' | 'partial' | 'shade' | 'any' {
  const s = sun.toLowerCase();
  if (s.includes('sombra') && !s.includes('parcial')) return 'shade';
  if (s.includes('parcial') || s.includes('media')) return 'partial';
  if (s.includes('pleno') || s.includes('completo')) return 'full';
  return 'any';
}

function sunOk(plantSun: string, exposure: SunExposure): boolean {
  if (exposure === 'mixto') return true;
  const p = sunPref(plantSun);
  if (p === 'any') return true;
  if (exposure === 'sombra') return p === 'shade' || p === 'partial';
  if (exposure === 'parcial') return p !== 'full';
  return p === 'full' || p === 'partial';
}

function goalOk(p: PfafEntry, goals: Goal[]): boolean {
  if (!goals.length) return true;
  return goals.some((g) => {
    if (g === 'alimento') return p.edible >= 3;
    if (g === 'medicinal') return p.med >= 3;
    if (g === 'sanar-suelo') return p.other >= 3 || /acumulador|fija|nitrogeno|nitrógeno|dynamic/i.test(p.hab);
    if (g === 'biodiversidad') return p.other >= 2 || /poliniz|borde|silvestre/i.test(p.hab);
    if (g === 'comercio') return p.edible >= 4;
    return true;
  });
}

function typeBucket(p: PfafEntry): 'tree' | 'shrub' | 'herb' | 'vine' | 'root' | 'other' {
  const t = `${p.type} ${p.hab}`.toLowerCase();
  if (/árbol|arbol|tree|palma/.test(t)) return 'tree';
  if (/arbusto|shrub|matorral/.test(t)) return 'shrub';
  if (/enredadera|trepad|vine|parra/.test(t)) return 'vine';
  if (/raíz|raiz|root|tubérculo|tuberculo/.test(t)) return 'root';
  if (/hierba|herb|anual|perenne|cobertura|forraj/.test(t)) return 'herb';
  return 'other';
}

export function filterPfafForSite(inputs: WizardInputs): {
  pool: PfafEntry[];
  siteZone: number | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const siteZone = siteUsdaZone(inputs);
  const all = allPfafPlants();

  if (siteZone == null) {
    warnings.push(tr('pfaf_warn_need_location'));
    return { pool: [], siteZone: null, warnings };
  }

  const siteBio =
    inputs.lat != null && inputs.lng != null
      ? inferBioregion(inputs.lat, inputs.lng)
      : null;

  const pool = all.filter((p) => {
    if (!plantFitsUsdaZone(p.hard, siteZone, !!p.annual)) return false;
    if (!sunOk(p.sun, inputs.sunExposure)) return false;
    if (!goalOk(p, inputs.goals)) return false;
    if (siteBio && p.regions?.length && !speciesMatchesBioregion(p.regions, siteBio)) {
      return false;
    }
    return true;
  });

  if (!pool.length) {
    warnings.push(tr('pfaf_warn_no_match', { zone: String(siteZone) }));
  } else if (siteBio) {
    pool.sort((a, b) => {
      const aR = speciesMatchesBioregion(a.regions ?? [], siteBio) ? 1 : 0;
      const bR = speciesMatchesBioregion(b.regions ?? [], siteBio) ? 1 : 0;
      if (bR !== aR) return bR - aR;
      if (a.origin === 'native' && b.origin !== 'native') return -1;
      if (b.origin === 'native' && a.origin !== 'native') return 1;
      return a.n.localeCompare(b.n, 'es');
    });
  }

  return { pool, siteZone, warnings };
}

export function bucketPool(pool: PfafEntry[]): Record<'tree' | 'shrub' | 'herb' | 'vine' | 'root' | 'other', PfafEntry[]> {
  const out: Record<'tree' | 'shrub' | 'herb' | 'vine' | 'root' | 'other', PfafEntry[]> = {
    tree: [],
    shrub: [],
    herb: [],
    vine: [],
    root: [],
    other: []
  };
  for (const p of pool) out[typeBucket(p)].push(p);
  return out;
}

export function pfafStratum(p: PfafEntry): 'canopy' | 'sub-canopy' | 'shrub' | 'herb' | 'groundcover' | 'vine' | 'root' {
  const b = typeBucket(p);
  if (b === 'tree') return p.space >= 6 ? 'canopy' : 'sub-canopy';
  if (b === 'shrub') return 'shrub';
  if (b === 'vine') return 'vine';
  if (b === 'root') return 'root';
  if (p.space <= 0.35) return 'groundcover';
  return 'herb';
}
