import { writable, type Writable } from 'svelte/store';

/**
 * Collapse state for the persistent on-canvas chrome (menus). Lets the user
 * tuck the bottom module nav and the side rail off-screen to free map space,
 * and bring them back with one tap. Preference is remembered in localStorage
 * (a lightweight UI preference, mirroring how the locale is stored) so the
 * canvas reopens the way the user left it.
 */
function persistedBool(key: string, initial: boolean): Writable<boolean> {
  let start = initial;
  try {
    const saved = localStorage.getItem(key);
    if (saved === '1') start = true;
    else if (saved === '0') start = false;
  } catch {
    /* localStorage unavailable (private mode / SSR) — fall back to default */
  }
  const store = writable<boolean>(start);
  store.subscribe((v) => {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      /* ignore persistence failures */
    }
  });
  return store;
}

/** Bottom module navigation collapsed (slid off-screen). */
export const navCollapsed = persistedBool('kuxtal-nav-collapsed', false);

/** Right-hand context / suggestions rail collapsed (slid off-screen). */
export const railCollapsed = persistedBool('kuxtal-rail-collapsed', false);

export function toggleNav(): void {
  navCollapsed.update((v) => !v);
}

export function toggleRail(): void {
  railCollapsed.update((v) => !v);
}
