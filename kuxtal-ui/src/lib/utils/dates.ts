import { getLocale } from '../i18n/index.svelte';

/**
 * Locale-aware date/number formatting. The app used to hardcode 'es-CO'
 * everywhere, so an English user got Spanish-formatted dates; these helpers
 * follow the active locale instead. Reading getLocale() inside a template or
 * $derived also makes call sites re-render on language switch.
 */
const TAGS: Record<ReturnType<typeof getLocale>, string> = { es: 'es-CO', en: 'en-US' };

export function localeTag(): string {
  return TAGS[getLocale()];
}

type DateInput = string | number | Date;

function asDate(d: DateInput): Date {
  return d instanceof Date ? d : new Date(d);
}

/** "2/7/2026" (es) / "7/2/2026" (en) — or with custom Intl options. */
export function formatDate(d: DateInput, opts?: Intl.DateTimeFormatOptions): string {
  const date = asDate(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(localeTag(), opts);
}

/** Date + time in the active locale. */
export function formatDateTime(d: DateInput): string {
  const date = asDate(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString(localeTag());
}

/** Thousands-separated integer/decimal in the active locale. */
export function formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(localeTag(), opts);
}
