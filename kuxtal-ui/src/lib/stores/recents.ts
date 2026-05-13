import { writable } from 'svelte/store';
import { selectAll, exec } from '../db/sqlite';

// Store for recently used plant ids (max 10)
export const recentPlants = writable<string[]>([]);

const STORAGE_KEY = 'recents.plants';

export function addRecentPlant(id: string): void {
  recentPlants.update((list) => {
    const filtered = list.filter((pid) => pid !== id);
    const newList = [id, ...filtered].slice(0, 10);
    persistRecents(newList);
    return newList;
  });
}

export function loadRecents(): void {
  try {
    const rows = selectAll<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [STORAGE_KEY]
    );
    if (rows[0]?.value) {
      const ids = JSON.parse(rows[0].value);
      if (Array.isArray(ids)) recentPlants.set(ids.slice(0, 10));
    }
  } catch { /* db not ready yet — fine */ }
}

function persistRecents(ids: string[]): void {
  try {
    exec(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [STORAGE_KEY, JSON.stringify(ids)]
    );
  } catch { /* silent */ }
}
