import { writable } from 'svelte/store';

/** Whether the Suggestions panel is open. On desktop it shares the right rail
 *  with FloatingContext (mutually exclusive); on mobile it opens as a drawer. */
export const suggestionsOpen = writable<boolean>(false);

/** True below the responsive breakpoint where the right rail collapses. */
export const isMobile = writable<boolean>(false);

const MOBILE_QUERY = '(max-width: 760px)';

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia(MOBILE_QUERY);
  const sync = () => isMobile.set(mq.matches);
  sync();
  mq.addEventListener('change', sync);
}

export function toggleSuggestions(): void {
  suggestionsOpen.update((v) => !v);
}
