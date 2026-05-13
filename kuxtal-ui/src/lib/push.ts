import { apiFetch } from './api';

const PUSH_PREF_KEY = 'kuxtal_push_enabled';

export function isPushEnabled(): boolean {
  return localStorage.getItem(PUSH_PREF_KEY) === '1';
}

export function setPushEnabled(val: boolean): void {
  if (val) {
    localStorage.setItem(PUSH_PREF_KEY, '1');
  } else {
    localStorage.removeItem(PUSH_PREF_KEY);
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const { key } = await apiFetch('/push/vapid-public-key');
    if (!key) return false;

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await sendSubscriptionToServer(existing);
      return true;
    }

    // Ensure the buffer is a plain ArrayBuffer (not ArrayBufferLike/SharedArrayBuffer)
    // to satisfy lib.dom's PushSubscriptionOptionsInit typing.
    const applicationServerKey = Uint8Array.from(urlBase64ToUint8Array(key)).buffer;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    await sendSubscriptionToServer(sub);
    setPushEnabled(true);
    return true;
  } catch (err) {
    console.warn('[push] subscribe failed', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiFetch('/push/subscribe', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => null);
      await sub.unsubscribe();
    }
    setPushEnabled(false);
  } catch (err) {
    console.warn('[push] unsubscribe failed', err);
  }
}

async function sendSubscriptionToServer(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await apiFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    }),
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
