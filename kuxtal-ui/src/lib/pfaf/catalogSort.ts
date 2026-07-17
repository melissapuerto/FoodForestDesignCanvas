import { plantFitsUsdaZone } from '../climate/hardiness';
import { parseRegionsJson, speciesMatchesBioregion } from '../climate/region';
import type { SpeciesRow } from '../stores/appState';
import type { SiteContext } from './siteContext';

function plantHardFromRow(sp: SpeciesRow): number | null {
  if (!sp.zones) return null;
  try {
    const z = JSON.parse(sp.zones) as number[];
    if (Array.isArray(z) && z.length) return z[0];
  } catch {
    /* ignore */
  }
  return null;
}

function catalogScore(sp: SpeciesRow, ctx: SiteContext): number {
  let score = 0;
  const regions = parseRegionsJson(sp.region);

  if (ctx.bioregion && speciesMatchesBioregion(regions, ctx.bioregion)) {
    score += 1000;
    if (sp.origin === 'native') score += 500;
    else if (sp.origin === 'adapted') score += 200;
    else if (sp.origin === 'invasive') score -= 100;
  } else if (regions.length) {
    score += 50;
  }

  const hard = plantHardFromRow(sp);
  if (ctx.usdaZone != null && hard != null) {
    if (plantFitsUsdaZone(hard, ctx.usdaZone)) score += 300;
    else score -= 800;
  }

  return score;
}

/** Sort catalog: native/regional matches first, then climate-fit, then A–Z. */
export function sortSpeciesForSite(rows: SpeciesRow[], ctx: SiteContext | null): SpeciesRow[] {
  if (!ctx?.bioregion && ctx?.usdaZone == null) {
    return [...rows].sort((a, b) => a.common_name.localeCompare(b.common_name, 'es'));
  }
  return [...rows].sort((a, b) => {
    const diff = catalogScore(b, ctx) - catalogScore(a, ctx);
    if (diff !== 0) return diff;
    return a.common_name.localeCompare(b.common_name, 'es');
  });
}

/** Hide PFAF species that don't fit the site's USDA zone when location is known. */
export function filterSpeciesForSite(rows: SpeciesRow[], ctx: SiteContext | null): SpeciesRow[] {
  if (ctx?.usdaZone == null) return rows;
  return rows.filter((sp) => {
    if (sp.source !== 'pfaf') return true;
    const hard = plantHardFromRow(sp);
    if (hard == null) return true;
    return plantFitsUsdaZone(hard, ctx.usdaZone!, false);
  });
}
