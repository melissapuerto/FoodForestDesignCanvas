/**
 * Round a number to N decimals, eliminating floating-point trailing-9s artifacts.
 * `round(0.4 + 0.2)` returns `0.6` instead of `0.6000000000000001`.
 */
export function round(n: number, decimals = 1): number {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/** "1.2 m" — handles null / undefined / NaN gracefully. */
export function formatMeters(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${round(n, decimals).toFixed(decimals)} m`;
}

/** "1.2 m²" — for areas. */
export function formatMetersSq(n: number | null | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${round(n, decimals).toFixed(decimals)} m²`;
}

/** "1,234 m" — for large distances with thousands separator. */
export function formatMetersHuman(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 100) return `${Math.round(n).toLocaleString('es-CO')} m`;
  if (n >= 10) return `${round(n, 1).toFixed(1)} m`;
  return `${round(n, 1).toFixed(1)} m`;
}
