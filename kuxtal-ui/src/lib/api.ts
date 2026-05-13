import { writable, get } from 'svelte/store';

export type Role = 'user' | 'mod' | 'admin';

export type AuthUser = {
  id: number;
  username: string;
  email?: string;
  role?: Role;
  bio?: string | null;
  location?: string | null;
  stats?: {
    posts: number;
    comments: number;
    events: number;
    shared: number;
    attending: number;
  };
};

export const authToken = writable<string | null>(localStorage.getItem('kuxtal_auth_token') || null);
export const authUser = writable<AuthUser | null>(null);

authToken.subscribe(token => {
  if (token) {
    localStorage.setItem('kuxtal_auth_token', token);
  } else {
    localStorage.removeItem('kuxtal_auth_token');
  }
});

const RAW_API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
// Strip a trailing slash so endpoints like '/posts/' don't become '//posts/'.
export const API_URL = RAW_API_URL.replace(/\/$/, '');

if (globalThis.window !== undefined) {
  // Surfaces config issues in the browser console when Vercel forgot the env.
  // eslint-disable-next-line no-console
  console.info('[kuxtal] API_URL =', API_URL);
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = get(authToken);
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && (!options.body || typeof options.body === 'string')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  } catch (e: any) {
    // Network-level failure (DNS, CORS preflight, server down) — fetch
    // throws a TypeError without a usable status. Surface it explicitly.
    // eslint-disable-next-line no-console
    console.error('[kuxtal] network error', endpoint, e);
    throw new Error(`No se pudo conectar al servidor (${API_URL}). ${e?.message ?? ''}`);
  }

  if (res.status === 401) {
    authToken.set(null);
    authUser.set(null);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.detail || `HTTP ${res.status} on ${endpoint}`;
    // eslint-disable-next-line no-console
    console.warn('[kuxtal] api error', options.method || 'GET', endpoint, '->', res.status, msg);
    throw new Error(msg);
  }
  const ct = res.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) return null;
  return res.json();
}

export async function fetchMe(): Promise<AuthUser | null> {
  if (!get(authToken)) return null;
  try {
    const user = await apiFetch('/users/me/');
    authUser.set(user);
    return user;
  } catch {
    authUser.set(null);
    return null;
  }
}

export async function saveProject(data: any): Promise<any> {
  return apiFetch('/projects/save', {
    method: 'POST',
    body: JSON.stringify({ data: JSON.stringify(data) }),
  });
}

export async function fetchMyProject(): Promise<any> {
  try {
    const proj = await apiFetch('/projects/mine');
    return proj;
  } catch {
    return null;
  }
}
