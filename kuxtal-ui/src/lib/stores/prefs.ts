import { writable, get } from 'svelte/store';
import { exec, selectAll } from '../db/sqlite';

export type AccessibilityPrefs = {
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  dyslexiaFont: boolean;
  screenReaderHints: boolean;
  showTutorialOnStart: boolean;
};

export const DEFAULT_PREFS: AccessibilityPrefs = {
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  dyslexiaFont: false,
  screenReaderHints: false,
  showTutorialOnStart: true
};

const SETTINGS_KEY = 'a11y.prefs';

export const prefs = writable<AccessibilityPrefs>(DEFAULT_PREFS);

export function loadPrefs(): void {
  try {
    const rows = selectAll<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [SETTINGS_KEY]
    );
    if (rows[0]?.value) {
      const parsed = JSON.parse(rows[0].value) as Partial<AccessibilityPrefs>;
      prefs.set({ ...DEFAULT_PREFS, ...parsed });
    }
  } catch (err) {
    console.warn('[prefs] load failed', err);
  }
  applyToDocument(get(prefs));
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      prefs.update((p) => ({ ...p, reducedMotion: true }));
    }
  }
}

export function setPref<K extends keyof AccessibilityPrefs>(key: K, value: AccessibilityPrefs[K]): void {
  prefs.update((p) => {
    const next = { ...p, [key]: value };
    persist(next);
    applyToDocument(next);
    return next;
  });
}

export function persist(p: AccessibilityPrefs): void {
  try {
    exec(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SETTINGS_KEY, JSON.stringify(p)]
    );
  } catch (err) {
    console.warn('[prefs] persist failed', err);
  }
}

export function applyToDocument(p: AccessibilityPrefs): void {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.classList.toggle('a11y-large-text', p.largeText);
  body.classList.toggle('a11y-high-contrast', p.highContrast);
  body.classList.toggle('a11y-reduced-motion', p.reducedMotion);
  body.classList.toggle('a11y-dyslexia', p.dyslexiaFont);
  body.classList.toggle('a11y-sr-hints', p.screenReaderHints);
}

prefs.subscribe((p) => applyToDocument(p));
