import { exec, selectAll } from './sqlite';
import { newId, nowIso } from '../utils/id';

export type ResourceRow = {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  notes: string | null;
  last_updated: string;
  created_at: string;
};

export function listResources(): ResourceRow[] {
  return selectAll<ResourceRow>('SELECT * FROM resource_item ORDER BY category, name');
}

export function upsertResource(input: Partial<ResourceRow> & { name: string }): string {
  const id = input.id ?? newId('res');
  const now = nowIso();
  exec(
    `INSERT INTO resource_item (id, name, category, quantity, unit, notes, last_updated, created_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       quantity = excluded.quantity,
       unit = excluded.unit,
       notes = excluded.notes,
       last_updated = excluded.last_updated`,
    [
      id,
      input.name,
      input.category ?? null,
      input.quantity ?? 0,
      input.unit ?? null,
      input.notes ?? null,
      now,
      now
    ]
  );
  return id;
}

export function deleteResource(id: string): void {
  exec('DELETE FROM resource_item WHERE id = ?', [id]);
}

export function adjustQuantity(id: string, delta: number): void {
  exec(
    `UPDATE resource_item SET quantity = MAX(0, quantity + ?), last_updated = ? WHERE id = ?`,
    [delta, nowIso(), id]
  );
}
