import { writable, get } from 'svelte/store';
import { exec, selectAll } from '../db/sqlite';

export type Palette = 'codice' | 'tierra' | 'cartografico' | 'botanico';

const STORAGE_KEY = 'codex.palette';

export const palette = writable<Palette>('codice');

export function loadPalette(): void {
  try {
    const rows = selectAll<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [STORAGE_KEY]
    );
    if (rows[0]?.value) {
      const v = JSON.parse(rows[0].value) as Palette;
      if (v === 'codice' || v === 'tierra' || v === 'cartografico' || v === 'botanico') {
        palette.set(v);
      }
    }
  } catch (err) {
    console.warn('[palette] load failed', err);
  }
  applyToDocument(get(palette));
}

export function setPalette(value: Palette): void {
  palette.set(value);
  applyToDocument(value);
  persist(value);
}

function applyToDocument(value: Palette): void {
  if (typeof document === 'undefined') return;
  if (value === 'codice') {
    document.documentElement.removeAttribute('data-palette');
  } else {
    document.documentElement.setAttribute('data-palette', value);
  }
}

function persist(value: Palette): void {
  try {
    exec(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [STORAGE_KEY, JSON.stringify(value)]
    );
  } catch (err) {
    console.warn('[palette] persist failed', err);
  }
}

palette.subscribe((v) => applyToDocument(v));
