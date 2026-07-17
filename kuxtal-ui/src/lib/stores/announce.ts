import { writable } from 'svelte/store';

/**
 * Global screen-reader announcement channel. App.svelte renders one polite
 * live region bound to `liveMessage`; calling announce() speaks a short,
 * natural-language message ("You opened the plant codex", "Back to the design
 * canvas") so screen-reader users always know where they are and what just
 * happened — even when no visible focus change conveys it.
 */
export const liveMessage = writable<string>('');

let clearTimer: ReturnType<typeof setTimeout> | null = null;

export function announce(msg: string): void {
  if (!msg) return;
  // Clear first, then set shortly after, so the same message twice in a row is
  // still re-announced by assistive technology.
  liveMessage.set('');
  setTimeout(() => {
    liveMessage.set(msg);
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => liveMessage.set(''), 5000);
  }, 40);
}
