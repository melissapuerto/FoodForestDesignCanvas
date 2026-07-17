import { exec, selectAll } from '../db/sqlite';

/**
 * The tour-completed flag, separated from chaacTour.ts so the app shell can
 * check it without loading driver.js — the tour engine itself is dynamically
 * imported only when a tour actually starts.
 */
const TOUR_FLAG = 'tour.completed';

/** Has the user already seen (or dismissed) the tour at least once? */
export function tourCompleted(): boolean {
  try {
    const rows = selectAll<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [TOUR_FLAG]
    );
    return !!rows[0]?.value;
  } catch {
    return false;
  }
}

export function markTourCompleted(): void {
  try {
    exec(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [TOUR_FLAG, JSON.stringify(new Date().toISOString())]
    );
  } catch {}
}
