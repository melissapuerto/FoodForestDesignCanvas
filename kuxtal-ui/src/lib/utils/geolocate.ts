/**
 * One-shot device geolocation, shared by every "attach my location" toggle
 * (Notebook, Protocol, Harvest). Returns a discriminated result instead of
 * throwing so callers can announce the right message ('unsupported' when the
 * device has no geolocation at all, 'failed' for permission/timeout).
 */
export type GeoResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'unsupported' | 'failed' };

export async function captureCurrentPosition(timeoutMs = 10_000): Promise<GeoResult> {
  if (!('geolocation' in navigator)) return { ok: false, reason: 'unsupported' };
  try {
    const pos: GeolocationPosition = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: timeoutMs,
        maximumAge: 60_000
      })
    );
    return { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
