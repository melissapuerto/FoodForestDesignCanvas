import type { ClimateProfile, WizardInputs } from '../permaculture/types';

/**
 * Rough USDA hardiness zone from latitude (Northern or Southern hemisphere).
 * Coastal/maritime sites are often half a zone milder — lng is reserved for later refinement.
 */
export function estimateUsdaZoneFromLat(lat: number, _lng?: number | null): number {
  const abs = Math.abs(lat);
  if (abs >= 67) return 2;
  if (abs >= 62) return 3;
  if (abs >= 58) return 4;
  if (abs >= 54) return 5;
  if (abs >= 50) return 6;
  if (abs >= 46) return 7;
  if (abs >= 42) return 8;
  if (abs >= 38) return 9;
  if (abs >= 33) return 10;
  return 11;
}

export function parseAltitudeM(raw: string | undefined | null): number | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Altitude subtracts ~1 USDA zone per 600 m (rule of thumb). */
export function adjustZoneForAltitude(zone: number, altitudeM: number | null): number {
  if (altitudeM == null || altitudeM <= 200) return zone;
  const drop = Math.floor((altitudeM - 200) / 600);
  return Math.max(1, zone - drop);
}

export function climateToTypicalUsdaZone(climate: ClimateProfile): number | null {
  switch (climate) {
    case 'frio':
      return 3;
    case 'templado':
      return 6;
    case 'subtropical':
      return 8;
    case 'tropical-humedo':
    case 'tropical-seco':
      return 10;
    default:
      return null;
  }
}

export function inferClimateFromLat(lat: number): ClimateProfile {
  const abs = Math.abs(lat);
  if (abs >= 58) return 'frio';
  if (abs >= 45) return 'templado';
  if (abs >= 30) return 'subtropical';
  if (abs >= 23) return 'tropical-humedo';
  return 'tropical-humedo';
}

/** Site USDA zone used to filter PFAF entries (`hard` = minimum zone required). */
export function siteUsdaZone(inputs: WizardInputs): number | null {
  if (inputs.lat != null && Number.isFinite(inputs.lat)) {
    let zone = estimateUsdaZoneFromLat(inputs.lat, inputs.lng);
    zone = adjustZoneForAltitude(zone, parseAltitudeM(inputs.altitude));
    return Math.max(1, Math.min(11, zone));
  }
  return climateToTypicalUsdaZone(inputs.climate);
}

/**
 * Plant survives outdoors when site zone meets or exceeds PFAF minimum (`hard`).
 * Frost-tender species (hard >= 8) are never relaxed for cold sites.
 */
export function plantFitsUsdaZone(plantHard: number, siteZone: number, annual = false): boolean {
  if (!Number.isFinite(plantHard) || plantHard <= 0) return false;
  if (plantHard >= 8) return siteZone >= plantHard;
  if (annual) return siteZone >= Math.min(plantHard, 4);
  return siteZone >= plantHard;
}
