import { getLocale } from '../i18n/index.svelte';

/**
 * Reverse-geocode a point to a human-readable place name (Nominatim).
 * Never throws: offline or on any failure it falls back to plain coordinates,
 * which are still a truthful, usable address for an offline-first app.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': getLocale() } }
    );
    const data = await resp.json();
    return data?.display_name ? String(data.display_name) : fallback;
  } catch {
    return fallback;
  }
}
