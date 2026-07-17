import { exec, selectAll } from '../db/sqlite';

/**
 * Local, opt-in reminders (REM-01..03). Entirely on-device: the cadence config
 * and the "last shown" timestamps live in the local DB, and due reminders are
 * surfaced when the app is foregrounded (in-app toast + an optional local
 * Notification). No server push is involved.
 */
export type ReminderCategory = 'watering' | 'care' | 'harvest';

export const REMINDER_CATEGORIES: ReminderCategory[] = ['watering', 'care', 'harvest'];

export type ReminderRule = { enabled: boolean; everyDays: number };
export type RemindersConfig = Record<ReminderCategory, ReminderRule>;

export const DEFAULT_REMINDERS: RemindersConfig = {
  watering: { enabled: false, everyDays: 3 },
  care: { enabled: false, everyDays: 7 },
  harvest: { enabled: false, everyDays: 14 }
};

const DAY_MS = 86_400_000;
const CONFIG_KEY = 'reminders.config';
const SHOWN_KEY = 'reminders.lastShown';

/**
 * Categories that are due right now: opt-in (enabled) AND either never shown or
 * last shown at least `everyDays` ago. Pure — the unit of behaviour we test.
 */
export function dueCategories(
  config: RemindersConfig,
  lastShown: Partial<Record<ReminderCategory, number>>,
  now: number
): ReminderCategory[] {
  const out: ReminderCategory[] = [];
  for (const cat of REMINDER_CATEGORIES) {
    const rule = config[cat];
    if (!rule?.enabled) continue;
    const last = lastShown[cat];
    if (last == null || now - last >= rule.everyDays * DAY_MS) out.push(cat);
  }
  return out;
}

export function loadRemindersConfig(): RemindersConfig {
  try {
    const r = selectAll<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [CONFIG_KEY]);
    if (r[0]?.value) {
      const parsed = JSON.parse(r[0].value) as Partial<RemindersConfig>;
      return {
        watering: { ...DEFAULT_REMINDERS.watering, ...parsed.watering },
        care: { ...DEFAULT_REMINDERS.care, ...parsed.care },
        harvest: { ...DEFAULT_REMINDERS.harvest, ...parsed.harvest }
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_REMINDERS };
}

export function saveRemindersConfig(config: RemindersConfig): void {
  try {
    exec(
      `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [CONFIG_KEY, JSON.stringify(config)]
    );
  } catch { /* ignore */ }
}

export function loadLastShown(): Partial<Record<ReminderCategory, number>> {
  try {
    const r = selectAll<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [SHOWN_KEY]);
    if (r[0]?.value) return JSON.parse(r[0].value);
  } catch { /* ignore */ }
  return {};
}

export function markShown(cats: ReminderCategory[], now: number): void {
  if (!cats.length) return;
  const m = loadLastShown();
  for (const c of cats) m[c] = now;
  try {
    exec(
      `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SHOWN_KEY, JSON.stringify(m)]
    );
  } catch { /* ignore */ }
}

export function anyEnabled(config: RemindersConfig): boolean {
  return REMINDER_CATEGORIES.some((c) => config[c].enabled);
}

/** Request OS permission for local notifications (no-op if unavailable). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); }
  catch { return 'denied'; }
}

export function notificationsGranted(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
