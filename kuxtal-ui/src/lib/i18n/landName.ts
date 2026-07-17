import { tr } from './translate';

/**
 * Land-name localization, in its own module so the app shell can import it
 * without dragging the full species/animal localization data (dataLocal.ts and
 * its EN dictionaries) into the initial bundle. dataLocal re-exports these.
 */

/** The canonical (stored) default land name. Persisted rows keep this value. */
export const DEFAULT_LAND_NAME = 'Mi finca';

/** Show the still-default land name in the active locale. */
export function localLandName(name: string | null | undefined): string {
  if (!name) return '';
  return name === DEFAULT_LAND_NAME ? tr('land_default_name') : name;
}

/** Map a localized default back to the canonical value before persisting. */
export function canonicalLandName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === tr('land_default_name')) return DEFAULT_LAND_NAME;
  return trimmed;
}
