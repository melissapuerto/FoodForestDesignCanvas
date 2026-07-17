import {
  ensureLocaleLoaded, initialLocale, isLocaleLoaded, setLocaleSource, setPlainLocale, trFor,
  type Locale, type TranslationKey
} from './translate';

export type { TranslationKey, Locale };
export { tr, getPlainLocale, browserLocale, savedLocaleChoice } from './translate';

/** Each locale's name in its own language (for the language switcher). */
export const LOCALE_NAMES: Record<Locale, string> = { es: 'Español', en: 'English' };

// Svelte 5 documented pattern for shared reactive state across components:
// class with $state fields. Reading `_store.current` inside a reactive context
// (template expression, $derived, $effect) tracks the dependency and re-runs
// when setLocale() mutates it.
/** Keep <html lang> in sync with the active locale (WCAG 3.1.1). */
function syncDocumentLang(l: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

class LocaleStore {
  current = $state<Locale>(initialLocale());
  set(l: Locale): void {
    this.current = l;
    setPlainLocale(l);
    syncDocumentLang(l);
    try { localStorage.setItem('kuxtal-locale', l); } catch {}
  }
}

const _store = new LocaleStore();
// Set the document language + plain mirror on load to match the restored locale,
// and make tr() (used by engine/lib code) reactive to this store.
setPlainLocale(_store.current);
setLocaleSource(() => _store.current);
syncDocumentLang(_store.current);
// main.ts awaits the initial dictionary before mounting; this covers any other
// entry path (tests, previews) where the store may start as 'en'.
void ensureLocaleLoaded(_store.current);

/** Read the current locale. Reactive inside templates and $derived expressions. */
export function getLocale(): Locale { return _store.current; }

/**
 * Switch languages. The store only flips once the target dictionary is in
 * memory (the English one is a lazy chunk), so the UI never renders a
 * half-translated frame.
 */
export function setLocale(l: Locale): void {
  if (isLocaleLoaded(l)) {
    _store.set(l);
    return;
  }
  void ensureLocaleLoaded(l).then(() => _store.set(l));
}

/**
 * Translate a key to the current locale. Reactive: call it inside a template
 * expression or $derived — it re-evaluates whenever the locale changes.
 */
export function t(key: TranslationKey, params?: Record<string, string>): string {
  return trFor(_store.current, key, params);
}
