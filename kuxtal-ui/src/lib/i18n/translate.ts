import { ES, type TranslationKey } from './es';

export type { TranslationKey };
export type Locale = 'es' | 'en';

// Spanish is the base language and ships in the shell. The English dictionary
// is a lazy chunk: ensureLocaleLoaded() resolves once it is in memory, and the
// locale store only flips to 'en' after that, so no half-translated frame is
// ever rendered.
let EN_DICT: Record<TranslationKey, string> | null = null;

export async function ensureLocaleLoaded(l: Locale): Promise<void> {
  if (l === 'en' && !EN_DICT) {
    EN_DICT = (await import('./en')).EN;
  }
}

/** True when the locale's dictionary is already in memory (es always is). */
export function isLocaleLoaded(l: Locale): boolean {
  return l === 'es' || !!EN_DICT;
}

function dictFor(locale: Locale): Record<TranslationKey, string> {
  return locale === 'en' && EN_DICT ? EN_DICT : ES;
}

/** Explicit user choice, if any (null on first visit). Plain: usable pre-mount. */
export function savedLocaleChoice(): Locale | null {
  try {
    const v = localStorage.getItem('kuxtal-locale');
    return v === 'en' || v === 'es' ? v : null;
  } catch {
    return null;
  }
}

/** The locale the browser reports, mapped onto the locales we support. */
export function browserLocale(): Locale {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      if (!l) continue;
      if (l.toLowerCase().startsWith('es')) return 'es';
      if (l.toLowerCase().startsWith('en')) return 'en';
    }
  } catch {}
  return 'es';
}

/** First-visit default: saved choice wins, else the browser language. */
export function initialLocale(): Locale {
  return savedLocaleChoice() ?? browserLocale();
}

// Plain (non-rune) locale mirror so pure TS modules — the recommendation
// engine, the permaculture planner, calendar libs — can translate without
// importing a `.svelte.ts` module. Node bundles (esbuild smoke script) and
// unit tests get 'es' unless they call setPlainLocale().
let plainLocale: Locale = 'es';

export function getPlainLocale(): Locale {
  return plainLocale;
}

/** Keep the plain mirror in sync. Called by the reactive store's set(). */
export function setPlainLocale(l: Locale): void {
  plainLocale = l;
}

// When the app boots, index.svelte.ts registers the rune-backed store as the
// locale source. tr() then reads $state through this closure, so components
// calling tr() (directly or via engine helpers) re-render on locale change.
// Node bundles / unit tests never register a source and use the plain mirror.
let localeSource: (() => Locale) | null = null;

export function setLocaleSource(fn: () => Locale): void {
  localeSource = fn;
}

/** Translate `key` in an explicit locale (used by the reactive t()). */
export function trFor(locale: Locale, key: TranslationKey, params?: Record<string, string>): string {
  const dict = dictFor(locale);
  let str: string = dict[key] ?? ES[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}

/**
 * Translate `key` in the current locale. Safe to call from plain TS (engine
 * code, node scripts). Rune-reactive inside the app once index.svelte.ts
 * registers the locale source; plain elsewhere.
 */
export function tr(key: TranslationKey, params?: Record<string, string>): string {
  return trFor(currentLocale(), key, params);
}

/**
 * The active locale, read through the rune-backed store when the app has
 * registered one — so callers in reactive contexts re-run on a language switch.
 */
export function currentLocale(): Locale {
  return localeSource ? localeSource() : plainLocale;
}
