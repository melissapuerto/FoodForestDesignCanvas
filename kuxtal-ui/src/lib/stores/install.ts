import { writable } from 'svelte/store';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export const installAvailable = writable(false);
export const isStandalone = writable(false);

let deferred: BeforeInstallPromptEvent | null = null;

export function bindInstallEvents(): void {
  if (typeof window === 'undefined') return;

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
  isStandalone.set(!!standalone);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    installAvailable.set(true);
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    installAvailable.set(false);
    isStandalone.set(true);
  });
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  installAvailable.set(false);
  return choice.outcome;
}
