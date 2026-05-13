import { writable } from 'svelte/store';
import { newId } from '../utils/id';

export type ToastTone = 'ok' | 'warn' | 'info' | 'error';

export type ToastAction = {
  label: string;
  onAction: () => void;
};

export type ToastEntry = {
  id: string;
  tone: ToastTone;
  message: string;
  ariaRole?: 'status' | 'alert';
  durationMs: number;
  action?: ToastAction;
};

export const toasts = writable<ToastEntry[]>([]);

export function showToast(input: {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
  ariaRole?: 'status' | 'alert';
}): string {
  const id = newId('toast');
  const tone = input.tone ?? 'info';
  const entry: ToastEntry = {
    id,
    tone,
    message: input.message,
    durationMs: input.durationMs ?? (input.action ? 6000 : 3500),
    action: input.action,
    ariaRole: input.ariaRole ?? (tone === 'warn' || tone === 'error' ? 'alert' : 'status')
  };
  toasts.update((list) => [...list, entry]);
  setTimeout(() => dismissToast(id), entry.durationMs);
  return id;
}

export function dismissToast(id: string): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}
