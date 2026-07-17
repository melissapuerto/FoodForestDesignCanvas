import { inferBioregion, type Bioregion } from '../climate/region';
import { inferClimateFromLat, siteUsdaZone } from '../climate/hardiness';
import type { ClimateProfile, WizardInputs } from '../permaculture/types';
import { isDbReady } from '../db/sqlite';
import { loadPlan } from '../permaculture/realize';
import { getLand } from '../stores/appState';

const EMPTY_SITE: SiteContext = {
  lat: null,
  lng: null,
  bioregion: null,
  usdaZone: null,
  climate: 'desconocido'
};

export type SiteContext = {
  lat: number | null;
  lng: number | null;
  bioregion: Bioregion | null;
  usdaZone: number | null;
  climate: ClimateProfile;
};

function inputsFromPlanAndLand(): WizardInputs | null {
  if (!isDbReady()) return null;
  const plan = loadPlan();
  const land = getLand('land-default');
  const lat = plan?.inputs.lat ?? land?.center_lat ?? null;
  const lng = plan?.inputs.lng ?? land?.center_lng ?? null;
  if (lat == null && lng == null && !plan) return null;

  let climate = plan?.inputs.climate ?? 'desconocido';
  if (lat != null && climate === 'desconocido') climate = inferClimateFromLat(lat);

  return {
    parcelName: plan?.inputs.parcelName ?? 'Mi finca',
    location: plan?.inputs.location ?? '',
    lat,
    lng,
    areaValue: plan?.inputs.areaValue ?? 1,
    areaUnit: plan?.inputs.areaUnit ?? 'ha',
    climate,
    sunExposure: plan?.inputs.sunExposure ?? 'mixto',
    waterAccess: plan?.inputs.waterAccess ?? 'lluvia',
    region: plan?.inputs.region ?? '',
    microclimates: plan?.inputs.microclimates ?? [],
    soil: plan?.inputs.soil ?? '',
    humidity: plan?.inputs.humidity ?? '',
    altitude: plan?.inputs.altitude ?? '',
    goals: plan?.inputs.goals ?? ['alimento']
  };
}

/** Current site context from saved plan + land center (for catalog sorting). */
export function getSiteContext(): SiteContext {
  if (!isDbReady()) return EMPTY_SITE;
  const inputs = inputsFromPlanAndLand();
  if (!inputs) {
    return EMPTY_SITE;
  }
  const lat = inputs.lat;
  const lng = inputs.lng;
  const bioregion =
    lat != null && lng != null ? inferBioregion(lat, lng) : null;
  return {
    lat,
    lng,
    bioregion,
    usdaZone: siteUsdaZone(inputs),
    climate: inputs.climate
  };
}
