import { tr, type TranslationKey } from '../i18n/translate';
import { pointInPolygon, type LngLat } from '../map/geometry';
import type { MoistureClass } from '../pfaf/pfafSchema';
import type { ZoneRow } from '../stores/appState';
import type { EngineSite } from './types';

export type MicrozonePreset =
  | 'sun-trap' | 'frost-pocket' | 'swale' | 'wind-ridge'
  | 'shade' | 'saline' | 'compacted';

export type MicrozoneOverride = {
  sun?: 'full' | 'partial' | 'shade';
  moisture?: MoistureClass;
  soil?: string;
  frostRisk?: boolean;
};

export const MICROZONE_PRESETS: Record<MicrozonePreset, { labelKey: TranslationKey; hintKey: TranslationKey; overrides: MicrozoneOverride }> = {
  'sun-trap':     { labelKey: 'mz_suntrap_label',     hintKey: 'mz_suntrap_hint',     overrides: { sun: 'full', frostRisk: false } },
  'frost-pocket': { labelKey: 'mz_frostpocket_label', hintKey: 'mz_frostpocket_hint', overrides: { frostRisk: true } },
  'swale':        { labelKey: 'mz_swale_label',       hintKey: 'mz_swale_hint',       overrides: { moisture: 'high' } },
  'wind-ridge':   { labelKey: 'mz_windridge_label',   hintKey: 'mz_windridge_hint',   overrides: { moisture: 'low' } },
  'shade':        { labelKey: 'mz_shade_label',       hintKey: 'mz_shade_hint',       overrides: { sun: 'shade' } },
  'saline':       { labelKey: 'mz_saline_label',      hintKey: 'mz_saline_hint',      overrides: { soil: 'pobre' } },
  'compacted':    { labelKey: 'mz_compacted_label',   hintKey: 'mz_compacted_hint',   overrides: { soil: 'pobre' } }
};

/** Localized label / hint for a microzone preset. */
export function microzoneLabel(p: MicrozonePreset): string {
  return tr(MICROZONE_PRESETS[p].labelKey);
}
export function microzoneHint(p: MicrozonePreset): string {
  return tr(MICROZONE_PRESETS[p].hintKey);
}

export function isMicrozonePreset(v: string | null | undefined): v is MicrozonePreset {
  return !!v && v in MICROZONE_PRESETS;
}

function parseOverrides(raw: string | null): MicrozoneOverride {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? (o as MicrozoneOverride) : {};
  } catch {
    return {};
  }
}

/** Merge a zone's microzone preset + explicit overrides onto the base site. */
export function applyMicrozone(site: EngineSite, zone: ZoneRow | null | undefined): EngineSite {
  if (!zone) return site;
  const preset = isMicrozonePreset(zone.microzone_preset)
    ? MICROZONE_PRESETS[zone.microzone_preset].overrides
    : {};
  const explicit = parseOverrides(zone.microzone_overrides);
  const merged: MicrozoneOverride = { ...preset, ...explicit };
  if (Object.keys(merged).length === 0) return site;
  return {
    ...site,
    ...(merged.sun !== undefined ? { sun: merged.sun } : {}),
    ...(merged.moisture !== undefined ? { moisture: merged.moisture } : {}),
    ...(merged.soil !== undefined ? { soil: merged.soil } : {}),
    ...(merged.frostRisk !== undefined ? { frostRisk: merged.frostRisk } : {})
  };
}

function ringOf(zone: ZoneRow): LngLat[] | null {
  try {
    const poly = JSON.parse(zone.polygon_geojson) as GeoJSON.Polygon;
    const ring = poly?.coordinates?.[0];
    if (!Array.isArray(ring)) return null;
    return ring.map(([lng, lat]) => ({ lng, lat }));
  } catch {
    return null;
  }
}

/** The zone whose polygon contains the point (prefers tagged microzones). */
export function microzoneAt(point: LngLat, zones: ZoneRow[]): ZoneRow | null {
  let fallback: ZoneRow | null = null;
  for (const z of zones) {
    const ring = ringOf(z);
    if (ring && pointInPolygon(point, ring)) {
      if (isMicrozonePreset(z.microzone_preset)) return z;
      fallback ??= z;
    }
  }
  return fallback;
}
