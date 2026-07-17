import { writable } from 'svelte/store';
import { exec, selectAll } from '../db/sqlite';

/**
 * Structural-condition flags (ONB-06). Optional, self-declared context about a
 * grower's situation that biases recommendations toward what is actually
 * feasible. Stored ONLY in the local database (never sent anywhere) and
 * deletable in one tap from Settings.
 */
export type StructuralCondition =
  | 'supply-restricted'        // limited access to purchased inputs/seeds
  | 'intermittent-connection'  // unreliable network
  | 'land-insecure';           // land tenure not yet secured

export const STRUCTURAL_CONDITIONS: StructuralCondition[] = [
  'supply-restricted',
  'intermittent-connection',
  'land-insecure'
];

const KEY = 'onboarding.conditions';

export const structuralConditions = writable<StructuralCondition[]>([]);

function isCondition(v: string): v is StructuralCondition {
  return (STRUCTURAL_CONDITIONS as string[]).includes(v);
}

export function loadConditions(): void {
  try {
    const rows = selectAll<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [KEY]
    );
    if (rows[0]?.value) {
      const arr = JSON.parse(rows[0].value) as unknown;
      if (Array.isArray(arr)) {
        structuralConditions.set(arr.filter((c): c is StructuralCondition => typeof c === 'string' && isCondition(c)));
      }
    }
  } catch {
    /* ignore — best effort */
  }
}

export function saveConditions(list: StructuralCondition[]): void {
  const clean = [...new Set(list.filter(isCondition))];
  structuralConditions.set(clean);
  try {
    exec(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [KEY, JSON.stringify(clean)]
    );
  } catch {
    /* ignore */
  }
}

export function clearConditions(): void {
  structuralConditions.set([]);
  try {
    exec('DELETE FROM app_settings WHERE key = ?', [KEY]);
  } catch {
    /* ignore */
  }
}

/**
 * Whether recommendations should favour low-input, locally-sourced species
 * (no reliance on purchased inputs). Pure — used by the suggestion surface and
 * exercised directly in tests.
 */
export function prefersLowInput(list: StructuralCondition[]): boolean {
  return list.includes('supply-restricted');
}
