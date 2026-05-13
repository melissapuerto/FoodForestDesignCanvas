import { exec, selectAll } from './sqlite';
import { newId, nowIso } from '../utils/id';

export type TaskRow = {
  id: string;
  land_id: string;
  type: string;
  title: string;
  done: number;
  target_id: string | null;
  created_at: string;
  author: string | null;
  location_geojson: string | null;
  scheduled_at: string | null;
};

export function listTasks(landId: string): TaskRow[] {
  return selectAll<TaskRow>(
    'SELECT * FROM task WHERE land_id = ? ORDER BY created_at DESC',
    [landId]
  );
}

export function addTask(input: {
  landId: string;
  title: string;
  type: string;
  targetId?: string | null;
  author?: string | null;
  lat?: number | null;
  lng?: number | null;
  scheduledAt?: string | null;
}): string {
  const id = newId('task');
  const now = nowIso();
  const loc =
    input.lat != null && input.lng != null
      ? JSON.stringify({ type: 'Point', coordinates: [input.lng, input.lat] })
      : null;
  exec(
    `INSERT INTO task (id, land_id, type, title, done, target_id, created_at, author, location_geojson, scheduled_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, input.landId, input.type, input.title, 0, input.targetId ?? null, now,
     input.author ?? null, loc, input.scheduledAt ?? null]
  );
  return id;
}

export function toggleTaskDone(id: string, currentDone: number): void {
  exec('UPDATE task SET done = ? WHERE id = ?', [currentDone ? 0 : 1, id]);
}

export function deleteTask(id: string): void {
  exec('DELETE FROM task WHERE id = ?', [id]);
}
