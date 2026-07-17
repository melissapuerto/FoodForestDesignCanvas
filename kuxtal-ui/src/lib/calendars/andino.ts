// Andean / chakana solar-agricultural calendar. Markers are computed from the
// actual equinox/solstice JDE using the Meeus (1998) simplified formula —
// accurate to ~1 day for years 1900-2100, which is sufficient for this context.

import { tr, type TranslationKey } from '../i18n/translate';

export type AndinoMarker = {
  /** Which astronomical event: 0=March equinox, 1=June solstice, 2=Sep equinox, 3=Dec solstice */
  quarter: 0 | 1 | 2 | 3;
  /** Quechua festival name — a proper noun, shown as-is in every locale. */
  name: string;
  descKey: TranslationKey;
};

export const ANDINO_MARKERS: AndinoMarker[] = [
  { quarter: 1, name: 'Inti Raymi',    descKey: 'andino_inti_desc' },
  { quarter: 2, name: 'Killa Raymi',   descKey: 'andino_killa_desc' },
  { quarter: 3, name: 'Qhapaq Raymi',  descKey: 'andino_qhapaq_desc' },
  { quarter: 0, name: 'Pawkar Raymi',  descKey: 'andino_pawkar_desc' }
];

/** Localized description of an Andean marker. */
export function andinoDescription(m: AndinoMarker): string {
  return tr(m.descKey);
}

/**
 * Meeus (1998) Ch.27 simplified JDE for equinoxes/solstices.
 * Returns a UTC Date for the given quarter in the given year.
 * Accuracy: ±1-2 days for 1900-2100.
 */
export function equinoxSolstice(year: number, quarter: 0 | 1 | 2 | 3): Date {
  const Y = (year - 2000) / 1000;
  let jde: number;
  switch (quarter) {
    case 0: // March equinox
      jde = 2451623.80984 + 365242.37404*Y + 0.05169*Y*Y - 0.00411*Y*Y*Y - 0.00057*Y*Y*Y*Y;
      break;
    case 1: // June solstice
      jde = 2451716.56767 + 365241.62603*Y + 0.00325*Y*Y + 0.00888*Y*Y*Y - 0.00030*Y*Y*Y*Y;
      break;
    case 2: // September equinox
      jde = 2451810.21715 + 365242.01767*Y - 0.11575*Y*Y + 0.00337*Y*Y*Y + 0.00078*Y*Y*Y*Y;
      break;
    default: // December solstice
      jde = 2451900.05952 + 365242.74049*Y - 0.06223*Y*Y - 0.00823*Y*Y*Y + 0.00032*Y*Y*Y*Y;
  }
  // JD → Unix ms: JD 2440587.5 = 1970-01-01T00:00:00Z
  return new Date((jde - 2440587.5) * 86_400_000);
}

/** Returns the Date of this marker in the given year. */
export function andinoMarkerDate(marker: AndinoMarker, year: number): Date {
  return equinoxSolstice(year, marker.quarter);
}

export function nextAndinoMarker(date: Date): { marker: AndinoMarker; date: Date; daysUntil: number } {
  const year = date.getFullYear();
  let best: { marker: AndinoMarker; date: Date } | null = null;
  for (const m of ANDINO_MARKERS) {
    for (const y of [year, year + 1]) {
      const d = andinoMarkerDate(m, y);
      if (d.getTime() >= date.getTime() && (!best || d < best.date)) {
        best = { marker: m, date: d };
      }
    }
  }
  if (!best) {
    const fallback = andinoMarkerDate(ANDINO_MARKERS[0], year + 1);
    return { marker: ANDINO_MARKERS[0], date: fallback, daysUntil: 0 };
  }
  const daysUntil = Math.ceil((best.date.getTime() - date.getTime()) / 86_400_000);
  return { marker: best.marker, date: best.date, daysUntil };
}
