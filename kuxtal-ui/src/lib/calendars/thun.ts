// Approximate biodynamic (Maria Thun) day-kind based on the Moon's tropical-zodiac sign.
// Approximation: simple lunar longitude estimate; intended as an opt-in guide, not precise ephemeris.

import { tr, type TranslationKey } from '../i18n/translate';

export type ThunDay = 'raiz' | 'hoja' | 'flor' | 'fruto';

const SIGN_TO_KIND: ThunDay[] = [
  'hoja', 'fruto', 'flor', 'raiz',
  'hoja', 'fruto', 'flor', 'raiz',
  'hoja', 'fruto', 'flor', 'raiz'
];

export function thunForDate(date: Date): { sign: number; kind: ThunDay } {
  const j = julianDay(date);
  const T = (j - 2451545.0) / 36525;
  const L = norm360(218.316 + 481267.8813 * T);
  const M = norm360(134.963 + 477198.8676 * T);
  const lon = norm360(L + 6.289 * Math.sin((M * Math.PI) / 180));
  const sign = Math.floor(lon / 30) % 12;
  return { sign, kind: SIGN_TO_KIND[sign] };
}

export const THUN_EMOJI: Record<ThunDay, string> = {
  raiz: '🥕', hoja: '🌿', flor: '🌸', fruto: '🍅'
};

/** Localized full label ("Root day"), short label ("root") and advice. */
export function thunLabel(kind: ThunDay): string {
  return tr(`thun_${kind}_label` as TranslationKey);
}
export function thunShort(kind: ThunDay): string {
  return tr(`thun_${kind}_short` as TranslationKey);
}
export function thunAdvice(kind: ThunDay): string {
  return tr(`thun_${kind}_advice` as TranslationKey);
}

function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}
