import { tr, type TranslationKey } from '../i18n/translate';

/** Bioregions used in PFAF catalog + recommendations (not political borders). */
export type Bioregion =
  | 'nordic'
  | 'temperate'
  | 'mediterranean'
  | 'subtropical'
  | 'tropical'
  | 'andes'
  | 'mesoamerica';

const BIOREGION_KEYS: Record<Bioregion, TranslationKey> = {
  nordic: 'bioregion_nordic',
  temperate: 'bioregion_temperate',
  mediterranean: 'bioregion_mediterranean',
  subtropical: 'bioregion_subtropical',
  tropical: 'bioregion_tropical',
  andes: 'bioregion_andes',
  mesoamerica: 'bioregion_mesoamerica'
};

/** Localized display label for a bioregion. */
export function bioregionLabel(b: Bioregion): string {
  return tr(BIOREGION_KEYS[b]);
}

/**
 * Infer primary bioregion from coordinates (rough, for catalog sorting + filters).
 */
export function inferBioregion(lat: number, lng: number): Bioregion {
  const absLat = Math.abs(lat);

  // Andes / altiplano
  if (lng >= -82 && lng <= -58 && absLat >= 2 && absLat <= 18) return 'andes';

  // Mesoamérica / Centroamérica
  if (lng >= -110 && lng <= -75 && absLat >= 8 && absLat < 28) return 'mesoamerica';

  // Trópico ecuatorial
  if (absLat < 23) {
    if (lng >= -95 && lng <= -35) return 'tropical';
    if (lng >= 95 && lng <= 155) return 'tropical';
    return 'tropical';
  }

  // Mediterráneo (sur de Europa, norte de África, Chile central)
  if (
    (lng >= -10 && lng <= 40 && absLat >= 30 && absLat <= 45) ||
    (lng >= -75 && lng <= -68 && absLat >= 30 && absLat <= 38)
  ) {
    return 'mediterranean';
  }

  // Nórdico / boreal
  if (absLat >= 55 && lng >= -25 && lng <= 35) return 'nordic';

  // Subtropical
  if (absLat >= 23 && absLat < 35) return 'subtropical';

  // Templado por defecto (Europa, EE.UU., sur de Chile/Argentina, etc.)
  if (absLat >= 35 && absLat < 55) return 'temperate';

  return 'temperate';
}

export function parseRegionsJson(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
}

export function speciesMatchesBioregion(
  speciesRegions: string[],
  siteBioregion: Bioregion
): boolean {
  if (!speciesRegions.length) return false;
  return speciesRegions.map((r) => r.toLowerCase()).includes(siteBioregion);
}
